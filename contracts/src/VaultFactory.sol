// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IVyuhVault} from "./interfaces/IVyuhVault.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {InvalidAddress} from "./types/VyuhTypes.sol";
contract VaultFactory {
    address public immutable implementation;
    AgentRegistry public immutable agentRegistry;
    mapping(address => bool) public isVault;
    event VaultCreated(address indexed vault, address indexed owner, address indexed agent);
    constructor(address implementation_, AgentRegistry agentRegistry_) {
        if (implementation_.code.length == 0) revert InvalidAddress();
        implementation = implementation_; agentRegistry = agentRegistry_;
    }
    /// @notice Atomically create and initialize a non-custodial EIP-1167 clone.
    function createVault(address owner, address agent) external returns (address vault) {
        vault = Clones.clone(implementation);
        IVyuhVault(vault).initialize(owner, agent);
        isVault[vault] = true;
        agentRegistry.authorizeVault(vault);
        emit VaultCreated(vault, owner, agent);
    }
}
