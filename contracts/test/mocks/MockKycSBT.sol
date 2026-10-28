// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IKycSBT} from "../../src/interfaces/IKycSBT.sol";

/// @notice MOCK HashKey KYC SBT. Real SBT address is unpublished.
contract MockKycSBT is IKycSBT {
    struct Status { bool human; uint8 level; }
    mapping(address => Status) public status;
    /// @notice Set an account's KYC status (mock only).
    function set(address account, bool human, uint8 level) external { status[account] = Status(human, level); }
    /// @inheritdoc IKycSBT
    function isHuman(address account) external view returns (bool, uint8) {
        Status memory s = status[account];
        return (s.human, s.level);
    }
}
