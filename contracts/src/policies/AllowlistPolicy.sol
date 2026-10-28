// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
contract AllowlistPolicy is IPolicy {
    /// @inheritdoc IPolicy
    function check(Intent calldata i, Mandate calldata m, PolicyContext calldata) external pure returns (ReasonCode) {
        bool input; bool output;
        for (uint256 n; n < m.allowedTokens.length; ++n) {
            if (m.allowedTokens[n] == i.tokenIn) input = true;
            if (m.allowedTokens[n] == i.tokenOut) output = true;
        }
        return input && output ? ReasonCode.OK : ReasonCode.ALLOWLIST;
    }
}
