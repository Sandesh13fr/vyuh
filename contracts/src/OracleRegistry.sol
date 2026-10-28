// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAproFeed} from "./interfaces/IAproFeed.sol";
import {ReasonCode, PolicyViolation, InvalidConfiguration} from "./types/VyuhTypes.sol";

contract OracleRegistry is Ownable {
    struct Asset { address feed; uint8 tokenDecimals; bool stable; bool supported; }
    mapping(address => Asset) public assets;
    uint256 public immutable staleAfter;
    event AssetConfigured(address indexed token, address indexed feed, bool stable);

    constructor(address admin, uint256 staleAfter_) Ownable(admin) {
        if (staleAfter_ == 0) revert InvalidConfiguration();
        staleAfter = staleAfter_;
    }

    /// @notice Configure a supported token; only explicitly registered stables use the $1 peg.
    function setAsset(address token, address feed, bool stable) external onlyOwner {
        if (token.code.length == 0 || (!stable && feed.code.length == 0)) revert InvalidConfiguration();
        uint8 d = IERC20Metadata(token).decimals();
        if (d > 18 || (!stable && IAproFeed(feed).decimals() > 18)) revert InvalidConfiguration();
        assets[token] = Asset(feed, d, stable, true);
        emit AssetConfigured(token, feed, stable);
    }

    /// @notice Whether this token is a configured stablecoin.
    function isStable(address token) external view returns (bool) { return assets[token].stable; }

    /// @notice Return USD price (1e18) and fail-closed oracle status.
    function price(address token) public view returns (uint256 value, ReasonCode code) {
        Asset memory a = assets[token];
        if (!a.supported) return (0, ReasonCode.ORACLE_STALE);
        if (a.stable) return (1e18, ReasonCode.OK);
        try IAproFeed(a.feed).latestRoundData() returns (
            uint80 roundId, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound
        ) {
            if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp
                || block.timestamp - updatedAt > staleAfter || answeredInRound < roundId) {
                return (0, ReasonCode.ORACLE_STALE);
            }
            try IAproFeed(a.feed).decimals() returns (uint8 d) {
                if (d > 18 || uint256(answer) > type(uint256).max / (10 ** (18 - d))) {
                    return (0, ReasonCode.ORACLE_STALE);
                }
                return (uint256(answer) * 10 ** (18 - d), ReasonCode.OK);
            } catch { return (0, ReasonCode.ORACLE_STALE); }
        } catch { return (0, ReasonCode.ORACLE_STALE); }
    }

    /// @notice USD value rounded down; callers must check status.
    function valueOf(address token, uint256 amount) public view returns (uint256, ReasonCode) {
        (uint256 p, ReasonCode code) = price(token);
        if (code != ReasonCode.OK) return (0, code);
        return (Math.mulDiv(amount, p, 10 ** assets[token].tokenDecimals), code);
    }

    /// @notice USD value rounded up for spending and position limits.
    function liabilityOf(address token, uint256 amount) external view returns (uint256, ReasonCode) {
        (uint256 p, ReasonCode code) = price(token);
        if (code != ReasonCode.OK) return (0, code);
        return (Math.mulDiv(amount, p, 10 ** assets[token].tokenDecimals, Math.Rounding.Ceil), code);
    }

    /// @notice Oracle output quote in tokenOut base units.
    function quote(address tokenIn, address tokenOut, uint256 amount) external view returns (uint256, ReasonCode) {
        (uint256 usd, ReasonCode code) = valueOf(tokenIn, amount);
        if (code != ReasonCode.OK) return (0, code);
        (uint256 p, ReasonCode outCode) = price(tokenOut);
        if (outCode != ReasonCode.OK) return (0, outCode);
        return (Math.mulDiv(usd, 10 ** assets[tokenOut].tokenDecimals, p), ReasonCode.OK);
    }

    /// @notice Revert if a nonzero holding cannot be valued.
    function requireValue(address token, uint256 amount) external view returns (uint256) {
        if (amount == 0) return 0;
        (uint256 value, ReasonCode code) = valueOf(token, amount);
        if (code != ReasonCode.OK) revert PolicyViolation(code, 3);
        return value;
    }
}
