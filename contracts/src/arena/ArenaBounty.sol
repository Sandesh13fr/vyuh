// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {KycTierPolicy} from "../policies/KycTierPolicy.sol";
import {ReasonCode, VyuhEvents, Unauthorized, InvalidAddress, InvalidAttempt, AlreadyPaid} from "../types/VyuhTypes.sol";
contract ArenaBounty is Ownable, ReentrancyGuard, VyuhEvents {
    using SafeERC20 for IERC20;
    struct Attempt { address attacker; ReasonCode code; bool paid; }
    IERC20 public immutable token;
    KycTierPolicy public immutable kyc;
    uint256 public immutable tier1Bounty;
    mapping(address => bool) public operators;
    mapping(bytes32 => Attempt) public attempts;
    event OperatorSet(address indexed operator, bool enabled);
    constructor(address admin, IERC20 token_, KycTierPolicy kyc_, uint256 bounty) Ownable(admin) {
        if (address(token_).code.length == 0 || address(kyc_).code.length == 0 || bounty == 0) revert InvalidAddress();
        token = token_; kyc = kyc_; tier1Bounty = bounty;
    }
    modifier onlyOperator() { if (!operators[msg.sender]) revert Unauthorized(); _; }
    /// @notice Assign the operator that attests malicious blocked intents.
    function setOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) revert InvalidAddress();
        operators[operator] = enabled; emit OperatorSet(operator, enabled);
    }
    /// @notice Record a unique free attempt; no fee or stake is accepted.
    function recordAttempt(bytes32 id, address attacker, bytes32 promptHash, bytes32 intentHash, ReasonCode code)
        external onlyOperator
    {
        if (id == bytes32(0) || attacker == address(0) || attempts[id].attacker != address(0)) revert InvalidAttempt();
        attempts[id] = Attempt(attacker, code, false);
        emit AttemptRecorded(id, attacker, promptHash, intentHash, code);
    }
    /// @notice Pay the fixed bounty once for a policy-ring rejection and currently eligible attacker.
    function payTier1(bytes32 id) external onlyOperator nonReentrant {
        Attempt storage a = attempts[id];
        if (a.attacker == address(0) || uint8(a.code) < uint8(ReasonCode.SPEND_CAP)) revert InvalidAttempt();
        if (a.paid) revert AlreadyPaid();
        if (!kyc.eligible(a.attacker, 1)) revert Unauthorized();
        a.paid = true;
        token.safeTransfer(a.attacker, tier1Bounty);
        emit BountyPaid(id, a.attacker, tier1Bounty);
    }
    /// @notice Fund the bug-bounty pot from the owner's approved balance.
    function fund(uint256 amount) external onlyOwner nonReentrant { token.safeTransferFrom(msg.sender, address(this), amount); }
    /// @notice Withdraw unused pot funds to the owner.
    function withdraw(uint256 amount) external onlyOwner nonReentrant { token.safeTransfer(owner(), amount); }
}
