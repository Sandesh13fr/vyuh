// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAproFeed} from "../interfaces/IAproFeed.sol";
import {InvalidConfiguration} from "../types/VyuhTypes.sol";

interface IV3PoolOracle {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function observe(uint32[] calldata secondsAgos)
        external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
    function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external;
}

/// @title V3TwapFeed
/// @notice Permissionless Chainlink-shaped USD feed from a Uniswap-V3-style pool TWAP, quoted against a $1 stable.
/// @dev Exists because APRO push feeds on HashKey reject reads from non-whitelisted contracts ("No access").
///      Swap to the APRO feed in OracleRegistry once Vyuh contracts are whitelisted.
///      The pool must hold enough observations for `window` (call `grow` after deploy).
contract V3TwapFeed is IAproFeed {
    uint8 public constant override decimals = 8;
    uint256 private constant Q128 = 1 << 128;
    /// ponytail: 1.0001 in Q128; binary exponentiation keeps |tick| <= MAX_TICK inside uint256.
    uint256 private constant ONE_BP_Q128 = 340316395157630557309720944892511388277; // floor(1.0001 * 2^128)
    int24 public constant MAX_TICK = 600_000;

    IV3PoolOracle public immutable pool;
    address public immutable base;
    bool public immutable baseIsToken0;
    uint32 public immutable window;
    uint256 public immutable scale; // 10^(8 + baseDecimals - quoteDecimals), or its inverse via `scaleDown`
    bool public immutable scaleDown;

    constructor(IV3PoolOracle pool_, address base_, uint32 window_) {
        if (window_ == 0) revert InvalidConfiguration();
        address t0 = pool_.token0();
        address t1 = pool_.token1();
        if (base_ != t0 && base_ != t1) revert InvalidConfiguration();
        pool = pool_;
        base = base_;
        baseIsToken0 = base_ == t0;
        window = window_;
        int256 exp = 8 + int256(uint256(IERC20Metadata(base_).decimals()))
            - int256(uint256(IERC20Metadata(baseIsToken0 ? t1 : t0).decimals()));
        scaleDown = exp < 0;
        scale = 10 ** uint256(exp < 0 ? -exp : exp);
    }

    /// @notice Raise the pool's observation buffer so `window` can be served. Anyone may pay for it.
    function grow(uint16 cardinality) external {
        pool.increaseObservationCardinalityNext(cardinality);
    }

    /// @notice TWAP price of `base` in USD (8 decimals); updatedAt is now because the TWAP is computed live.
    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        uint32[] memory ago = new uint32[](2);
        ago[0] = window;
        (int56[] memory cum,) = pool.observe(ago);
        int56 delta = cum[1] - cum[0];
        int24 tick = int24(delta / int56(uint56(window)));
        if (delta < 0 && delta % int56(uint56(window)) != 0) tick--; // round toward -infinity
        if (!baseIsToken0) tick = -tick; // price of token1 in token0
        uint256 priceQ128 = ratioAtTick(tick); // quote raw units per base raw unit
        uint256 answer = scaleDown ? Math.mulDiv(priceQ128, 1, Q128 * scale) : Math.mulDiv(priceQ128, scale, Q128);
        return (1, int256(answer), block.timestamp, block.timestamp, 1);
    }

    /// @notice 1.0001^tick in Q128.
    function ratioAtTick(int24 tick) public pure returns (uint256 r) {
        uint256 n = uint256(int256(tick < 0 ? -tick : tick));
        if (n > uint256(int256(MAX_TICK))) revert InvalidConfiguration();
        r = Q128;
        uint256 b = ONE_BP_Q128;
        while (n != 0) {
            if (n & 1 == 1) r = Math.mulDiv(r, b, Q128);
            n >>= 1;
            if (n != 0) b = Math.mulDiv(b, b, Q128);
        }
        if (tick < 0) r = Math.mulDiv(Q128, Q128, r);
    }
}
