// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
import {OracleRegistry} from "../OracleRegistry.sol";
contract SpendCapPolicy is IPolicy {
    OracleRegistry public immutable oracle;
    constructor(OracleRegistry oracle_) { oracle = oracle_; }
    /// @inheritdoc IPolicy
    function check(Intent calldata i, Mandate calldata m, PolicyContext calldata) external view returns (ReasonCode) {
        (uint256 usd, ReasonCode code) = oracle.liabilityOf(i.tokenIn, i.amountIn);
        // Missing prices are rejected at ring 3, preserving ring 2's allowlist precedence.
        if (code != ReasonCode.OK) return ReasonCode.OK;
        return usd > m.maxTradeUsd ? ReasonCode.SPEND_CAP : ReasonCode.OK;
    }
}
