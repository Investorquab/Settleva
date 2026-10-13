# Architecture Lock — Settleva

**Status:** Binding product and implementation decisions for V1.

## 1. Product and deployment model

Settleva is developer infrastructure. The SDK and reusable contract code are the product; the website is a demonstration and onboarding surface, not a hosted escrow product.

- Keep one canonical Settleva.sol implementation in the repository.
- Each integrator may deploy its own contract instance for its own application and choose the verifier address at construction time.
- The Settleva demo deployment is only one example instance. Integrators must not be forced to use a Settleva-controlled verifier.
- Integrators control their deployment wallet and verification backend/key. Deployment keys and verifier private keys must stay server-side and separate.
- The browser playground remains simulation-only and does not ask for private keys or imply real evidence verification.

## 2. Payment condition and lifecycle

A condition belongs to an individual payment. Each call to createPayment supplies that payment's ID, payee, supported token, amount, expiry, condition hash and provider hash. A different new payment may use a different condition without redeploying any contract.

The current contract does not support editing the condition or terms of an already funded payment in place. Its lifecycle is None → Funded → Released or None → Funded → Refunded. Release requires a valid payment-bound attestation before expiry; the payer can refund at or after expiry. If a product needs amendment or cancellation before expiry, add an explicit, reviewed contract operation rather than assuming edits are supported.

A contract redeployment is a deployment-level action: for example, deploying a new contract implementation or changing the current contract's immutable verificationSigner. It is not part of ordinary payment creation.

## 3. Canonical commitments and supported policy

- A version-1.0 condition contains a provider ID, provider version, expiry, and one or more unique-field claims.
- The currently supported operator is exact string equality (equals).
- Claims are sorted deterministically and hashed as EVM-native keccak256 over canonical JSON.
- Payment expiry equals condition.expiresAt.
- The supported escrow asset is Arc USDC's ERC-20 interface 0x3600000000000000000000000000000000000000 with six decimals. Native Arc USDC gas/value uses 18 decimals.

## 4. Verification trust boundary

The contract uses backend-attested settlement. The authority that signs release attestations is the verifier address fixed in a contract instance. The integrator deploying its own instance can control that address and operate the matching signer in its own trusted backend.

The SDK builds payment commitments and contract calls; it does not custody funds, prove external events, sign wallet transactions, or automatically decide whether a provider is truthful. A verification integration must validate an authoritative outcome, bind it to the funded payment/condition, enforce replay protection, and sign only after checks pass. The contract enforces on-chain authorization, payment state, payee, expiry and refund rules.

Never put private keys in browser code. The user’s wallet should sign its own approval/funding calls through the application’s wallet client; the verifier signing key belongs only in that integrator’s trusted server-side environment.

## 5. Four scenario demos and evidence scope

The website demonstrates gaming rewards, freelance milestones, conditional commerce and agentic economy through local sample policies and evidence. These scenarios are not evidence providers themselves and are not automatically live integrations.

A source-signed backend protocol exists as a general integration boundary, but each source system must independently establish the truth of its outcome, hold its signing key securely, and pass positive, negative, replay and real-settlement tests before being described as production-enabled.

Reclaim/GitHub proof is deferred. Its existing implementation and tests are preserved under future-integrations/reclaim/ for judges and future work. Reclaim is not a required runtime dependency for the website demonstrations or base SDK.

## 6. SDK distribution

The independently installable package is the target developer experience. @settleva/conditions must be published before @settleva/sdk because the SDK depends on it. Repository metadata is prepared for public npm publication, but the release is not complete until the package owner publishes both and verifies a clean consumer installation.

## 7. Protected product surface

Preserve the approved homepage and playground design. Do not redesign apps/web/app/page.tsx, apps/web/app/globals.css, or apps/web/app/layout.tsx without explicit approval. The homepage remains a demo of the developer experience and its four scenario policies.
