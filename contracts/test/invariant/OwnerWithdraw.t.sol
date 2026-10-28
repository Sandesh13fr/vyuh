// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {Fixture} from "../Fixture.sol";
import {Intent, ReasonCode} from "../../src/types/VyuhTypes.sol";
import {VyuhVault} from "../../src/VyuhVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockAproFeed} from "../mocks/MockAproFeed.sol";
import {MockKycSBT} from "../mocks/MockKycSBT.sol";
import {OracleRegistry} from "../../src/OracleRegistry.sol";

/// @dev Random agent trades, halts, oracle outages, price moves and KYC loss. Never reverts.
contract Handler is Test {
    VyuhVault vault;
    MockERC20 usdt;
    MockERC20 whsk;
    MockAproFeed feed;
    MockKycSBT sbt;
    address owner;
    address agent;
    OracleRegistry oracle;

    constructor(VyuhVault v, MockERC20 u, MockERC20 w, MockAproFeed f, MockKycSBT s, address o, address a) {
        vault = v; usdt = u; whsk = w; feed = f; sbt = s; owner = o; agent = a; oracle = v.oracle();
    }

    function trade(uint256 amount, bool buy) external {
        (address tin, address tout) = buy ? (address(usdt), address(whsk)) : (address(whsk), address(usdt));
        amount = bound(amount, 1, buy ? 1_000e6 : 2_000e18);
        (uint256 quote,) = oracle.quote(tin, tout, amount);
        Intent memory i = Intent(address(vault), tin, tout, amount, quote * 995 / 1000, 3000, uint64(block.timestamp + 60),
            vault.nonce(), bytes32(0));
        vm.prank(agent);
        try vault.execute(i) {} catch {}
    }

    function setPrice(uint256 p) external { feed.set(int256(bound(p, 1, 10e8)), block.timestamp); }
    function breakOracle(bool b) external { feed.setBroken(b); }
    function revokeKyc() external { sbt.set(owner, false, 0); }
    function warp(uint256 s) external { vm.warp(block.timestamp + bound(s, 1, 2 days)); }

    function haltAnyone(uint8 r) external {
        try vault.halt(ReasonCode(bound(r, 0, 13))) {} catch {}
    }

    function ownerHalt() external {
        vm.prank(owner);
        try vault.ownerHalt() {} catch {}
    }
}

contract OwnerWithdrawInvariant is Fixture {
    Handler handler;

    function setUp() public override {
        super.setUp();
        handler = new Handler(vault, usdt, whsk, whskFeed, sbt, owner, agent);
        targetContract(address(handler));
    }

    /// @dev Whatever happened, the owner can pull every tracked token out. State is restored afterwards.
    function invariant_ownerCanAlwaysWithdraw() public {
        uint256 snap = vm.snapshotState();
        address[2] memory tokens = [address(usdt), address(whsk)];
        for (uint256 n; n < 2; ++n) {
            MockERC20 t = MockERC20(tokens[n]);
            uint256 bal = t.balanceOf(address(vault));
            uint256 before = t.balanceOf(owner);
            vm.prank(owner);
            vault.withdraw(address(t), bal);
            assertEq(t.balanceOf(address(vault)), 0);
            assertEq(t.balanceOf(owner), before + bal);
        }
        vm.revertToState(snap);
    }
}
