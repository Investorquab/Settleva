# Reclaim provider specification: GitHub deployment status

## Purpose

Settleva's first reference evidence flow is a GitHub deployment condition. The provider must attest to the deployment data itself; a normal GitHub API response from Settleva is **not** a proof.

GitHub exposes deployment objects containing the deployment SHA, ref, and environment, and deployment-status objects containing the deployment state. Public repository deployment resources can be read without authentication.

## Exact claims

The provider should expose these extracted claim fields:

- `github.repo.full_name`
- `github.deployment.ref`
- `github.deployment.sha`
- `github.deployment.environment`
- `github.deployment.status`

Settleva should commit all five claims when using this reference flow.

## Provider request model

The provider must receive the target repository and deployment selection as request parameters that are cryptographically bound into the Reclaim claim.

Minimum selection inputs:

- repository owner/name
- deployment ref or deployment id
- expected environment
- expected commit SHA

The provider must not accept a URL supplied by the settlement backend as the authoritative evidence source. The provider configuration should resolve the GitHub API endpoint itself.

For a deployment selected by ref/SHA/environment, GitHub's deployment endpoint supports filtering by `sha`, `ref`, and `environment`. Deployment status is then read from the deployment's status endpoint.

## Security requirements

1. The repository, ref/SHA, environment and requested status must be part of the claim parameters/context that Reclaim attests.
2. The extracted values must come from the GitHub response selected by those parameters.
3. The provider must be pinned by Settleva's configured Reclaim provider id/version.
4. Settleva must compare every extracted claim with the condition committed at funding.
5. A proof for another repository, ref, SHA, environment or status must fail.
6. The proof context must bind the payment id and condition hash.
7. Provider publication/versioning is a deployment prerequisite; this repository must never invent a provider id or version.

## Runtime parameter binding

The backend derives the exact values from the condition committed at funding and passes them to `ReclaimProofRequest.setParams()`:

| Reclaim parameter | Committed condition field |
| --- | --- |
| `github_repo_full_name` | `github.repo.full_name` |
| `github_deployment_ref` | `github.deployment.ref` |
| `github_deployment_sha` | `github.deployment.sha` |
| `github_deployment_environment` | `github.deployment.environment` |
| `github_deployment_status` | `github.deployment.status` |

The server pins the exact provider ID/version, requests app-secret TEE attestation verification through Reclaim's SDK, rejects proof timestamps older than the freshness window, binds the result to the initiated session/payment/condition, evaluates every committed claim, and only then signs the payment-bound attestation. The real published provider must demonstrably accept these parameter names and return the documented extracted values. Source code does not assume or invent a published provider.

## Payment binding and verification sequence

The funded payment commits to the provider ID, exact provider version, canonical condition hash, provider hash, and payment ID. The Reclaim request context binds the payment ID and condition hash. Context and extracted-parameter data must come from verified Reclaim proof data; browser-submitted claims are not authoritative.

The end-to-end verification sequence is:

1. Start the Reclaim request server-side and pin the exact provider ID/version.
2. Record the generated Reclaim session ID and create the proof request from the condition committed when the payment was funded.
3. Generate the proof and verify it server-side using the exact provider ID/version.
4. Require the verified session ID and payment context to match the initiated session, payment ID, and condition hash.
5. Extract only cryptographically verified extracted parameters.
6. Compare all five extracted values with the funded condition.
7. Apply freshness and persistent replay checks.
8. Issue the Settleva attestation only after every verification step passes.
9. The contract verifies the attestation against the chain, deployed contract, payment ID, condition hash, provider hash, and proof identifier.
10. Only the designated payee can release the funds before expiry.

## Current implementation boundary

This document defines the provider contract and claim schema. It does **not** state that the provider has already been published in Reclaim. The real published provider must demonstrably accept the parameter names documented above and return the expected extracted values. Until publication, exact ID/version pinning, and validation with real Reclaim app credentials are complete, the Reclaim path must fail closed.

## Provider acceptance tests

Before production use, separately prove rejection for:

- wrong repository, ref, commit SHA, environment, or status;
- missing claims or claims that do not match the condition;
- wrong provider ID or version;
- wrong payment context or Reclaim session;
- reused proof identifier; and
- invalid Settleva verification signature.

A published provider ID/version is a prerequisite. Placeholder IDs and public/static API responses are not proof. The application must remain fail-closed until the actual provider's extracted parameters and version are confirmed against this schema.

## Reclaim publication checklist

- [ ] Create or locate the GitHub deployment-status provider.
- [ ] Pin the provider id.
- [ ] Pin the provider version/hash.
- [ ] Configure only the required dynamic request data.
- [ ] Verify a real proof with Reclaim.
- [ ] Confirm returned extracted parameters exactly match the five Settleva claim fields.
- [ ] Confirm returned context contains the payment id and condition hash.
- [ ] Run wrong-repository, wrong-SHA, wrong-environment and wrong-status negative tests.
