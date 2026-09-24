# Settleva replay protection

Settleva treats Reclaim proof verification as stateless at the SDK boundary and requires persistent application-level replay protection before production release.

## Required records

The production store persists, at minimum:

- Reclaim sessionId
- Settleva paymentId
- committed conditionHash
- accepted Reclaim proofIdentifier
- verification timestamp

The current persistent implementation stores the accepted binding in Postgres. Final verification state remains in the Reclaim session store.

## Atomic acceptance

A verification request may proceed only when the persistence layer atomically accepts both:

1. the initiated Reclaim session for the same payment and condition; and
2. the proof identifier for the same payment and condition.

A previously accepted session or proof identifier must fail closed.

The production implementation is `PostgresReplayStore`. It uses a transaction plus database uniqueness constraints:

- a unique session row establishes the ownership token for the verification attempt;
- a unique proof row establishes an independent proof-identifier boundary;
- if the proof insert loses a race, the transaction rolls back the session insert.

The migration in `docs/reclaim/replay.sql` provides the primary key and unique indexes required for these boundaries.

An in-memory store is test-only and must never be used as the production implementation.

## Binding requirements

A session identifier cannot be reused for a different payment or condition.

A proof identifier cannot be reused for a different payment or condition.

The persisted binding therefore includes:

- sessionId -> paymentId + conditionHash
- proofIdentifier -> paymentId + conditionHash

## Failure behavior

If the persistence layer is unavailable, verification must return an explicit server error and must not issue a verification attestation.

If a uniqueness constraint reports a replay, verification must fail without issuing an attestation.

The verification service signs the attestation before claiming persistent replay state, so a signing failure does not consume a replay slot.

## Production deployment checklist

Before production verification is enabled:

1. Apply `docs/reclaim/replay.sql` to the managed Postgres database.
2. Set `DATABASE_URL` in the deployed application.
3. Confirm the callback/session store and replay store use the same production database.
4. Run the persistent replay race test against the actual managed Postgres instance.
5. Confirm database failure produces no verification attestation.
6. Confirm a reused session and reused proof identifier both fail closed.
