// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Intent} from "../../src/types/VyuhTypes.sol";
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";
import {DailyLossPolicy} from "../../src/policies/DailyLossPolicy.sol";

contract DailyLossPolicyTest is Fixture {
    function test_breachedMath() public {
        DailyLossPolicy p = new DailyLossPolicy();
        assertFalse(p.breached(9_501, 10_000, 500));
        assertTrue(p.breached(9_500, 10_000, 500));
        assertFalse(p.breached(10_500, 10_000, 500));
        assertTrue(p.breached(9_999, 10_000, 0));
        assertFalse(p.breached(0, 0, 500));
    }

    /// @dev Buy 2000 WHSK at $0.50, price halves: NAV 10000 -> 9500 = 5% loss.
    function test_lossAfterPriceDropIsRing5() public {
        Intent memory i_ = _intent(address(usdt), address(whsk), 1_000e6, 1_990e18);
        vm.prank(agent);
        vault.execute(i_);
        vm.warp(block.timestamp + 61);
        whskFeed.set(0.25e8, block.timestamp);
        assertEq(vault.nav(), 9_500e18);
        assertEq(vault.dayStartNav(), 10_000e18);
        (ReasonCode code, uint8 ring) = _check(_intent(address(usdt), address(whsk), 100e6, 398e18));
        assertEq(uint8(code), uint8(ReasonCode.DAILY_LOSS));
        assertEq(ring, 5);
    }

    function test_newDayResetsBaseline() public {
        Intent memory i_ = _intent(address(usdt), address(whsk), 1_000e6, 1_990e18);
        vm.prank(agent);
        vault.execute(i_);
        vm.warp(block.timestamp + 1 days);
        whskFeed.set(0.25e8, block.timestamp);
        (ReasonCode code,) = _check(_intent(address(usdt), address(whsk), 100e6, 398e18));
        assertEq(uint8(code), uint8(ReasonCode.OK));
    }
}
