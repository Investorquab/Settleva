import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required. Set it in the environment or apps/web/.env.production.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`
      create table if not exists settleva_evidence_replay (
        identifier_type text not null check (identifier_type in ('session', 'proof')),
        identifier text not null,
        session_id text not null,
        proof_identifier text not null,
        payment_id text not null,
        condition_hash text not null,
        accepted_at timestamptz not null default now(),
        primary key (identifier_type, identifier)
      )
    `);
    await tx.unsafe(`
      create unique index if not exists settleva_evidence_replay_session_idx
      on settleva_evidence_replay (session_id)
      where identifier_type = 'session'
    `);
    await tx.unsafe(`
      create unique index if not exists settleva_evidence_replay_proof_idx
      on settleva_evidence_replay (proof_identifier)
      where identifier_type = 'proof'
    `);

    // A previous Settleva release used this provider-specific table for the
    // exact same signed-evidence replay store. Preserve all accepted bindings
    // before switching the application to the provider-neutral table.
    const legacy = await tx`
      select to_regclass('public.settleva_reclaim_replay') as legacy_table
    `;
    if (legacy[0]?.legacy_table) {
      const conflictingBindings = await tx.unsafe(`
        select 1
        from settleva_reclaim_replay as legacy
        join settleva_evidence_replay as current
          on current.identifier_type = legacy.identifier_type
         and current.identifier = legacy.identifier
        where current.session_id is distinct from legacy.session_id
           or current.proof_identifier is distinct from legacy.proof_identifier
           or current.payment_id is distinct from legacy.payment_id
           or current.condition_hash is distinct from legacy.condition_hash
        limit 1
      `);
      if (conflictingBindings.length > 0) {
        throw new Error(
          "Legacy replay records conflict with provider-neutral replay data; resolve the conflict before completing this migration."
        );
      }

      // Do not overwrite or silently rebind existing identifiers. Missing
      // legacy rows are copied as-is; unique-index conflicts abort the
      // transaction, failing closed rather than dropping replay protection.
      await tx.unsafe(`
        insert into settleva_evidence_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash, accepted_at)
        select
          legacy.identifier_type,
          legacy.identifier,
          legacy.session_id,
          legacy.proof_identifier,
          legacy.payment_id,
          legacy.condition_hash,
          legacy.accepted_at
        from settleva_reclaim_replay as legacy
        where not exists (
          select 1
          from settleva_evidence_replay as current
          where current.identifier_type = legacy.identifier_type
            and current.identifier = legacy.identifier
        )
      `);
    }
  });
  console.log("Settleva provider-neutral evidence replay table and indexes are ready; legacy replay bindings preserved if present.");
} finally {
  await sql.end({ timeout: 5 });
}
