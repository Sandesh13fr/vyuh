// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPolicy, Intent, Mandate, PolicyContext, ReasonCode} from "../interfaces/IPolicy.sol";
import {IVyuhVault} from "../interfaces/IVyuhVault.sol";
contract DailyLossPolicy is IPolicy {
    /// @inheritdoc IPolicy
    function check(Intent calldata i, Mandate calldata m, PolicyContext calldata) external view returns (ReasonCode) {
        IVyuhVault v = IVyuhVault(i.vault);
        return breached(v.nav(), v.dayStartNav(), m.dailyLossBps) ? ReasonCode.DAILY_LOSS : ReasonCode.OK;
    }
    /// @notice A zero limit permits no loss; exact nonzero threshold is a breach.
    function breached(uint256 current, uint256 start, uint16 bps) public pure returns (bool) {
        if (start == 0 || current > start) return false;
        if (bps == 0) return current < start;
        return start - current >= Math.mulDiv(start, bps, 10_000, Math.Rounding.Ceil);
    }
}
