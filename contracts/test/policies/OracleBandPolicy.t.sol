// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";

contract OracleBandPolicyTest is Fixture {
    function test_priceFarBelowOracleIsRing3() public {
        (ReasonCode code, uint8 ring) = _check(_intent(address(usdt), address(whsk), 100e6, 150e18));
        assertEq(uint8(code), uint8(ReasonCode.ORACLE_BAND));
        assertEq(ring, 3);
    }

    function test_priceFarAboveOracleIsRing3() public {
        (ReasonCode code,) = _check(_intent(address(usdt), address(whsk), 100e6, 210e18));
        assertEq(uint8(code), uint8(ReasonCode.ORACLE_BAND));
    }

    function test_staleOracleIsRing3() public {
        vm.warp(block.timestamp + 2 hours);
        (ReasonCode code, uint8 ring) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.ORACLE_STALE));
        assertEq(ring, 3);
    }

    function test_brokenFeedFailsClosed() public {
        whskFeed.setBroken(true);
        (ReasonCode code,) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.ORACLE_STALE));
    }
}
