// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IKycSBT {
    /// @notice Return human status and tier (0..4).
    function isHuman(address account) external view returns (bool, uint8);
}
