// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Intent, Mandate, PolicyContext, ReasonCode, VyuhEvents, PolicyViolation, Unauthorized,
    InvalidAddress, AlreadyInitialized, InvalidIntent, InvalidHalt, TransferMismatch} from "./types/VyuhTypes.sol";
import {IVyuhVault} from "./interfaces/IVyuhVault.sol";
import {IExecutionAdapter} from "./interfaces/IExecutionAdapter.sol";
import {MandateRegistry} from "./MandateRegistry.sol";
import {PolicyEngine} from "./PolicyEngine.sol";
import {OracleRegistry} from "./OracleRegistry.sol";
import {DailyLossPolicy} from "./policies/DailyLossPolicy.sol";

contract VyuhVault is IVyuhVault, ReentrancyGuard, VyuhEvents {
    using SafeERC20 for IERC20;
    MandateRegistry public immutable registry;
    PolicyEngine public immutable engine;
    IExecutionAdapter public immutable adapter;
    OracleRegistry public immutable oracle;
    address public owner;
    address public agent;
    bool public halted;
    uint256 public nonce;
    uint256 public lastTrade;
    bool private initialized;
    uint256 private snapshotDay;
    uint256 private snapshotNav;
    address[] public trackedTokens;
    mapping(address => bool) private tracked;

    constructor(MandateRegistry registry_, PolicyEngine engine_, IExecutionAdapter adapter_) {
        registry = registry_; engine = engine_; adapter = adapter_; oracle = engine_.oracle();
        initialized = true; // Implementation cannot be initialized; clones have fresh storage.
    }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }

    /// @inheritdoc IVyuhVault
    function initialize(address owner_, address agent_) external {
        if (initialized) revert AlreadyInitialized();
        if (owner_ == address(0) || agent_ == address(0) || owner_ == agent_) revert InvalidAddress();
        initialized = true; owner = owner_; agent = agent_;
    }

    /// @inheritdoc IVyuhVault
    function trackTokens(address[] calldata tokens) external {
        if (msg.sender != address(registry)) revert Unauthorized();
        for (uint256 n; n < tokens.length; ++n) {
            if (!tracked[tokens[n]]) { tracked[tokens[n]] = true; trackedTokens.push(tokens[n]); }
        }
    }

    /// @inheritdoc IVyuhVault
    function nav() public view returns (uint256 value) {
        for (uint256 n; n < trackedTokens.length; ++n) {
            address token = trackedTokens[n];
            value += oracle.requireValue(token, IERC20(token).balanceOf(address(this)));
        }
    }

    /// @inheritdoc IVyuhVault
    function dayStartNav() public view returns (uint256) {
        return snapshotDay == block.timestamp / 1 days && snapshotNav != 0 ? snapshotNav : nav();
    }

    /// @inheritdoc IVyuhVault
    function execute(Intent calldata i) external nonReentrant returns (uint256 amountOut) {
        if (halted) revert PolicyViolation(ReasonCode.HALTED, 0);
        if (msg.sender != agent) revert PolicyViolation(ReasonCode.NOT_AGENT, 0);
        if (i.vault != address(this) || i.tokenIn == i.tokenOut || i.amountIn == 0 || i.minAmountOut == 0) {
            revert InvalidIntent();
        }
        engine.enforce(i);
        uint256 beforeNav = nav();
        if (snapshotDay != block.timestamp / 1 days || snapshotNav == 0) {
            snapshotDay = block.timestamp / 1 days; snapshotNav = beforeNav;
        }
        nonce = i.nonce + 1; // nonce() is the next acceptable nonce; gaps are allowed
        lastTrade = block.timestamp;
        amountOut = _swap(i);
        uint256 afterNav = nav();
        _postCheck(i.tokenOut, afterNav);
        emit TradeExecuted(address(this), keccak256(abi.encode(i)), i.reasoningHash,
            i.tokenIn, i.tokenOut, i.amountIn, amountOut, beforeNav, afterNav);
    }

    function _swap(Intent calldata i) private returns (uint256 amountOut) {
        IERC20 input = IERC20(i.tokenIn);
        IERC20 output = IERC20(i.tokenOut);
        uint256 beforeIn = input.balanceOf(address(this));
        uint256 beforeOut = output.balanceOf(address(this));
        input.forceApprove(address(adapter), i.amountIn);
        amountOut = adapter.swap(i.tokenIn, i.tokenOut, i.fee, i.amountIn, i.minAmountOut, address(this));
        input.forceApprove(address(adapter), 0);
        if (input.balanceOf(address(this)) != beforeIn - i.amountIn
            || output.balanceOf(address(this)) < beforeOut
            || output.balanceOf(address(this)) - beforeOut != amountOut || amountOut < i.minAmountOut) {
            revert TransferMismatch();
        }
    }

    function _postCheck(address tokenOut, uint256 currentNav) private view {
        Mandate memory m = registry.getMandate(address(this));
        DailyLossPolicy loss = DailyLossPolicy(address(engine.policies(4)));
        if (loss.breached(currentNav, snapshotNav, m.dailyLossBps)) revert PolicyViolation(ReasonCode.DAILY_LOSS, 5);
        if (!oracle.isStable(tokenOut)) {
            (uint256 usd, ReasonCode code) = oracle.liabilityOf(tokenOut, IERC20(tokenOut).balanceOf(address(this)));
            if (code != ReasonCode.OK) revert PolicyViolation(code, 3);
            if (usd > m.maxPositionUsd) revert PolicyViolation(ReasonCode.POSITION_CAP, 1);
        }
    }

    /// @inheritdoc IVyuhVault
    function halt(ReasonCode reason) external nonReentrant {
        Mandate memory m = registry.getMandate(address(this));
        if (m.owner == address(0)) revert InvalidHalt();
        bool valid;
        if (reason == ReasonCode.KYC_TIER || reason == ReasonCode.DAILY_LOSS) {
            uint256 index = reason == ReasonCode.KYC_TIER ? 5 : 4;
            Intent memory i; i.vault = address(this);
            valid = engine.policies(index).check(i, m, PolicyContext(owner, lastTrade)) == reason;
        } else if (reason == ReasonCode.ORACLE_STALE) {
            for (uint256 n; n < trackedTokens.length; ++n) {
                address token = trackedTokens[n];
                if (IERC20(token).balanceOf(address(this)) == 0 && !_allowed(m, token)) continue;
                (, ReasonCode code) = oracle.price(token);
                if (code == reason) { valid = true; break; }
            }
        }
        if (!valid) revert InvalidHalt();
        halted = true;
        emit Halted(address(this), reason, msg.sender);
    }

    function _allowed(Mandate memory m, address token) private pure returns (bool) {
        for (uint256 n; n < m.allowedTokens.length; ++n) if (m.allowedTokens[n] == token) return true;
        return false;
    }

    /// @inheritdoc IVyuhVault
    function ownerHalt() external onlyOwner {
        halted = true; emit Halted(address(this), ReasonCode.HALTED, msg.sender);
    }

    /// @inheritdoc IVyuhVault
    function resume() external onlyOwner { halted = false; emit Resumed(address(this)); }

    /// @inheritdoc IVyuhVault
    function withdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        uint256 beforeNav;
        bool priced;
        // Oracle availability must never be a prerequisite for an owner's exit.
        try this.nav() returns (uint256 v) { beforeNav = v; priced = true; } catch {}
        IERC20(token).safeTransfer(owner, amount);
        if (priced && beforeNav != 0 && snapshotDay == block.timestamp / 1 days) {
            try this.nav() returns (uint256 afterNav) {
                snapshotNav = Math.mulDiv(snapshotNav, afterNav, beforeNav);
            } catch { snapshotNav = 0; }
        }
    }
}
