// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ISettlementToken.sol";

/// @notice Escrows ERC-20 payments and releases them only with a backend attestation.
/// @dev Reclaim proof verification and semantic condition evaluation happen off-chain.
/// The attestation signer is a deliberate trust boundary and must be secured accordingly.
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
    error ProofAlreadyUsed();
    error InvalidProofIdentifier();
    error InvalidVerificationSignature();
    error TokenTransferFailed();

    event PaymentCreated(bytes32 indexed paymentId, address indexed payer, address indexed payee, address token, uint256 amount, uint64 expiry, bytes32 conditionHash, bytes32 providerHash);
    event PaymentReleased(bytes32 indexed paymentId, address indexed payee, uint256 amount, bytes32 indexed proofIdentifier);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount);

    constructor(address verificationSigner_) {
        if (verificationSigner_ == address(0)) revert InvalidAddress();
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
        if (conditionHash == bytes32(0) || providerHash == bytes32(0)) revert InvalidPayment();
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

    /// @notice Release a funded payment using an attestation from the configured verifier service.
    /// @dev The signed digest commits to paymentId, the stored conditionHash/providerHash, and proofIdentifier.
    function release(
        bytes32 paymentId,
        bytes32 proofIdentifier,
        bytes calldata verificationSignature
    ) external {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert InvalidStatus();
        if (block.timestamp >= payment.expiry) revert Expired();
        if (msg.sender != payment.payee) revert NotPayee();
        if (proofIdentifier == bytes32(0)) revert InvalidProofIdentifier();
        if (usedProofIdentifiers[proofIdentifier]) revert ProofAlreadyUsed();

        bytes32 attestationHash = keccak256(
            abi.encode(paymentId, payment.conditionHash, payment.providerHash, proofIdentifier)
        );
        if (_recoverSigner(attestationHash, verificationSignature) != verificationSigner) {
            revert InvalidVerificationSignature();
        }

        usedProofIdentifiers[proofIdentifier] = true;
        payment.status = Status.Released;

        if (!ISettlementToken(payment.token).transfer(payment.payee, payment.amount)) revert TokenTransferFailed();
        emit PaymentReleased(paymentId, payment.payee, payment.amount, proofIdentifier);
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
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) return address(0);

        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        return ecrecover(digest, v, r, s);
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
