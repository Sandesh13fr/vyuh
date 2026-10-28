// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
import {OracleRegistry} from "../OracleRegistry.sol";
contract SlippagePolicy is IPolicy {
    OracleRegistry public immutable oracle;
    constructor(OracleRegistry oracle_) { oracle = oracle_; }
    /// @inheritdoc IPolicy
    function check(Intent calldata i, Mandate calldata m, PolicyContext calldata) external view returns (ReasonCode) {
        (uint256 quote, ReasonCode code) = oracle.quote(i.tokenIn, i.tokenOut, i.amountIn);
        if (code != ReasonCode.OK) return code;
        uint256 floor = Math.mulDiv(quote, 10_000 - m.maxSlippageBps, 10_000, Math.Rounding.Ceil);
        return i.minAmountOut < floor ? ReasonCode.SLIPPAGE : ReasonCode.OK;
    }
}
