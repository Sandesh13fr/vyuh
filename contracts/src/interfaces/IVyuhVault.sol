// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Intent, ReasonCode} from "../types/VyuhTypes.sol";
interface IVyuhVault {
    /// @notice Initialize a fresh clone.
    function initialize(address owner_, address agent_) external;
    /// @notice Withdrawal authority and mandate signer.
    function owner() external view returns (address);
    /// @notice Trading operator.
    function agent() external view returns (address);
    /// @notice Whether trading is halted.
    function halted() external view returns (bool);
    /// @notice Next expected intent nonce; intents with a lower nonce are BAD_NONCE.
    function nonce() external view returns (uint256);
    /// @notice Last successful trade timestamp.
    function lastTrade() external view returns (uint256);
    /// @notice Oracle-valued holdings in USD, scaled by 1e18.
    function nav() external view returns (uint256);
    /// @notice Day-start NAV, using current NAV on a new UTC day.
    function dayStartNav() external view returns (uint256);
    /// @notice Track mandate tokens permanently so removals do not hide holdings.
    function trackTokens(address[] calldata tokens) external;
    /// @notice Execute an intent passing the seven rings.
    function execute(Intent calldata intent) external returns (uint256);
    /// @notice Halt on a proven KYC, loss or oracle failure.
    function halt(ReasonCode reason) external;
    /// @notice Halt by owner request.
    function ownerHalt() external;
    /// @notice Resume by owner request.
    function resume() external;
    /// @notice Withdraw to owner, including while halted or oracles fail.
    function withdraw(address token, uint256 amount) external;
}
