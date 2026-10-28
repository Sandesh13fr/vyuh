// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";

contract SpendCapPolicyTest is Fixture {
    function test_atCapPasses() public {
        (ReasonCode code,) = _check(_intent(address(usdt), address(whsk), 1_000e6, 1_990e18));
        assertEq(uint8(code), uint8(ReasonCode.OK));
    }

    function test_aboveCapIsRing1() public {
        (ReasonCode code, uint8 ring) = _check(_intent(address(usdt), address(whsk), 1_001e6, 1_992e18));
        assertEq(uint8(code), uint8(ReasonCode.SPEND_CAP));
        assertEq(ring, 1);
    }

    function test_executeAboveCapReverts() public {
        _expectViolation(ReasonCode.SPEND_CAP, 1);
        vm.prank(agent);
        vault.execute(_intent(address(usdt), address(whsk), 5_000e6, 9_950e18));
    }
}
