// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Fixture} from "../Fixture.sol";
import {ReasonCode} from "../../src/types/VyuhTypes.sol";

contract SlippagePolicyTest is Fixture {
    function test_withinSlippagePasses() public {
        (ReasonCode code,) = _check(_intent(address(usdt), address(whsk), 100e6, 198e18)); // exactly 1%
        assertEq(uint8(code), uint8(ReasonCode.OK));
    }

    /// @dev 1.5% under oracle: inside the 2% band, outside the 1% slippage limit.
    function test_looseMinOutIsRing4() public {
        (ReasonCode code, uint8 ring) = _check(_intent(address(usdt), address(whsk), 100e6, 197e18));
        assertEq(uint8(code), uint8(ReasonCode.SLIPPAGE));
        assertEq(ring, 4);
    }
}
