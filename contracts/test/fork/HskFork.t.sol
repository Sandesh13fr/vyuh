// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {HskSwapV3Adapter} from "../../src/adapters/HskSwapV3Adapter.sol";
import {ISwapRouterV3} from "../../src/interfaces/ISwapRouterV3.sol";
import {IAproFeed} from "../../src/interfaces/IAproFeed.sol";

interface IV3PoolLike {
    function liquidity() external view returns (uint128);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

/// @dev Reads live HashKey mainnet (177). Skips unless HSK_RPC_MAINNET is set.
contract HskForkTest is Test {
    address constant POOL = 0xEB33d6666dd2359cB1BF6Ea6D72286Cc1b4a778A;
    address constant ROUTER = 0x1f3858C46F8F6fE76260b8208995D228C5cddc64;
    address constant WHSK = 0xB210D2120d57b758EE163cFfb43e73728c471Cf1;
    address constant USDT = 0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029;
    address constant APRO_HSK_USD = 0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b;

    function setUp() public {
        string memory rpc = vm.envOr("HSK_RPC_MAINNET", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
    }

    function test_poolSlot0AndLiquidity() public view {
        // Decode only sqrtPriceX96 and tick so V3 forks with a wider slot0 still parse.
        (bool ok, bytes memory data) = POOL.staticcall(abi.encodeWithSignature("slot0()"));
        assertTrue(ok && data.length >= 64, "slot0");
        (uint160 sqrtPriceX96, int24 tick) = abi.decode(data, (uint160, int24));
        uint128 liq = IV3PoolLike(POOL).liquidity();
        console2.log("sqrtPriceX96", sqrtPriceX96);
        console2.log("tick", tick);
        console2.log("liquidity", liq);
        console2.log("fee", IV3PoolLike(POOL).fee());
        assertGt(sqrtPriceX96, 0);
        assertGt(liq, 0);
        address t0 = IV3PoolLike(POOL).token0();
        address t1 = IV3PoolLike(POOL).token1();
        assertTrue((t0 == WHSK && t1 == USDT) || (t0 == USDT && t1 == WHSK), "pool tokens");
    }

    function test_aproFeedIsLive() public view {
        (, int256 answer,, uint256 updatedAt,) = IAproFeed(APRO_HSK_USD).latestRoundData();
        console2.log("APRO HSK/USD", uint256(answer));
        console2.log("decimals", IAproFeed(APRO_HSK_USD).decimals());
        console2.log("age secs", block.timestamp - updatedAt);
        assertGt(answer, 0);
    }

    /// @dev Proves the router speaks SwapRouter v1 exactInputSingle (with deadline). Fails on SwapRouter02.
    function test_adapterSwapsOnRealRouter() public {
        HskSwapV3Adapter adapter = new HskSwapV3Adapter(ISwapRouterV3(ROUTER));
        deal(WHSK, address(this), 1e18);
        IERC20(WHSK).approve(address(adapter), 1e18);
        uint256 out = adapter.swap(WHSK, USDT, IV3PoolLike(POOL).fee(), 1e18, 1, address(this));
        console2.log("1 WHSK -> USDT", out);
        assertGt(out, 0);
        assertEq(IERC20(USDT).balanceOf(address(this)), out);
    }
}
