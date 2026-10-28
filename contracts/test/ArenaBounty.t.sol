// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {ArenaBounty} from "../src/arena/ArenaBounty.sol";
import {KycTierPolicy} from "../src/policies/KycTierPolicy.sol";
import {IKycSBT} from "../src/interfaces/IKycSBT.sol";
import {ReasonCode, Unauthorized, InvalidAttempt, AlreadyPaid} from "../src/types/VyuhTypes.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ArenaBountyTest is Test {
    event BountyPaid(bytes32 indexed attemptId, address indexed attacker, uint256 amount);

    MockERC20 usdt;
    KycTierPolicy kyc;
    ArenaBounty arena;
    address operator = makeAddr("operator");
    address attacker = makeAddr("attacker");
    bytes32 constant ID = keccak256("attempt-1");

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        kyc = new KycTierPolicy(address(this), IKycSBT(address(0))); // allowlist fallback
        arena = new ArenaBounty(address(this), usdt, kyc, 5e6);
        arena.setOperator(operator, true);
        usdt.mint(address(this), 100e6);
        usdt.approve(address(arena), 100e6);
        arena.fund(100e6);
    }

    function _record(bytes32 id, ReasonCode code) internal {
        vm.prank(operator);
        arena.recordAttempt(id, attacker, keccak256("prompt"), keccak256("intent"), code);
    }

    function test_onlyOperatorRecords() public {
        vm.prank(attacker);
        vm.expectRevert(Unauthorized.selector);
        arena.recordAttempt(ID, attacker, 0, 0, ReasonCode.ALLOWLIST);
    }

    function test_duplicateAttemptRejected() public {
        _record(ID, ReasonCode.ALLOWLIST);
        vm.prank(operator);
        vm.expectRevert(InvalidAttempt.selector);
        arena.recordAttempt(ID, attacker, 0, 0, ReasonCode.ALLOWLIST);
    }

    function test_payoutNeedsKycOrAllowlist() public {
        _record(ID, ReasonCode.ALLOWLIST);
        vm.prank(operator);
        vm.expectRevert(Unauthorized.selector);
        arena.payTier1(ID);

        kyc.setAllowedLevel(attacker, 1);
        vm.expectEmit(address(arena));
        emit BountyPaid(ID, attacker, 5e6);
        vm.prank(operator);
        arena.payTier1(ID);
        assertEq(usdt.balanceOf(attacker), 5e6);

        vm.prank(operator);
        vm.expectRevert(AlreadyPaid.selector);
        arena.payTier1(ID);
    }

    function test_onlyRingRejectionsPay() public {
        kyc.setAllowedLevel(attacker, 1);
        _record(ID, ReasonCode.OK);
        vm.prank(operator);
        vm.expectRevert(InvalidAttempt.selector);
        arena.payTier1(ID);

        bytes32 id2 = keccak256("attempt-2");
        _record(id2, ReasonCode.NOT_AGENT);
        vm.prank(operator);
        vm.expectRevert(InvalidAttempt.selector);
        arena.payTier1(id2);
    }

    function test_ownerWithdrawsPot() public {
        arena.withdraw(100e6);
        assertEq(usdt.balanceOf(address(this)), 100e6);
    }
}
