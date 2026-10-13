# Settleva V1 Security Boundaries

**Scope:** Product architecture and the current SDK/contract integration boundaries. This is an engineering security note, not a third-party audit or proof of production deployment.

## Key ownership

- A developer uses their own application and wallet provider. The SDK prepares calls but should never require the developer to share a private key with the SDK or website.
- Each integrator can deploy its own Settleva contract instance and select the instance's verifier at deployment. The verifier private key belongs only in that integrator's trusted server-side secret manager; it must never be placed in browser code, a NEXT_PUBLIC environment variable, a public repository or chat.
- Keep deployment and verifier keys distinct. The current contract's verifier address is immutable; replacing it requires a replacement contract instance.
- The contract enforces on-chain payment lifecycle rules and only accepts an attestation from its configured verifier. This is backend-attested settlement, not trustless on-chain verification of external evidence.

## Payment integrity

- The condition, provider identity/version, expiry and payment parameters are committed when a payment is created.
- A new escrow can use a different condition without redeploying the contract. The current contract does not allow editing the terms of an already-funded payment in place.
- A verification integration must establish the outcome from an authoritative source, bind it to the funded payment and exact condition, protect against replay, and issue the attestation only after validation.
- The current policy operator is exact equality (equals). Do not interpret a matching client-supplied JSON value as source proof.

## Four demo scenarios

Gaming rewards, freelance milestones, conditional commerce and agentic economy are website/playground simulations. Each requires its own authoritative source integration and real positive/negative acceptance tests before being described as production-enabled. A green test suite or ready website does not prove a real Arc USDC settlement.

## Deferred Reclaim work

Reclaim/GitHub deployment proof is not part of V1's required runtime path. Its former implementation, tests, provider notes, and historical Reclaim security review are preserved under [Future Integrations: Reclaim](../future-integrations/reclaim/README.md). That archived review describes the implementation at its original baseline; it does not certify the current V1 or a deployed system.

## Acceptance before using real funds

Before a use case is described as production-enabled, verify the exact deployed contract and immutable verifier, validate the authoritative source and its failure cases, confirm persistent replay protection, complete a controlled low-value Arc USDC funding → verified evidence → attestation → release flow, and separately exercise invalid/replayed evidence and expiry/refund behavior.
