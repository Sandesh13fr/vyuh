// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Intent, Mandate, PolicyContext, ReasonCode, PolicyViolation, Unauthorized, InvalidConfiguration} from "./types/VyuhTypes.sol";
import {IPolicy} from "./interfaces/IPolicy.sol";
import {IVyuhVault} from "./interfaces/IVyuhVault.sol";
import {MandateRegistry} from "./MandateRegistry.sol";
import {OracleRegistry} from "./OracleRegistry.sol";

contract PolicyEngine {
    MandateRegistry public immutable registry;
    OracleRegistry public immutable oracle;
    IPolicy[7] public policies;
    constructor(MandateRegistry registry_, OracleRegistry oracle_, IPolicy[7] memory policies_) {
        registry = registry_; oracle = oracle_;
        for (uint256 n; n < 7; ++n) {
            if (address(policies_[n]).code.length == 0) revert InvalidConfiguration();
            policies[n] = policies_[n];
        }
    }
    /// @notice Preflight as the agent (eth_call from=agent); ring zero denotes a pre-ring failure.
    function checkIntent(Intent calldata i) external view returns (ReasonCode, uint8) {
        return _check(i, msg.sender);
    }
    /// @notice Enforce from the target vault; vault authenticates its own caller.
    function enforce(Intent calldata i) external view {
        if (msg.sender != i.vault) revert Unauthorized();
        (ReasonCode code, uint8 ring) = _check(i, IVyuhVault(i.vault).agent());
        if (code != ReasonCode.OK) revert PolicyViolation(code, ring);
    }
    function _check(Intent calldata i, address caller) private view returns (ReasonCode, uint8) {
        Mandate memory m = registry.getMandate(i.vault);
        if (m.owner == address(0)) return (ReasonCode.EXPIRED, 0);
        IVyuhVault v = IVyuhVault(i.vault);
        if (v.halted()) return (ReasonCode.HALTED, 0);
        if (caller != v.agent()) return (ReasonCode.NOT_AGENT, 0);
        if (block.timestamp > i.deadline || block.timestamp > m.expiry) return (ReasonCode.EXPIRED, 0);
        if (i.nonce < v.nonce()) return (ReasonCode.BAD_NONCE, 0);
        PolicyContext memory context = PolicyContext(m.owner, v.lastTrade());
        for (uint8 n; n < 7; ++n) {
            ReasonCode code = policies[n].check(i, m, context);
            if (code != ReasonCode.OK) return (code, n + 1);
        }
        // No eighth ring: position exposure is an additional mandate constraint after the seven rings.
        if (!oracle.isStable(i.tokenOut)) {
            uint256 balance = IERC20(i.tokenOut).balanceOf(i.vault);
            (uint256 usd,) = oracle.liabilityOf(i.tokenOut, balance + i.minAmountOut);
            if (usd > m.maxPositionUsd) return (ReasonCode.POSITION_CAP, 1);
        }
        return (ReasonCode.OK, 0);
    }
}
