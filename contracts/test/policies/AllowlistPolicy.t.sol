// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";

contract AllowlistPolicyTest is Fixture {
    function test_allowedPairPasses() public {
        (ReasonCode code,) = _check(_intent());
        assertEq(uint8(code), uint8(ReasonCode.OK));
    }

    function test_tokenOutNotAllowedIsRing2() public {
        (ReasonCode code, uint8 ring) = _check(_intent(address(usdt), address(evil), 100e6, 100e18));
        assertEq(uint8(code), uint8(ReasonCode.ALLOWLIST));
        assertEq(ring, 2);
    }

    function test_tokenInNotAllowedIsRing2() public {
        (ReasonCode code, uint8 ring) = _check(_intent(address(evil), address(usdt), 100e18, 100e6));
        assertEq(uint8(code), uint8(ReasonCode.ALLOWLIST));
        assertEq(ring, 2);
    }
}
