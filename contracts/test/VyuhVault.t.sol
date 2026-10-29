// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "./Fixture.sol";
import {Intent, ReasonCode, Unauthorized, InvalidHalt, AlreadyInitialized} from "../src/types/VyuhTypes.sol";

contract VyuhVaultTest is Fixture {
    event TradeExecuted(address indexed vault, bytes32 indexed intentHash, bytes32 reasoningHash,
        address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 navBefore, uint256 navAfter);
    event Halted(address indexed vault, ReasonCode reason, address caller);

    function test_executeHappyPathEmitsReceipt() public {
        Intent memory i = _intent();
        vm.expectEmit(address(vault));
        emit TradeExecuted(address(vault), keccak256(abi.encode(i)), i.reasoningHash,
            address(usdt), address(whsk), 100e6, 200e18, 10_000e18, 10_000e18);
        vm.prank(agent);
        uint256 out = vault.execute(i);
        assertEq(out, 200e18);
        assertEq(whsk.balanceOf(address(vault)), 200e18);
        assertEq(vault.nonce(), 1);
        assertEq(vault.lastTrade(), block.timestamp);
    }

    /// @dev The LLM was talked into buying a token the owner never allowed. Ring 2 holds.
    function test_promptInjectedIntentToNonAllowlistedTokenReverts() public {
        Intent memory i = _intent(address(usdt), address(evil), 100e6, 100e18);
        (ReasonCode code, uint8 ring) = _check(i);
        assertEq(uint8(code), uint8(ReasonCode.ALLOWLIST));
        assertEq(ring, 2);
        _expectViolation(ReasonCode.ALLOWLIST, 2);
        vm.prank(agent);
        vault.execute(i);
        assertEq(evil.balanceOf(address(vault)), 0);
    }

    function test_oracleBandViolationReverts() public {
        Intent memory i_ = _intent(address(usdt), address(whsk), 100e6, 100e18);
        _expectViolation(ReasonCode.ORACLE_BAND, 3);
        vm.prank(agent);
        vault.execute(i_);
    }

    function test_preRingChecks() public {
        // NOT_AGENT
        Intent memory i = _intent();
        _expectViolation(ReasonCode.NOT_AGENT, 0);
        vm.prank(stranger);
        vault.execute(i);
        // EXPIRED deadline
        i.deadline = uint64(block.timestamp - 1);
        _expectViolation(ReasonCode.EXPIRED, 0);
        vm.prank(agent);
        vault.execute(i);
        // HALTED
        vm.prank(owner);
        vault.ownerHalt();
        Intent memory i_ = _intent();
        _expectViolation(ReasonCode.HALTED, 0);
        vm.prank(agent);
        vault.execute(i_);
    }

    function test_nonceReplayAndGaps() public {
        Intent memory i = _intent();
        vm.prank(agent);
        vault.execute(i);
        vm.warp(block.timestamp + 60);
        i.deadline = uint64(block.timestamp + 300);
        _expectViolation(ReasonCode.BAD_NONCE, 0);
        vm.prank(agent);
        vault.execute(i); // replay of nonce 0
        i.nonce = 5; // gaps allowed; nonce() becomes 6
        vm.prank(agent);
        vault.execute(i);
        assertEq(vault.nonce(), 6);
    }

    function test_ownerWithdrawWorksWhileHaltedAndOracleDown() public {
        Intent memory i_ = _intent();
        vm.prank(agent);
        vault.execute(i_);
        vm.prank(owner);
        vault.ownerHalt();
        whskFeed.setBroken(true);
        vm.startPrank(owner);
        vault.withdraw(address(whsk), 200e18);
        vault.withdraw(address(usdt), 9_900e6);
        vm.stopPrank();
        assertEq(whsk.balanceOf(owner), 200e18);
        assertEq(usdt.balanceOf(owner), 9_900e6);
    }

    function test_onlyOwnerWithdrawsHaltsResumes() public {
        vm.startPrank(agent);
        vm.expectRevert(Unauthorized.selector);
        vault.withdraw(address(usdt), 1);
        vm.expectRevert(Unauthorized.selector);
        vault.resume();
        vm.expectRevert(Unauthorized.selector);
        vault.ownerHalt();
        vm.stopPrank();
    }

    function test_permissionlessHaltOnlyWhenConditionTrue() public {
        vm.startPrank(stranger);
        vm.expectRevert(InvalidHalt.selector);
        vault.halt(ReasonCode.KYC_TIER);
        vm.expectRevert(InvalidHalt.selector);
        vault.halt(ReasonCode.ORACLE_STALE);
        vm.expectRevert(InvalidHalt.selector);
        vault.halt(ReasonCode.DAILY_LOSS);
        vm.expectRevert(InvalidHalt.selector);
        vault.halt(ReasonCode.SPEND_CAP);
        vm.stopPrank();

        sbt.set(owner, false, 0);
        vm.expectEmit(address(vault));
        emit Halted(address(vault), ReasonCode.KYC_TIER, stranger);
        vm.prank(stranger);
        vault.halt(ReasonCode.KYC_TIER);
        assertTrue(vault.halted());

        vm.prank(owner);
        vault.resume();
        assertFalse(vault.halted());
    }

    function test_permissionlessHaltOnStaleOracle() public {
        vm.warp(block.timestamp + 2 hours);
        vm.prank(stranger);
        vault.halt(ReasonCode.ORACLE_STALE);
        assertTrue(vault.halted());
    }

    function test_permissionlessHaltOnDailyLoss() public {
        Intent memory i_ = _intent(address(usdt), address(whsk), 1_000e6, 1_990e18);
        vm.prank(agent);
        vault.execute(i_);
        vm.prank(stranger);
        vm.expectRevert(InvalidHalt.selector);
        vault.halt(ReasonCode.DAILY_LOSS);
        whskFeed.set(0.25e8, block.timestamp);
        vm.prank(stranger);
        vault.halt(ReasonCode.DAILY_LOSS);
        assertTrue(vault.halted());
    }

    function test_cloneCannotBeReinitialized() public {
        vm.expectRevert(AlreadyInitialized.selector);
        vault.initialize(stranger, stranger);
    }
}
