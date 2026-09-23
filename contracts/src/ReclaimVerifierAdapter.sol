// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IReclaimVerifier.sol";

contract ReclaimVerifierAdapter {
    error InvalidVerifier();
    error ProviderMismatch();
    error ContextMismatch();

    IReclaimVerifier public immutable verifier;

    constructor(address verifier_) {
        if (verifier_ == address(0)) revert InvalidVerifier();
        verifier = IReclaimVerifier(verifier_);
    }

    function verify(
        IReclaimVerifier.Proof calldata proof,
        string calldata expectedProvider,
        bytes32 expectedContextHash
    ) external {
        if (keccak256(bytes(proof.claimInfo.provider)) != keccak256(bytes(expectedProvider))) {
            revert ProviderMismatch();
        }

        verifier.verifyProof(proof);

        if (keccak256(bytes(proof.claimInfo.context)) != expectedContextHash) {
            revert ContextMismatch();
        }
    }
}
