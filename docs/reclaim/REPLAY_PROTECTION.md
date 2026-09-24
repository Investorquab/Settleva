# Settleva replay protection

Settleva treats Reclaim proof verification as stateless at the SDK boundary and requires persistent application-level replay protection before production release.

## Required records

The production store must persist, at minimum:

- Reclaim sessionId
- Settleva paymentId
- committed conditionHash
- accepted Reclaim proofIdentifier
- verification timestamp
- final verification outcome

## Atomic acceptance

A verification request may proceed only when the persistence layer atomically accepts both:

1. the initiated Reclaim session for the same payment and condition; and
2. the proof identifier for the same payment and condition.

A previously accepted session or proof identifier must fail closed.

The store must use a database uniqueness constraint or equivalent atomic compare-and-set. An in-memory store is test-only and must never be used as the production implementation.

## Binding requirements

A session identifier cannot be reused for a different payment or condition.

A proof identifier cannot be reused for a different payment or condition.

The persisted binding must therefore include:

- sessionId -> paymentId + conditionHash
- proofIdentifier -> paymentId + conditionHash

## Failure behavior

If the persistence layer is unavailable, verification must return an explicit server error and must not issue a verification attestation.

If a uniqueness constraint reports a replay, verification must fail without issuing an attestation.

## Next production step

Implement the ReplayStore interface against the managed Postgres database selected for the Vercel deployment. The database migration should create unique keys for session IDs and proof identifiers and retain their payment/condition bindings.
