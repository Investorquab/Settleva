// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReclaimVerifier {
    struct ClaimInfo {
        string provider;
        string parameters;
        string context;
    }

    struct CompleteClaimData {
        bytes32 identifier;
        address owner;
        uint32 timestampS;
        uint32 epoch;
    }

    struct SignedClaim {
        CompleteClaimData claim;
        bytes[] signatures;
    }

    struct Proof {
        ClaimInfo claimInfo;
        SignedClaim signedClaim;
    }

    function verifyProof(Proof calldata proof) external;
}
