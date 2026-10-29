// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {V3TwapFeed, IV3PoolOracle} from "../../src/oracles/V3TwapFeed.sol";
import {InvalidConfiguration} from "../../src/types/VyuhTypes.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockV3Pool} from "../mocks/MockV3Pool.sol";

contract V3TwapFeedTest is Test {
    uint32 constant WINDOW = 1800;
    MockERC20 whsk = new MockERC20("Wrapped HSK", "WHSK", 18);
    MockERC20 usdt = new MockERC20("Tether USD", "USDT", 6);

    function _answer(V3TwapFeed f) internal view returns (int256 a) {
        (, a,,,) = f.latestRoundData();
    }

    function test_ratioAtTickBasics() public {
        V3TwapFeed f = new V3TwapFeed(IV3PoolOracle(address(new MockV3Pool(address(whsk), address(usdt)))), address(whsk), WINDOW);
        assertEq(f.ratioAtTick(0), 1 << 128);
        assertEq(f.ratioAtTick(1), 340316395157630557309720944892511388277);
        // r(t) * r(-t) ~= 1 in Q128
        assertApproxEqRel(f.ratioAtTick(299350) * f.ratioAtTick(-299350) >> 128, 1 << 128, 1e6);
    }

    /// Mainnet-like: WHSK is token0, tick -299350 => ~$0.1000 (python Decimal reference 10001028).
    function test_baseToken0Price() public {
        MockV3Pool pool = new MockV3Pool(address(whsk), address(usdt));
        V3TwapFeed f = new V3TwapFeed(IV3PoolOracle(address(pool)), address(whsk), WINDOW);
        pool.setDelta(-299350 * int56(uint56(WINDOW)));
        assertApproxEqAbs(_answer(f), 10001028, 1);
        assertEq(f.decimals(), 8);
    }

    function test_negativeTickRoundsDown() public {
        MockV3Pool pool = new MockV3Pool(address(whsk), address(usdt));
        V3TwapFeed f = new V3TwapFeed(IV3PoolOracle(address(pool)), address(whsk), WINDOW);
        pool.setDelta(-299350 * int56(uint56(WINDOW)) - 1); // mean tick -299350.0005 => floor -299351
        assertApproxEqAbs(_answer(f), 10000028, 1);
    }

    /// Base as token1 inverts the tick.
    function test_baseToken1Price() public {
        MockV3Pool pool = new MockV3Pool(address(usdt), address(whsk));
        V3TwapFeed f = new V3TwapFeed(IV3PoolOracle(address(pool)), address(whsk), WINDOW);
        pool.setDelta(299350 * int56(uint56(WINDOW)));
        assertApproxEqAbs(_answer(f), 10001028, 1);
    }

    function test_rejectsForeignBaseAndHugeTick() public {
        MockV3Pool pool = new MockV3Pool(address(whsk), address(usdt));
        vm.expectRevert(InvalidConfiguration.selector);
        new V3TwapFeed(IV3PoolOracle(address(pool)), address(0xBEEF), WINDOW);
        V3TwapFeed f = new V3TwapFeed(IV3PoolOracle(address(pool)), address(whsk), WINDOW);
        vm.expectRevert(InvalidConfiguration.selector);
        f.ratioAtTick(700_000);
    }

    function test_growIsPermissionless() public {
        MockV3Pool pool = new MockV3Pool(address(whsk), address(usdt));
        V3TwapFeed f = new V3TwapFeed(IV3PoolOracle(address(pool)), address(whsk), WINDOW);
        vm.prank(makeAddr("anyone"));
        f.grow(120);
        assertEq(pool.cardinalityNext(), 120);
    }
}
