// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IAproFeed {
    /// @notice Chainlink-compatible round data.
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
    /// @notice Number of decimals in the answer.
    function decimals() external view returns (uint8);
}
