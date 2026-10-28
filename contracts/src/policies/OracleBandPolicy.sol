// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
import {OracleRegistry} from "../OracleRegistry.sol";
contract OracleBandPolicy is IPolicy {
    OracleRegistry public immutable oracle;
    constructor(OracleRegistry oracle_) { oracle = oracle_; }
    /// @inheritdoc IPolicy
    function check(Intent calldata i, Mandate calldata m, PolicyContext calldata) external view returns (ReasonCode) {
        (uint256 quote, ReasonCode code) = oracle.quote(i.tokenIn, i.tokenOut, i.amountIn);
        if (code != ReasonCode.OK) return code;
        if (quote == 0) return ReasonCode.ORACLE_BAND;
        uint256 difference = i.minAmountOut > quote ? i.minAmountOut - quote : quote - i.minAmountOut;
        return difference > Math.mulDiv(quote, m.oracleBandBps, 10_000)
            ? ReasonCode.ORACLE_BAND : ReasonCode.OK;
    }
}
