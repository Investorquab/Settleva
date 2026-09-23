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

## Current implementation boundary

This document defines the provider contract and claim schema. It does **not** pretend that the provider has already been published in Reclaim.

Until the provider is published and its id/version is configured, the application must fail closed rather than treating a GitHub API response as a verified proof.

## Reclaim publication checklist

- [ ] Create or locate the GitHub deployment-status provider.
- [ ] Pin the provider id.
- [ ] Pin the provider version/hash.
- [ ] Configure only the required dynamic request data.
- [ ] Verify a real proof with Reclaim.
- [ ] Confirm returned extracted parameters exactly match the five Settleva claim fields.
- [ ] Confirm returned context contains the payment id and condition hash.
- [ ] Run wrong-repository, wrong-SHA, wrong-environment and wrong-status negative tests.
