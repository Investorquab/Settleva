import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required. Set it in the environment or apps/web/.env.production.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10 });
try {
  await sql.begin(async (tx) => {
    // Provider-neutral replay table used by signed-source integrations.
    // Legacy Reclaim session tables, if present, are left untouched for the deferred integration.
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
  });
  console.log("Settleva provider-neutral evidence replay table and indexes are ready.");
} finally {
  await sql.end({ timeout: 5 });
}
