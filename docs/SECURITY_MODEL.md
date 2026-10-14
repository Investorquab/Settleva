# Security model and trust boundaries

This document explains Settleva's security architecture and known limitations. **It is not a third-party smart-contract audit, formal verification report, or guarantee that every integration is safe.** Report vulnerabilities according to the repository [security policy](../SECURITY.md).

## Key roles

Use separate keys for separate responsibilities:

| Key | Responsibility | Where it belongs |
|---|---|---|
| Deployer | Deploys the contract and pays deployment gas | Deployment environment only |
| Settleva verifier | Signs a payment-bound attestation after backend checks | Server-side secret manager/environment only |
| Evidence source signer | Signs the authoritative source event | The source system or its secret manager |
| User wallet | Authorizes its own approval/create/release/refund transactions | Wallet-controlled by the user |

Do not reuse the test adapter's Ed25519 key as the real source's key. Do not expose private keys, seed phrases, provider secrets, database credentials, or raw production environment files in source control, browser code, public environment variables, logs, or chat.

## Contract protections

The contract enforces the following for a release:

- the payment is still funded and not expired;
- only the designated payee may release;
- the proof identifier cannot be used twice;
- the verifier signature must recover to the deployment's immutable `verificationSigner`;
- the transfer uses the token recorded for the payment.

Refunds require the payer and an expired funded payment. The current contract supports the canonical Arc USDC ERC-20 interface. It does not support in-place amendments to a funded payment, and the verifier address cannot be changed after deployment.

## Backend checks

Before issuing an attestation, the backend validates the source-signed request against the configured Ed25519 public key for the exact provider ID/version. It enforces a five-minute request age with up to 60 seconds of future clock skew, condition canonicalization/hash agreement, exact claim-field membership, condition satisfaction, the Arc mainnet chain, funded/unexpired payment state and provider binding, verifier-key match, and persistent replay protection.

The signature covers the exact raw body plus the protocol prefix and timestamp. A modified body or stale/unknown provider request should fail closed. PostgreSQL is part of the safety boundary: if replay protection is unavailable, the endpoint must not issue an attestation.

## Trust assumptions and limitations

- The contract trusts the backend verifier. A compromised verifier key can authorize invalid release attestations within the contract's constraints. This trust boundary is deliberate and must be disclosed.
- The backend trusts each registered authoritative source key. A compromised or dishonest source can sign false outcome claims for its provider identity.
- The generic protocol does not make an untrusted API authoritative. Each integration must establish who controls the source and how it independently determines the outcome.
- The GitHub/Vercel test performed on the demo VPS queried a real GitHub status response and signed an assertion with a VPS-controlled adapter key. GitHub did not sign that assertion using a GitHub key. It validates the end-to-end mechanics but is not an independent, reusable source integration.
- The controlled 0.01 USDC release used the same wallet as payer and payee. A separate two-party acceptance test, negative-case integration tests, and expiry/refund testing remain outstanding.
- The standalone endpoint should receive appropriate ingress rate limits, monitoring, secret rotation, and operational backup/recovery before it is treated as production-ready.
- The website's four policy scenarios use local sample data; they do not constitute live source or escrow integrations.

## Before real use

Require an authoritative source design, key-custody review, funded-payment binding, real positive and negative test events, replay-conflict tests, expiry/refund tests, and an independently verified `PaymentReleased` receipt. Do not equate passing CI, a successful API response, or mainnet preflight with settlement safety.
