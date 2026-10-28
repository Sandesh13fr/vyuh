// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum ReasonCode {
    OK, HALTED, NOT_AGENT, EXPIRED, BAD_NONCE,
    SPEND_CAP, ALLOWLIST, ORACLE_BAND, ORACLE_STALE, SLIPPAGE,
    DAILY_LOSS, KYC_TIER, COOLDOWN, POSITION_CAP
}

struct Mandate {
    address owner;
    address agent;
    uint256 maxTradeUsd;
    uint256 maxPositionUsd;
    uint16 maxSlippageBps;
    uint16 oracleBandBps;
    uint16 dailyLossBps;
    uint32 cooldownSecs;
    uint8 minKycLevel;
    uint64 expiry;
    uint64 version;
    address[] allowedTokens;
}

struct Intent {
    address vault;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;
    uint24 fee;
    uint64 deadline;
    uint256 nonce;
    bytes32 reasoningHash;
}

struct PolicyContext {
    address owner;
    uint256 lastTrade;
}

error PolicyViolation(ReasonCode code, uint8 ring);
error Unauthorized();
error InvalidAddress();
error InvalidMandate();
error InvalidSignature();
error InvalidVersion();
error NotTighter();
error AlreadyInitialized();
error InvalidIntent();
error InvalidConfiguration();
error InvalidHalt();
error InvalidAttempt();
error AlreadyPaid();
error TransferMismatch();

abstract contract VyuhEvents {
    event MandateSet(address indexed vault, bytes32 mandateHash, uint64 version, bool tightenedByAgent);
    event TradeExecuted(address indexed vault, bytes32 indexed intentHash, bytes32 reasoningHash,
        address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 navBefore, uint256 navAfter);
    event Halted(address indexed vault, ReasonCode reason, address caller);
    event Resumed(address indexed vault);
    event AttemptRecorded(bytes32 indexed attemptId, address indexed attacker, bytes32 promptHash, bytes32 intentHash, ReasonCode code);
    event BountyPaid(bytes32 indexed attemptId, address indexed attacker, uint256 amount);
}
