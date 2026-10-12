# Settleva Application Security Review (Static, Not Third-Party Audit)

**Review date:** 11 October 2026  
**Baseline:** `Investorquab/Settleva` main at `0705c98a6e9d8c8defd8d122578e8cba86c14648`  
**Scope:** Static review of Reclaim request/callback/status handling, session and replay persistence, request parsing, public error behavior, contract trust boundary, and CI-backed tests. This is not a third-party penetration test or proof of live mainnet deployment.

## Executive result

The application-level findings identified in this pass are addressed by the accompanying hardening change and backed by regression/database tests. The tests also surfaced and fixed a PostgreSQL JSONB serialization defect: stored conditions/proofs must round-trip as JSON objects, not JSON strings. There is one authoritative verification-commit path; unverified callback submissions and provider/infrastructure errors cannot permanently fail a pending session; terminal failure requires a Reclaim-verified and correctly bound proof whose extracted claims fail the committed condition. Public endpoints use bounded streamed JSON parsing and no longer echo raw provider/database exception text.

This review is not a production-launch certificate or a third-party penetration test. It reflects the Reclaim request/callback/status implementation at the stated baseline, not all subsequent code.

### Scope added after this review

PR #7, merged on 12 October 2026 as `2b698d5e07e4ec9e0955616f4a88c50c55997397`, added `POST /api/evidence/attest`, a source-signed Ed25519 evidence path. The new endpoint has automated tests for signature validation, stale requests, provider pinning, condition integrity and claim-set shape, and the merged main CI passes. However, this earlier static review did **not** independently assess the new endpoint end to end, production key custody, source-event truth guarantees, operational abuse controls, or an actual deployed integration. Those must be included in a focused security review before the source-signed path is enabled for real funds.

Distributed request-rate and concurrency limits must be configured at the deployed trusted edge/proxy, then validated against the actual hosting configuration. The Reclaim provider ID/version investigation was explicitly excluded from the original review and remains open for the `/live` Reclaim path. No live Arc transaction was created by this review.

## Findings and disposition

| Finding | Disposition | Regression evidence |
| --- | --- | --- |
| An unverified callback could fail a pending session by supplying a proof whose context identified that session | Fixed: only verified, TEE-checked and exactly bound evidence that fails claim evaluation can trigger terminal failure; the write is conditional on `status = 'pending'` | Decision tests cover terminal vs. nonterminal outcomes; PostgreSQL state tests cover compare-and-set behavior |
| Provider/SDK failures could be mistaken for permanent invalid evidence | Fixed: provider resolution and SDK exceptions receive a retryable error classification; unknown failures do not change session state | Explicit verification error taxonomy and callback decisions |
| Public endpoints parsed unbounded JSON | Fixed: shared streaming parser checks declared and actual bytes; callback limit 1 MiB, request/readiness 64 KiB, status 16 KiB | Tests cover valid JSON, declared oversize, streamed oversize, and malformed bodies |
| Two endpoints could independently commit verification state | Fixed: `/api/reclaim/verify` returns HTTP 410; callback is the sole authoritative verification-commit path | Retired route is explicitly fail-closed |
| Public errors could expose SDK/database exception text; old persisted errors could be surfaced to pollers | Fixed: public errors are classified and sanitized; status endpoint never echoes historical `session.error` | Response paths reviewed and status access remains token-gated |
| Session conditions/proofs did not round-trip as JSONB objects | Fixed: use the database client's explicit JSON wrapper when writing condition and proof data | PostgreSQL session integration test asserts the condition and proof round-trip as objects |
| Persistent replay/session behavior needed direct database evidence | Covered in CI: PostgreSQL integration tests exercise same-binding retries, conflicting identifiers, transaction rollback, concurrent proof contention, session persistence and terminal-state transitions | CI migrates schema before running tests against PostgreSQL 16 |
| DB connection stalls could tie up public request handlers | Mitigated: both persistence clients now use bounded connection and idle timeouts | Workspace tests/build and CI PostgreSQL integration |

## Security properties reviewed

- **Attestation binding:** the signed release attestation is bound to chain ID, contract address, payment ID, condition hash, provider hash, and Reclaim proof identifier.
- **Session binding:** session ID from proof context is a lookup hint, not authorization. Proof signature, app-secret TEE verification and verified data binding remain required before a signature can be issued.
- **Replay protection:** independent PostgreSQL uniqueness boundaries protect session and proof identifiers. An exact retry of the same complete tuple is intentionally idempotent to recover from a failure between replay acceptance and session-state commit.
- **Status access:** the status token is independently random, stored as a hash, checked in constant time, restricted to POST JSON, and never placed in a URL. Unknown sessions and invalid status tokens return the same response.
- **Contract authority:** settlement is backend-attested, not trustless on-chain Reclaim verification. The immutable verifier signing key is a critical trust root; compromise could authorize invalid release, and the key cannot be rotated in-place.
- **UI scope:** the protected homepage, global CSS and layout are not part of this change.

## Operational gates not represented as a code-level pass

1. **Trusted-edge rate limiting:** apply distributed request-rate and concurrency caps to `/api/reclaim/request`, `/api/reclaim/callback`, `/api/reclaim/readiness`, `/api/reclaim/status`, and `/api/evidence/attest`. The proxy must overwrite/authenticate the client-IP header used by the rule; never trust client-supplied `X-Forwarded-For`. Hosting configuration must be checked before selecting a provider-specific limiter.
2. **Reclaim provider ID/version:** intentionally excluded from this audit pass. Do not invent or infer these values. The separate investigation must verify a published provider against all five extracted claims.
3. **Live chain validation:** after the real contract, server environment, callback and database are deployed, run preflight and demonstrate controlled low-value mainnet funding → fresh valid proof → attestation → payee release, plus invalid-proof rejection and payer refund after expiry. Source review and CI do not demonstrate that a deployed financial flow works.

## CI acceptance

The reviewed Reclaim hardening baseline passed frozen-lockfile installation, workspace type checks, tests (including PostgreSQL), workspace build, and Arc Foundry contract tests. The subsequent signed-evidence addition also passed the merged main CI run [38310472629](https://github.com/Investorquab/Settleva/actions/runs/38310472629). This records test evidence, not an independent security certification or live deployment.
