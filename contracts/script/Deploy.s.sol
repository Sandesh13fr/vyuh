// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {IPolicy} from "../src/interfaces/IPolicy.sol";
import {IKycSBT} from "../src/interfaces/IKycSBT.sol";
import {ISwapRouterV3} from "../src/interfaces/ISwapRouterV3.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {OracleRegistry} from "../src/OracleRegistry.sol";
import {PolicyEngine} from "../src/PolicyEngine.sol";
import {VyuhVault} from "../src/VyuhVault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {HskSwapV3Adapter} from "../src/adapters/HskSwapV3Adapter.sol";
import {ArenaBounty} from "../src/arena/ArenaBounty.sol";
import {V3TwapFeed, IV3PoolOracle} from "../src/oracles/V3TwapFeed.sol";
import {SpendCapPolicy} from "../src/policies/SpendCapPolicy.sol";
import {AllowlistPolicy} from "../src/policies/AllowlistPolicy.sol";
import {OracleBandPolicy} from "../src/policies/OracleBandPolicy.sol";
import {SlippagePolicy} from "../src/policies/SlippagePolicy.sol";
import {DailyLossPolicy} from "../src/policies/DailyLossPolicy.sol";
import {KycTierPolicy} from "../src/policies/KycTierPolicy.sol";
import {CooldownPolicy} from "../src/policies/CooldownPolicy.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {MockAproFeed} from "../test/mocks/MockAproFeed.sol";
import {MockSwapRouter} from "../test/mocks/MockSwapRouter.sol";

