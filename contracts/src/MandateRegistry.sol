// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Mandate, VyuhEvents, Unauthorized, InvalidMandate, InvalidSignature, InvalidVersion, NotTighter} from "./types/VyuhTypes.sol";
import {IVyuhVault} from "./interfaces/IVyuhVault.sol";

contract MandateRegistry is EIP712, ReentrancyGuard, VyuhEvents {
    bytes32 public constant MANDATE_TYPEHASH = keccak256(
        "Mandate(address owner,address agent,uint256 maxTradeUsd,uint256 maxPositionUsd,uint16 maxSlippageBps,uint16 oracleBandBps,uint16 dailyLossBps,uint32 cooldownSecs,uint8 minKycLevel,uint64 expiry,uint64 version,address[] allowedTokens)"
    );
    mapping(address => Mandate) private mandates;
    // The canonical signed struct has no vault field; consume each digest once across vaults.
    mapping(bytes32 => bool) public usedSignatures;

    constructor() EIP712("Vyuh", "1") {}

    /// @notice Hash a mandate with EIP-712's padded array-element encoding.
    function hashMandate(Mandate calldata m) public pure returns (bytes32) {
        return keccak256(bytes.concat(
            abi.encode(MANDATE_TYPEHASH, m.owner, m.agent, m.maxTradeUsd, m.maxPositionUsd,
                m.maxSlippageBps, m.oracleBandBps),
            abi.encode(m.dailyLossBps, m.cooldownSecs, m.minKycLevel, m.expiry, m.version,
                keccak256(abi.encodePacked(m.allowedTokens)))
        ));
    }

    /// @notice Digest owners sign for this registry and chain.
    function mandateDigest(Mandate calldata m) external view returns (bytes32) {
        return _hashTypedDataV4(hashMandate(m));
    }

    /// @notice Install an owner-signed mandate with a strictly newer version.
    function setMandate(address vault, Mandate calldata m, bytes calldata sig) external nonReentrant {
        _validate(vault, m);
        bytes32 digest = _hashTypedDataV4(hashMandate(m));
        if (usedSignatures[digest] || !SignatureChecker.isValidSignatureNow(m.owner, digest, sig)) {
            revert InvalidSignature();
        }
        // Only the vault owner or its agent can select the target of a relayed signature.
        if (msg.sender != m.owner && msg.sender != m.agent) revert Unauthorized();
        usedSignatures[digest] = true;
        _store(vault, m, false);
    }

    /// @notice Agents can reduce permissions, never increase them.
    function tighten(address vault, Mandate calldata m) external nonReentrant {
        Mandate storage old = mandates[vault];
        if (msg.sender != old.agent || old.owner == address(0)) revert Unauthorized();
        _validate(vault, m);
        if (m.owner != old.owner || m.agent != old.agent || m.maxTradeUsd > old.maxTradeUsd
            || m.maxPositionUsd > old.maxPositionUsd || m.maxSlippageBps > old.maxSlippageBps
            || m.oracleBandBps > old.oracleBandBps || m.dailyLossBps > old.dailyLossBps
            || m.cooldownSecs < old.cooldownSecs || m.minKycLevel < old.minKycLevel
            || m.expiry > old.expiry) revert NotTighter();
        for (uint256 i; i < m.allowedTokens.length; ++i) {
            bool found;
            for (uint256 j; j < old.allowedTokens.length; ++j) {
                if (m.allowedTokens[i] == old.allowedTokens[j]) { found = true; break; }
            }
            if (!found) revert NotTighter();
        }
        _store(vault, m, true);
    }

    /// @notice Return the current mandate; owner is zero before the first signature.
    function getMandate(address vault) external view returns (Mandate memory) { return mandates[vault]; }

    function _validate(address vault, Mandate calldata m) private view {
        if (m.owner == address(0) || m.agent == address(0) || vault.code.length == 0
            || IVyuhVault(vault).owner() != m.owner || IVyuhVault(vault).agent() != m.agent
            || m.maxSlippageBps > 10_000 || m.oracleBandBps > 10_000
            || m.dailyLossBps > 10_000 || m.minKycLevel > 4
            || m.expiry <= block.timestamp || m.allowedTokens.length > 32) revert InvalidMandate();
        if (m.version <= mandates[vault].version) revert InvalidVersion();
        for (uint256 i; i < m.allowedTokens.length; ++i) {
            if (m.allowedTokens[i].code.length == 0) revert InvalidMandate();
            for (uint256 j; j < i; ++j) {
                if (m.allowedTokens[i] == m.allowedTokens[j]) revert InvalidMandate();
            }
        }
    }

    function _store(address vault, Mandate calldata m, bool tightened) private {
        mandates[vault] = m;
        IVyuhVault(vault).trackTokens(m.allowedTokens);
        emit MandateSet(vault, hashMandate(m), m.version, tightened);
    }
}
