# Settleva GitHub Deployment Reclaim Provider Specification

This document is the implementation contract for the first production evidence provider. It deliberately does not invent a Reclaim provider ID or version; those values must come from a published Reclaim provider.

## Required verified fields

| Settleva field | Reclaim key | Required value |
| --- | --- | --- |
| Repository | github.repo.full_name | Exact GitHub owner/name |
| Ref | github.deployment.ref | Exact deployment branch/tag/ref |
| Commit | github.deployment.sha | Exact deployment commit SHA |
| Environment | github.deployment.environment | Exact deployment environment |
| Status | github.deployment.status | Exact requested deployment status |

All five are mandatory. Missing one must fail the Settleva condition.

## Evidence source

The provider must prove data from GitHub itself. A value returned by a Settleva backend calling GitHub's API is not sufficient as the cryptographic evidence source.

The provider request should be parameterized by the deployment being checked, while the provider itself controls the authenticated request and extraction rules. Do not accept an arbitrary URL supplied by the Settleva backend as authoritative evidence.

## Settleva binding

The funded payment commits:

- provider ID;
- exact provider version;
- canonical condition hash;
- provider hash;
- payment ID.

The Reclaim request context binds the payment ID and condition hash. Reclaim documents that contextAddress and contextMessage are tamper resistant, and that the proof context also contains the Reclaim session ID and verified extractedParameters.

## Verification sequence

1. Start the Reclaim request server-side.
2. Pin the provider ID and exact provider version.
3. Record the generated Reclaim session ID.
4. Generate the proof.
5. Verify the proof server-side using the exact provider ID/version.
6. Require the proof's session ID to match the initiated session.
7. Extract only verified extractedParameters.
8. Compare all five extracted values against the funded condition.
9. Only after every claim matches, issue the Settleva verification attestation.
10. The contract verifies that attestation against payment ID, condition hash, provider hash and Reclaim proof identifier.
11. Only then can the payee release the funds.

## Provider acceptance tests

Before production deployment, demonstrate that separate proofs fail for:

- wrong repository;
- wrong deployment ref;
- wrong commit SHA;
- wrong environment;
- wrong status;
- missing claim;
- wrong provider;
- wrong provider version;
- wrong payment context;
- wrong Reclaim session;
- reused proof identifier;
- invalid Settleva verification signature.

A published provider ID/version is a deployment prerequisite. Until those values are verified against the actual Reclaim provider, the application must remain fail-closed.
