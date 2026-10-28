// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {Intent, Mandate, ReasonCode, PolicyViolation} from "../src/types/VyuhTypes.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {OracleRegistry} from "../src/OracleRegistry.sol";
import {PolicyEngine} from "../src/PolicyEngine.sol";
import {VyuhVault} from "../src/VyuhVault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {HskSwapV3Adapter} from "../src/adapters/HskSwapV3Adapter.sol";
import {SpendCapPolicy} from "../src/policies/SpendCapPolicy.sol";
import {AllowlistPolicy} from "../src/policies/AllowlistPolicy.sol";
import {OracleBandPolicy} from "../src/policies/OracleBandPolicy.sol";
import {SlippagePolicy} from "../src/policies/SlippagePolicy.sol";
import {DailyLossPolicy} from "../src/policies/DailyLossPolicy.sol";
import {KycTierPolicy} from "../src/policies/KycTierPolicy.sol";
import {CooldownPolicy} from "../src/policies/CooldownPolicy.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAproFeed} from "./mocks/MockAproFeed.sol";
import {MockKycSBT} from "./mocks/MockKycSBT.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";

/// @dev Full stack on mocks: USDT (stable, 6 dp), WHSK ($0.50, 18 dp), EVIL ($1, never allowlisted).
abstract contract Fixture is Test {
    uint256 internal constant OWNER_PK = 0xA11CE;
    address internal owner = vm.addr(OWNER_PK);
    address internal agent = makeAddr("agent");
    address internal stranger = makeAddr("stranger");

    MockERC20 internal usdt;
    MockERC20 internal whsk;
    MockERC20 internal evil;
    MockAproFeed internal whskFeed;
    MockAproFeed internal evilFeed;
    MockKycSBT internal sbt;
    MockSwapRouter internal router;
    OracleRegistry internal oracle;
    MandateRegistry internal mandates;
    PolicyEngine internal engine;
    KycTierPolicy internal kyc;
    AgentRegistry internal agents;
    VaultFactory internal factory;
    VyuhVault internal vault;

    function setUp() public virtual {
        vm.warp(1_750_000_000);
        usdt = new MockERC20("Tether USD", "USDT", 6);
        whsk = new MockERC20("Wrapped HSK", "WHSK", 18);
        evil = new MockERC20("Evil", "EVIL", 18);
        whskFeed = new MockAproFeed(8, 0.5e8);
        evilFeed = new MockAproFeed(8, 1e8);
        whskFeed.set(0.5e8, block.timestamp);
        evilFeed.set(1e8, block.timestamp);

        oracle = new OracleRegistry(address(this), 1 hours);
        oracle.setAsset(address(usdt), address(0), true);
        oracle.setAsset(address(whsk), address(whskFeed), false);
        oracle.setAsset(address(evil), address(evilFeed), false);

        sbt = new MockKycSBT();
        sbt.set(owner, true, 2);
        mandates = new MandateRegistry();
        kyc = new KycTierPolicy(address(this), sbt);
        IPolicy[7] memory rings = [
            IPolicy(new SpendCapPolicy(oracle)), new AllowlistPolicy(), new OracleBandPolicy(oracle),
            new SlippagePolicy(oracle), new DailyLossPolicy(), kyc, new CooldownPolicy()
        ];
        engine = new PolicyEngine(mandates, oracle, rings);

        router = new MockSwapRouter();
        router.setRate(address(usdt), address(whsk), 2e30); // 1 USDT -> 2 WHSK
        router.setRate(address(whsk), address(usdt), 5e5); // 1 WHSK -> 0.5 USDT
        router.setRate(address(usdt), address(evil), 1e30);
        HskSwapV3Adapter adapter = new HskSwapV3Adapter(router);
        VyuhVault impl = new VyuhVault(mandates, engine, adapter);
        agents = new AgentRegistry(address(this));
        factory = new VaultFactory(address(impl), agents);
        agents.setFactory(address(factory));
        vault = VyuhVault(factory.createVault(owner, agent));

        _setMandate(_mandate(1));
        usdt.mint(address(vault), 10_000e6);
    }

    function _mandate(uint64 version) internal view returns (Mandate memory m) {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdt);
        tokens[1] = address(whsk);
        m = Mandate({
            owner: owner, agent: agent, maxTradeUsd: 1_000e18, maxPositionUsd: 5_000e18,
            maxSlippageBps: 100, oracleBandBps: 200, dailyLossBps: 500, cooldownSecs: 60,
            minKycLevel: 1, expiry: uint64(block.timestamp + 30 days), version: version, allowedTokens: tokens
        });
    }

    function _sign(uint256 pk, Mandate memory m) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, mandates.mandateDigest(m));
        return abi.encodePacked(r, s, v);
    }

    function _setMandate(Mandate memory m) internal {
        bytes memory sig = _sign(OWNER_PK, m);
        vm.prank(owner);
        mandates.setMandate(address(vault), m, sig);
    }

    /// @dev Default intent: 100 USDT -> WHSK at the oracle price minus 0.5%.
    function _intent() internal view returns (Intent memory) {
        return _intent(address(usdt), address(whsk), 100e6, 199e18);
    }

    function _intent(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        internal view returns (Intent memory)
    {
        return Intent({
            vault: address(vault), tokenIn: tokenIn, tokenOut: tokenOut, amountIn: amountIn,
            minAmountOut: minOut, fee: 3000, deadline: uint64(block.timestamp + 300),
            nonce: vault.nonce(), reasoningHash: keccak256("reasoning")
        });
    }

    function _expectViolation(ReasonCode code, uint8 ring) internal {
        vm.expectRevert(abi.encodeWithSelector(PolicyViolation.selector, code, ring));
    }

    function _check(Intent memory i) internal returns (ReasonCode code, uint8 ring) {
        vm.prank(agent);
        (code, ring) = engine.checkIntent(i);
    }
}
