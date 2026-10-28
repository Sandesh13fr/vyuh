// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Intent, Mandate, PolicyContext, ReasonCode} from "../types/VyuhTypes.sol";
interface IPolicy {
    /// @notice Return the policy's rejection, or OK.
    function check(Intent calldata intent, Mandate calldata mandate, PolicyContext calldata context)
        external view returns (ReasonCode);
}
