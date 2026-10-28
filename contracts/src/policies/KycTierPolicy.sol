// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
import {IKycSBT} from "../interfaces/IKycSBT.sol";
import {InvalidConfiguration} from "../types/VyuhTypes.sol";
contract KycTierPolicy is IPolicy, Ownable {
    IKycSBT public immutable sbt;
    mapping(address => uint8) public allowedLevel;
    event AllowlistLevelSet(address indexed account, uint8 level);
    constructor(address admin, IKycSBT sbt_) Ownable(admin) { sbt = sbt_; }
    /// @notice Set fallback KYC tier; zero revokes access. Used only when SBT is zero.
    function setAllowedLevel(address account, uint8 level) external onlyOwner {
        if (level > 4) revert InvalidConfiguration();
        allowedLevel[account] = level;
        emit AllowlistLevelSet(account, level);
    }
    /// @notice Check live SBT status, failing closed on external errors.
    function eligible(address account, uint8 minimum) public view returns (bool) {
        if (address(sbt) == address(0)) return allowedLevel[account] > 0 && allowedLevel[account] >= minimum;
        try sbt.isHuman(account) returns (bool human, uint8 level) {
            return human && level >= minimum && level <= 4;
        } catch { return false; }
    }
    /// @inheritdoc IPolicy
    function check(Intent calldata, Mandate calldata m, PolicyContext calldata c) external view returns (ReasonCode) {
        return eligible(c.owner, m.minKycLevel) ? ReasonCode.OK : ReasonCode.KYC_TIER;
    }
}
