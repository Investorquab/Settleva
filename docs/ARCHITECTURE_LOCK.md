# SETTLEVA ARCHITECTURE LOCK - WORKING DRAFT

## 1. Invariant

A payment can settle only when submitted evidence satisfies the exact condition hash committed when the payment was funded.

## 2. Components

Application
-> SDK
-> condition engine
-> payment API
-> proof provider
-> verification engine
-> settlement contract
-> USDC.

The application and serverless API never hold unilateral withdrawal authority.

## 3. Condition

A condition is versioned structured data:

- version
- provider
- ordered set of typed claims
- expiry

Canonical form is deterministic JSON with claims sorted by field. The canonical bytes are hashed before funding. The resulting digest is immutable for that payment.

The implementation must use one hash algorithm consistently across TypeScript and Solidity. The current TypeScript foundation uses SHA-256 as a provisional implementation. Before contract implementation this must be reconciled with Solidity-native hashing and finalized.

## 4. Payment state machine

CREATED -> FUNDED -> WAITING_FOR_PROOF
WAITING_FOR_PROOF -> PROOF_SUBMITTED -> VERIFYING
VERIFYING -> SETTLED
VERIFYING -> WAITING_FOR_PROOF
FUNDED/WAITING_FOR_PROOF -> EXPIRED -> REFUNDED

Terminal states: SETTLED, REFUNDED.

The contract must reject every transition not explicitly permitted.

## 5. Settlement authorization

The contract must never accept an arbitrary boolean from the backend.

A release authorization must bind:

- payment id
- condition hash
- proof identifier
- verification result
- expiry
- replay protection

The exact authorization mechanism will be finalized after the Reclaim proof structure is pinned. Preferred direction is direct on-chain proof verification where practical, with Settleva contract logic checking the verified claims against the committed condition.

## 6. Evidence

Evidence contains:

- provider identifier
- proof identifier
- condition hash/context binding
- verified claims
- provider proof payload/reference

A normal GitHub API response is evidence input, not cryptographic proof.

Reclaim's Solidity integration supports EVM contracts that call its verifier and lets application logic inspect proof context. This makes a self-deployed verifier integration technically viable, but the exact Arc deployment and package/version must be verified before implementation.

## 7. Trust boundaries

Trusted:

- deployed Settleva contract code
- cryptographic verifier rules
- committed condition hash
- Arc consensus
- configured provider/verifier keys according to provider protocol

Not trusted:

- frontend
- payer-supplied evidence
- recipient-supplied evidence
- arbitrary backend boolean
- arbitrary URLs
- mutable condition data after funding

## 8. Replay and duplicate protection

Each payment has a unique id.

The contract must track settlement and refund completion. A proof identifier must not be reusable for another settlement of the same payment. Expiry and settlement operations must be mutually exclusive.

## 9. Expiry

After expiry, no proof may settle the payment. A refund operation moves the payment to REFUNDED exactly once.

## 10. Next implementation gate

Before Settleva.sol:

1. Pin the Reclaim Solidity SDK version.
2. Confirm its proof struct and verifier interface.
3. Confirm Arc testnet RPC/chain configuration.
4. Deploy and verify a minimal Reclaim verifier integration on Arc testnet.
5. Produce one real proof verification transaction.
6. Only then bind Settleva settlement authorization to the verified result.

## Research basis

Reclaim's current Solidity documentation says its verifier can be integrated into an EVM smart contract, with business logic executed after verifyProof succeeds. It also documents using proof context for application-specific checks.

Source: https://docs.reclaimprotocol.org/onchain/solidity/quickstart
