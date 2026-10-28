// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";

contract CooldownPolicyTest is Fixture {
    function test_secondTradeTooSoonIsRing7() public {
        vm.prank(agent);
        vault.execute(_intent());
        (ReasonCode code, uint8 ring) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.COOLDOWN));
        assertEq(ring, 7);
        vm.warp(block.timestamp + 60);
        (code,) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.OK));
    }
}
