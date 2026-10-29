// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Intent} from "../../src/types/VyuhTypes.sol";
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";

contract CooldownPolicyTest is Fixture {
    function test_secondTradeTooSoonIsRing7() public {
        Intent memory i_ = _intent();
        vm.prank(agent);
        vault.execute(i_);
        (ReasonCode code, uint8 ring) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.COOLDOWN));
        assertEq(ring, 7);
        vm.warp(block.timestamp + 60);
        (code,) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.OK));
    }
}
