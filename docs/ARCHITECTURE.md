# Settleva Architecture

## Core invariant

A payment may settle only when evidence satisfies the exact condition committed when the payment was funded, the backend's verification rules pass, and the contract accepts a payment-bound settlement attestation.

## Components

1. **Application:** owns product-specific UI, identity and business workflow.
2. **SDK:** validates payment inputs, canonicalizes a policy, prepares payment ID/condition hash/provider hash/proof context, converts amounts to atomic units, and builds viem-compatible contract calls.
3. **Condition engine:** canonicalizes versioned policies and evaluates verified claims deterministically. The initial operator set is intentionally limited to exact equality.
4. **Evidence provider:** obtains claims from a source authoritative for the use case. A successful API response is not automatically cryptographic proof.
5. **Verification backend:** verifies provider/version and proof data, binds claims to the initiated session and committed context, enforces persistent replay protection, checks the live Arc payment record and signs a settlement attestation.
6. **Settleva contract on Arc:** one shared contract records each payment, locks only the canonical Arc USDC ERC-20 interface, verifies signed release authorization, enforces expiry/refund rules and prevents proof replay.

## Flow

Application -> SDK prepares immutable payment/policy commitment -> contract locks USDC -> evidence provider returns proof -> backend verifies provider/session/context/claims -> backend confirms the on-chain payment is Funded and its condition hash, provider hash and expiry match -> backend signs a payment-bound attestation -> payee submits release -> contract validates the attestation and payment state.

The backend repeats the on-chain payment check at proof request time and immediately before issuing an attestation. Missing configuration, unavailable RPC, an unknown payment, non-Funded state, an expired payment or mismatch between stored and submitted condition/provider/expiry fails closed. The contract remains the final authority for release/refund state.

## Shared contract and use cases

Gaming, freelance milestone, conditional commerce and agentic task payments use the same Settleva contract. Each payment has its own ID, token, amount, expiry, condition hash and provider hash. Different use cases need their own trusted evidence adapters and policies—not a separate contract deployment. USDC is an existing token contract and is not deployed by Settleva.

The live verification pipeline is provider-neutral. Each payment condition pins the exact Reclaim provider ID and version; a server-side adapter registry maps provider-specific request parameters and extracted fields to the condition’s canonical claim fields. The legacy single-provider GitHub deployment adapter remains available when the condition contains the exact five GitHub deployment claims and its provider ID/version matches `RECLAIM_PROVIDER_ID` and `RECLAIM_PROVIDER_VERSION`. Additional adapters must be explicitly listed in `SETTLEVA_RECLAIM_ADAPTERS` and resolved by exact provider ID/version. Unknown providers, malformed mappings, duplicate canonical claim values, and incomplete evidence fail closed.

Example server-side configuration (replace every example identifier and field with a real, reviewed Reclaim provider definition; this example is not a working provider):

```json
[
  {
    "providerId": "published-reclaim-provider-id",
    "providerVersion": "1.0.0",
    "kind": "mapped",
    "requestParameters": { "order.id": "order_id_input" },
    "claimFields": {
      "delivery_status_result": "delivery.status",
      "order_id_result": "order.id"
    }
  }
]
```

`requestParameters` maps a condition field to a Reclaim dynamic request parameter; those values are request inputs, not evidence. `claimFields` separately maps provider-extracted response fields to canonical condition fields. The registry rejects reuse of a request parameter as evidence. Each mapping is only as trustworthy as the pinned Reclaim provider definition and its underlying authoritative source; a successful API response, client JSON, browser boolean, or playground result is not proof.

The source-signed path is separate from Reclaim: `POST /api/evidence/attest` accepts a timestamped Ed25519 signature over the exact raw event body from a server-side authoritative source. It verifies the public key registered for the exact provider ID/version, exact condition/claim fields, funded Arc payment, deployed verifier signer, and PostgreSQL replay binding before issuing the same attestation format. It does not itself submit a release transaction, and it is not connected to the existing `/live` console UI.

The gaming, freelance, commerce and agentic examples remain illustrative until an actual authoritative source is connected, its server-side public key (for the signed path) or published Reclaim provider (for Reclaim) is configured, and positive/negative real-source evidence tests plus a low-value Arc settlement have passed. Mapping tests and source-signature unit tests validate code boundaries only; they do not claim that live integrations for those scenarios exist.

## Policy and SDK invariants

- A condition must have version `1.0`, a non-empty provider and provider version, a future expiry, and at least one well-formed claim.
- Claim fields must be unique; the current operator is `equals`.
- The payment expiry equals `condition.expiresAt`.
- Human-readable token amounts are normalized before payment ID derivation; conversion to atomic units validates token decimals.
- Canonical condition hashes and proof contexts are deterministic.
- Transaction-call helpers only prepare typed viem arguments; the host app's wallet still signs/submits transactions.

## Trust boundaries

- Frontend input is untrusted and has no settlement authority.
- Payer/payee-submitted JSON does not prove a real-world event occurred.
- The provider identity/version, verified claims, session binding and context must match the commitment.
- Replay/session bindings use persistent storage and atomic conflict handling; partial replay claims must roll back.
- Provider credentials and signing keys remain server-side.
- The current contract trusts its configured backend verification signer. It does not directly verify a Reclaim proof on-chain.
- Refund eligibility is determined by contract state and expiry, not by the website's simulated state.

## Developer experience

The approved landing page explains the flow and four use cases. Its guided/developer playground uses the shared condition canonicalizer and evaluator but is simulation-only. The independent `/live` route is the actual wallet path: it checks the deployed USDC allowlist, funds the contract, creates the payment-bound Reclaim request from the committed GitHub deployment values, and permits the payee to submit the attested release or the payer to refund after expiry. A real published provider and deployed server-side configuration are required; the route must not be presented as live until a real proof-to-release transaction succeeds.

## Production readiness

Production settlement requires a reviewed contract, a verified signer configuration, a deployed backend/database, configured Arc mainnet RPC and contract address, a working authoritative evidence adapter, persistent replay protection, and a controlled low-value end-to-end test. A green CI run validates code and test assertions; it does not alone prove mainnet configuration or live provider behavior.
