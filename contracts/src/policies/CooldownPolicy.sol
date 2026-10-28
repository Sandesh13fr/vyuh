// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
contract CooldownPolicy is IPolicy {
    /// @inheritdoc IPolicy
    function check(Intent calldata, Mandate calldata m, PolicyContext calldata c) external view returns (ReasonCode) {
        return c.lastTrade != 0 && block.timestamp < c.lastTrade + m.cooldownSecs
            ? ReasonCode.COOLDOWN : ReasonCode.OK;
    }
}
