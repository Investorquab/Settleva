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

A previously accepted identifier must fail closed when it is presented with a different payment, condition, session, or proof binding. An exact previously accepted binding is idempotently recoverable so a crash between replay acceptance and session persistence cannot permanently strand a valid verification.

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

If a uniqueness constraint reports a conflicting replay, verification must fail without issuing an attestation. An exact existing binding may be recovered without issuing a new semantic acceptance for a different payment or condition.

The verification service signs the attestation before claiming persistent replay state, so a signing failure does not consume a replay slot.

## Production deployment checklist

Before production verification is enabled:

1. Apply `docs/reclaim/replay.sql` to the managed Postgres database.
2. Set `DATABASE_URL` in the deployed application.
3. Confirm the callback/session store and replay store use the same production database.
4. Run the persistent replay race test against the actual managed Postgres instance.
5. Confirm database failure produces no verification attestation.
6. Confirm conflicting reuse of a session or proof identifier fails closed, while an exact retry of the same binding is idempotent.


## Callback terminal-state rule

A public callback may identify its initiated session from proof context, but that identifier is not an authorization credential. A callback submission is not allowed to mark a session failed merely because parsing, SDK verification, context binding, chain RPC, persistence, or provider work throws an error. Only a proof that has passed Reclaim cryptographic verification and TEE verification, matches the initiated session/payment/condition, and contains verified claims that fail the committed condition may produce the terminal condition-failure state. The database transition is conditional on the session still being `pending`, so it cannot overwrite a concurrent successful verification.

Provider/SDK and infrastructure failures remain retryable. Exact retry is intentional and protected by the database idempotency rules above. Public endpoints return classified, sanitized messages rather than SDK/database exception text.

## Public endpoint deployment controls

The callback accepts a bounded proof body (1 MiB); the request and readiness endpoints accept at most 64 KiB; the status endpoint accepts at most 16 KiB. These are application-level limits and apply to streamed bodies even when Content-Length is absent. Configure distributed rate limits and concurrency caps at the deployed trusted edge/WAF before exposing the routes. Do not derive security identity from a forwarded-IP header unless the proxy overwrites or authenticates it.
