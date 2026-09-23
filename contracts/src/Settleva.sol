// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IReclaimVerifier.sol";
import "./ISettlementToken.sol";

contract Settleva {
    enum Status {
        None,
        Funded,
        Released,
        Refunded
    }

    struct Payment {
        address payer;
        address payee;
        address token;
        uint256 amount;
        uint64 expiry;
        bytes32 conditionHash;
        Status status;
    }

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
    error TokenTransferFailed();

    mapping(bytes32 => Payment) public payments;
    IReclaimVerifier public immutable verifier;

    event PaymentCreated(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed payee,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 conditionHash
    );

    event PaymentReleased(bytes32 indexed paymentId, address indexed payee, uint256 amount);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount);

    constructor(address verifier_) {
        if (verifier_ == address(0)) revert InvalidAddress();
        verifier = IReclaimVerifier(verifier_);
    }

    function createPayment(
        bytes32 paymentId,
        address payee,
        address token,
        uint256 amount,
        uint64 expiry,
        bytes32 conditionHash
    ) external {
        if (paymentId == bytes32(0)) revert InvalidPayment();
        if (payee == address(0) || token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (conditionHash == bytes32(0)) revert ConditionMismatch();
        if (payments[paymentId].status != Status.None) revert AlreadyExists();

        if (!ISettlementToken(token).transferFrom(msg.sender, address(this), amount)) {
            revert TokenTransferFailed();
        }

        payments[paymentId] = Payment({
            payer: msg.sender,
            payee: payee,
            token: token,
            amount: amount,
            expiry: expiry,
            conditionHash: conditionHash,
            status: Status.Funded
        });

        emit PaymentCreated(
            paymentId,
            msg.sender,
            payee,
            token,
            amount,
            expiry,
            conditionHash
        );
    }

    function release(
        bytes32 paymentId,
        IReclaimVerifier.Proof calldata proof
    ) external {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert InvalidStatus();
        if (block.timestamp >= payment.expiry) revert Expired();
        if (msg.sender != payment.payee) revert NotPayee();

        verifier.verifyProof(proof);

        if (keccak256(bytes(proof.claimInfo.context)) != payment.conditionHash) {
            revert ConditionMismatch();
        }

        payment.status = Status.Released;

        if (!ISettlementToken(payment.token).transfer(payment.payee, payment.amount)) {
            revert TokenTransferFailed();
        }

        emit PaymentReleased(paymentId, payment.payee, payment.amount);
    }

    function refund(bytes32 paymentId) external {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert InvalidStatus();
        if (block.timestamp < payment.expiry) revert NotExpired();
        if (msg.sender != payment.payer) revert NotPayer();

        payment.status = Status.Refunded;

        if (!ISettlementToken(payment.token).transfer(payment.payer, payment.amount)) {
            revert TokenTransferFailed();
        }

        emit PaymentRefunded(paymentId, payment.payer, payment.amount);
    }
}
