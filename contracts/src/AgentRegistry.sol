// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Unauthorized, InvalidAddress, InvalidConfiguration} from "./types/VyuhTypes.sol";
import {IVyuhVault} from "./interfaces/IVyuhVault.sol";
contract AgentRegistry is Ownable {
    struct Agent { address operator; string metadataURI; int256 pnl; }
    mapping(bytes32 => Agent) public agents;
    mapping(address => bool) public vaults;
    address public factory;
    event AgentRegistered(bytes32 indexed agentId, address indexed operator, string metadataURI);
    event PnlRecorded(bytes32 indexed agentId, address indexed vault, int256 delta);
    constructor(address admin) Ownable(admin) {}
    /// @notice Fix the factory once; vault callers are admitted only by that factory.
    function setFactory(address factory_) external onlyOwner {
        if (factory != address(0) || factory_.code.length == 0) revert InvalidConfiguration();
        factory = factory_;
    }
    /// @notice Admit a newly created clone.
    function authorizeVault(address vault) external {
        if (msg.sender != factory) revert Unauthorized();
        vaults[vault] = true;
    }
    /// @notice Register a unique ID for the caller's operator address.
    function register(bytes32 agentId, address operator, string calldata metadataURI) external {
        if (operator == address(0)) revert InvalidAddress();
        if (msg.sender != operator) revert Unauthorized();
        if (agents[agentId].operator != address(0)) revert InvalidConfiguration();
        agents[agentId] = Agent(operator, metadataURI, 0);
        emit AgentRegistered(agentId, operator, metadataURI);
    }
    /// @notice Record oracle-valued P&L from an admitted vault for its own agent.
    function recordPnl(bytes32 agentId, int256 delta) external {
        if (!vaults[msg.sender] || agents[agentId].operator != IVyuhVault(msg.sender).agent()) revert Unauthorized();
        agents[agentId].pnl += delta;
        emit PnlRecorded(agentId, msg.sender, delta);
    }
}
