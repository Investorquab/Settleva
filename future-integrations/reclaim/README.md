# Future Integration: Reclaim / GitHub Deployment Proof

**Status: Deferred experiment — not part of Settleva V1's required runtime path.**

Settleva V1 is developer infrastructure. Its core SDK, condition engine and reusable Solidity contract must work without Reclaim. The four website scenarios (gaming rewards, freelance milestones, conditional commerce and agentic economy) are policy demonstrations; they do not require a GitHub deployment-status provider.

This folder preserves the previous Reclaim work so maintainers and judges can inspect what was attempted and continue it later. The active landing page/playground should not call Reclaim or imply that a Reclaim provider is already working.

## What exists in the archived experiment

- A Reclaim callback/session verification implementation and its unit tests.
- An adapter registry plus GitHub deployment-status condition mapping.
- A planned proof binding from a Reclaim session to payment ID and condition hash.
- Decision checks, freshness guards and replay-protection integration.
- Provider specification and replay/session documentation.

Original TypeScript sources are retained as .ts.txt snapshots under source/ so they remain reviewable without compiling into the current Next.js application. The former API entry points are retired in V1 and return an explicit deferred response until the integration is deliberately resumed.

## Why it was deferred

The prior provider exploration was named deployment_fields, ID 92abe896-651e-4cb9-90e6-9f23cf675627, displayed as version v1.0.1. That revision was not production-ready: request data referenced a hardcoded deployment, the observed deployment status was stale, and the provider returned multiple proofs while the integration expected one proof. Do not publish or represent that provider revision as a working Settleva proof.

## Work remaining to resume

1. Design one valid provider flow that can produce fresh evidence for a deployment selected by the payment's committed repository, ref, SHA and environment.
2. Ensure the authoritative GitHub status can be established inside the cryptographically verified provider response, not inferred from unverified API JSON.
3. Match the provider's exact ID/version and extracted-field names to the adapter.
4. Resolve the single-proof/multiple-proof mismatch and add tests against the provider's actual output.
5. Verify session/payment/condition binding, freshness, negative cases and replay rejection with real Reclaim credentials.
6. Only then reconnect a dedicated Reclaim integration surface and test a real low-value Arc settlement.

## What V1 uses instead

The base SDK prepares payment commitments and builds contract calls. A developer supplies an authoritative evidence mechanism and verifier for their own deployment. The source-signed endpoint is a general server-to-server integration boundary, not an already-connected integration for each of the four scenarios. The four website examples stay clearly labelled as local simulations until real sources are connected and tested.

No Reclaim app secret or private key belongs in this folder or in the repository.
