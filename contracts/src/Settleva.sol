// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IReclaimVerifier.sol";
import "./ISettlementToken.sol";

contract Settleva {
    enum Status { None, Funded, Released, Refunded }

    struct Payment {
        address payer;
        address payee;
        address token;
        uint256 amount;
        uint64 expiry;
        bytes32 conditionHash;
        bytes32 providerHash;
        Status status;
    }

    mapping(bytes32 => Payment) public payments;
    mapping(bytes32 => bool) public usedProofIdentifiers;
    IReclaimVerifier public immutable verifier;
    address public immutable verificationSigner;

    error InvalidPayment();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidExpiry();
    error AlreadyExists();
    error NotPayer();
    error NotPayee();
    error NotExpired();
    error Expired();
    error InvalidStatus();
    error ConditionMismatch();
    error ProviderMismatch();
    error ProofAlreadyUsed();
    error InvalidVerificationSignature();
    error TokenTransferFailed();

    event PaymentCreated(bytes32 indexed paymentId, address indexed payer, address indexed payee, address token, uint256 amount, uint64 expiry, bytes32 conditionHash, bytes32 providerHash);
    event PaymentReleased(bytes32 indexed paymentId, address indexed payee, uint256 amount);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount);

    constructor(address verifier_, address verificationSigner_) {
        if (verifier_ == address(0) || verificationSigner_ == address(0)) revert InvalidAddress();
        verifier = IReclaimVerifier(verifier_);
        verificationSigner = verificationSigner_;
    }

    function createPayment(
        bytes32 paymentId,
        address payee,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 conditionHash,
        bytes32 providerHash
    ) external {
        if (paymentId == bytes32(0)) revert InvalidPayment();
        if (payee == address(0) || token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (conditionHash == bytes32(0) || providerHash == bytes32(0)) revert ConditionMismatch();
        if (payments[paymentId].status != Status.None) revert AlreadyExists();

        if (!ISettlementToken(token).transferFrom(msg.sender, address(this), amount)) revert TokenTransferFailed();

        payments[paymentId] = Payment({
            payer: msg.sender,
            payee: payee,
            token: token,
            amount: amount,
            expiry: expiry,
            conditionHash: conditionHash,
            providerHash: providerHash,
            status: Status.Funded
        });

        emit PaymentCreated(paymentId, msg.sender, payee, token, amount, expiry, conditionHash, providerHash);
    }

    function release(
        bytes32 paymentId,
        IReclaimVerifier.Proof calldata proof,
        bytes calldata verificationSignature
    ) external {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert InvalidStatus();
        if (block.timestamp >= payment.expiry) revert Expired();
        if (msg.sender != payment.payee) revert NotPayee();
        if (usedProofIdentifiers[proof.signedClaim.claim.identifier]) revert ProofAlreadyUsed();

        if (keccak256(bytes(proof.claimInfo.provider)) != payment.providerHash) revert ProviderMismatch();

        verifier.verifyProof(proof);

        bytes memory contextAddressBinding = bytes(
            string.concat('"contextAddress":"', _toHex(paymentId), '"')
        );
        bytes memory contextMessageBinding = bytes(
            string.concat('"contextMessage":"', _toHex(payment.conditionHash), '"')
        );
        bytes memory signedContext = bytes(proof.claimInfo.context);
        if (!_contains(signedContext, contextAddressBinding)) revert ConditionMismatch();
        if (!_contains(signedContext, contextMessageBinding)) revert ConditionMismatch();

        bytes32 attestationHash = keccak256(
            abi.encode(
                paymentId,
                payment.conditionHash,
                payment.providerHash,
                proof.signedClaim.claim.identifier
            )
        );
        if (_recoverSigner(attestationHash, verificationSignature) != verificationSigner) {
            revert InvalidVerificationSignature();
        }

        usedProofIdentifiers[proof.signedClaim.claim.identifier] = true;
        payment.status = Status.Released;

        if (!ISettlementToken(payment.token).transfer(payment.payee, payment.amount)) revert TokenTransferFailed();
        emit PaymentReleased(paymentId, payment.payee, payment.amount);
    }

    function verificationAttestationHash(
        bytes32 paymentId,
        bytes32 conditionHash,
        bytes32 providerHash,
        bytes32 proofIdentifier
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(paymentId, conditionHash, providerHash, proofIdentifier));
    }

    function _recoverSigner(bytes32 messageHash, bytes memory signature) private pure returns (address) {
        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);

        // secp256k1n / 2. Reject malleable high-s signatures.
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) {
            return address(0);
        }

        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        return ecrecover(digest, v, r, s);
    }

    function _contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || haystack.length < needle.length) return false;
        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool match_ = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }

    function _toHex(bytes32 value) private pure returns (string memory) {
        bytes memory buffer = new bytes(66);
        buffer[0] = "0";
        buffer[1] = "x";
        bytes16 symbols = "0123456789abcdef";
        for (uint256 i = 0; i < 32; i++) {
            buffer[2 + i * 2] = symbols[uint8(value[i] >> 4)];
            buffer[3 + i * 2] = symbols[uint8(value[i] & 0x0f)];
        }
        return string(buffer);
    }

    function refund(bytes32 paymentId) external {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert InvalidStatus();
        if (block.timestamp < payment.expiry) revert NotExpired();
        if (msg.sender != payment.payer) revert NotPayer();

        payment.status = Status.Refunded;
        if (!ISettlementToken(payment.token).transfer(payment.payer, payment.amount)) revert TokenTransferFailed();
        emit PaymentRefunded(paymentId, payment.payer, payment.amount);
    }
}
