// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IAproFeed} from "../../src/interfaces/IAproFeed.sol";

/// @notice MOCK Chainlink-style APRO feed. updatedAt == 0 means "always fresh" (testnet demo mode).
contract MockAproFeed is IAproFeed {
    uint8 public immutable decimals;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId = 1;
    bool public broken;
    constructor(uint8 decimals_, int256 answer_) { decimals = decimals_; answer = answer_; }
    /// @notice Set price and timestamp (0 = always fresh).
    function set(int256 answer_, uint256 updatedAt_) external { answer = answer_; updatedAt = updatedAt_; ++roundId; }
    /// @notice Make latestRoundData revert.
    function setBroken(bool b) external { broken = b; }
    /// @inheritdoc IAproFeed
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "feed down");
        uint256 t = updatedAt == 0 ? block.timestamp : updatedAt;
        return (roundId, answer, t, t, roundId);
    }
}