/// @notice Deploys and wires Vyuh. Chain 177 uses the real HashKey contracts; any other chain
///         (testnet 133, anvil) gets MOCK USDT/WHSK/APRO feed/router, labelled in the output.
/// env: DEPLOYER_PRIVATE_KEY (required), AGENT_PRIVATE_KEY, ARENA_OPERATOR_PRIVATE_KEY, KYC_SBT,
///      ORACLE_MAX_AGE_SECS (default 3600), ARENA_BOUNTY_USDT (base units, default 5e6),
///      APRO_WHITELISTED (default false): APRO feeds reject non-whitelisted contract reads, so mainnet
///      uses a 30-min V3TwapFeed on the WHSK/USDT pool unless APRO has whitelisted the OracleRegistry.
contract Deploy is Script {
    address constant ROUTER = 0x1f3858C46F8F6fE76260b8208995D228C5cddc64;
    address constant WHSK = 0xB210D2120d57b758EE163cFfb43e73728c471Cf1;
    address constant USDT = 0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029;
    address constant USDC = 0x054ed45810DbBAb8B27668922D110669c9D88D0a;
    address constant APRO_HSK_USD = 0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b;
    address constant WHSK_USDT_POOL = 0xEB33d6666dd2359cB1BF6Ea6D72286Cc1b4a778A; // fee 500
    uint32 constant TWAP_WINDOW = 1800;
    uint16 constant TWAP_CARDINALITY = 200; // observation buffer so the TWAP can span the window as swaps accrue

    struct Deployed {
        MandateRegistry mandates;
        OracleRegistry oracle;
        KycTierPolicy kyc;
        PolicyEngine engine;
        HskSwapV3Adapter adapter;
        AgentRegistry agents;
        VaultFactory factory;
        ArenaBounty arena;
        address arenaVault;
        address usdt;
        address whsk;
        address router;
    }

    /// @dev APRO if whitelisted, else a permissionless pool TWAP (and grow the pool's observation buffer).
    function _mainnetWhskFeed() internal returns (address) {
        if (vm.envOr("APRO_WHITELISTED", false)) return APRO_HSK_USD;
        V3TwapFeed feed = new V3TwapFeed(IV3PoolOracle(WHSK_USDT_POOL), WHSK, TWAP_WINDOW);
        feed.grow(TWAP_CARDINALITY);
        return address(feed);
    }

    function run() external returns (Deployed memory d) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address agent = _addrFromKey("AGENT_PRIVATE_KEY");
        address arenaOperator = _addrFromKey("ARENA_OPERATOR_PRIVATE_KEY");
        address sbt = vm.envOr("KYC_SBT", address(0)); // unset = allowlist fallback
        bool mainnet = block.chainid == 177;

        vm.startBroadcast(pk);
        address whskFeed;
        (d.usdt, d.whsk, d.router, whskFeed) = mainnet ? (USDT, WHSK, ROUTER, _mainnetWhskFeed()) : _mocks();

        d.oracle = new OracleRegistry(deployer, vm.envOr("ORACLE_MAX_AGE_SECS", uint256(3600)));
        d.oracle.setAsset(d.usdt, address(0), true);
        d.oracle.setAsset(d.whsk, whskFeed, false);
        if (mainnet) d.oracle.setAsset(USDC, address(0), true);

        d.mandates = new MandateRegistry();
        d.kyc = new KycTierPolicy(deployer, IKycSBT(sbt));
        IPolicy[7] memory rings = [
            IPolicy(new SpendCapPolicy(d.oracle)), new AllowlistPolicy(), new OracleBandPolicy(d.oracle),
            new SlippagePolicy(d.oracle), new DailyLossPolicy(), d.kyc, new CooldownPolicy()
        ];
        d.engine = new PolicyEngine(d.mandates, d.oracle, rings);
        d.adapter = new HskSwapV3Adapter(ISwapRouterV3(d.router));
        VyuhVault impl = new VyuhVault(d.mandates, d.engine, d.adapter);
        d.agents = new AgentRegistry(deployer);
        d.factory = new VaultFactory(address(impl), d.agents);
        d.agents.setFactory(address(d.factory));

        d.arena = new ArenaBounty(deployer, IERC20(d.usdt), d.kyc, vm.envOr("ARENA_BOUNTY_USDT", uint256(5e6)));
        if (arenaOperator != address(0)) d.arena.setOperator(arenaOperator, true);
        // Deployer owns the arena vault; owner must pass the KYC ring, allowlisted while the SBT is unpublished.
        if (sbt == address(0)) d.kyc.setAllowedLevel(deployer, 1);
        if (agent != address(0) && agent != deployer) d.arenaVault = d.factory.createVault(deployer, agent);
        vm.stopBroadcast();

        _print(d, sbt, mainnet);
    }

    /// @dev MOCK assets for non-mainnet chains. Feed updatedAt=0 means always fresh.
    function _mocks() internal returns (address usdt, address whsk, address router, address feed) {
        MockERC20 u = new MockERC20("MOCK Tether USD", "mUSDT", 6);
        MockERC20 w = new MockERC20("MOCK Wrapped HSK", "mWHSK", 18);
        MockSwapRouter r = new MockSwapRouter();
        r.setRate(address(u), address(w), 2e30); // 1 mUSDT -> 2 mWHSK ($0.50)
        r.setRate(address(w), address(u), 5e5);
        return (address(u), address(w), address(r), address(new MockAproFeed(8, 0.5e8)));
    }

    function _addrFromKey(string memory name) internal view returns (address) {
        uint256 k = vm.envOr(name, uint256(0));
        return k == 0 ? address(0) : vm.addr(k);
    }

    function _line(string memory k, address v) internal pure {
        console2.log(string.concat(k, "=", v == address(0) ? "" : vm.toString(v)));
    }

    function _print(Deployed memory d, address sbt, bool mainnet) internal view {
        console2.log(string.concat("# Vyuh deploy, chain ", vm.toString(block.chainid), mainnet ? "" : " (MOCK assets)"));
        _line("MANDATE_REGISTRY", address(d.mandates));
        _line("POLICY_ENGINE", address(d.engine));
        _line("VAULT_FACTORY", address(d.factory));
        _line("AGENT_REGISTRY", address(d.agents));
        _line("ARENA_BOUNTY", address(d.arena));
        _line("ARENA_VAULT", d.arenaVault);
        _line("KYC_SBT", sbt);
        _line("ORACLE_REGISTRY", address(d.oracle));
        _line("KYC_POLICY", address(d.kyc));
        _line("EXECUTION_ADAPTER", address(d.adapter));
        if (!mainnet) {
            _line("MOCK_USDT", d.usdt);
            _line("MOCK_WHSK", d.whsk);
            _line("MOCK_SWAP_ROUTER", d.router);
        }
    }
}
