import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

test("database migration preserves legacy replay bindings and is idempotent", { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 8, idle_timeout: 1 });
  const sessionId = "migration-test-session-" + randomUUID();
  const proofIdentifier = "0x" + randomBytes(32).toString("hex");
  const paymentId = "0x" + randomBytes(32).toString("hex");
  const conditionHash = "0x" + randomBytes(32).toString("hex");

  try {
    await sql.unsafe(`
      create table if not exists settleva_reclaim_replay (
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
    await sql.unsafe(`
      create unique index if not exists settleva_reclaim_replay_session_idx
      on settleva_reclaim_replay (session_id)
      where identifier_type = 'session'
    `);
    await sql.unsafe(`
      create unique index if not exists settleva_reclaim_replay_proof_idx
      on settleva_reclaim_replay (proof_identifier)
      where identifier_type = 'proof'
    `);

    await sql`
      insert into settleva_reclaim_replay
        (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
      values
        ('session', ${sessionId}, ${sessionId}, ${proofIdentifier}, ${paymentId}, ${conditionHash}),
        ('proof', ${proofIdentifier}, ${sessionId}, ${proofIdentifier}, ${paymentId}, ${conditionHash})
    `;

    // The CI workflow has already run the migration once on a fresh database.
    // Running it again with legacy rows exercises safe upgrade behaviour.
    execFileSync(process.execPath, ["scripts/migrate-db.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe"
    });

    const migrated = await sql`
      select identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash
      from settleva_evidence_replay
      where identifier = ${sessionId} or identifier = ${proofIdentifier}
      order by identifier_type
    `;
    assert.equal(migrated.length, 2);
    for (const row of migrated) {
      assert.equal(row.session_id, sessionId);
      assert.equal(row.proof_identifier, proofIdentifier);
      assert.equal(row.payment_id, paymentId);
      assert.equal(row.condition_hash, conditionHash);
    }

    execFileSync(process.execPath, ["scripts/migrate-db.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe"
    });
    const rerun = await sql`
      select count(*)::int as count
      from settleva_evidence_replay
      where identifier = ${sessionId} or identifier = ${proofIdentifier}
    `;
    assert.equal(rerun[0]?.count, 2);
  } finally {
    await sql`delete from settleva_evidence_replay where identifier = ${sessionId} or identifier = ${proofIdentifier}`.catch(() => {});
    await sql`delete from settleva_reclaim_replay where identifier = ${sessionId} or identifier = ${proofIdentifier}`.catch(() => {});
    await sql.end({ timeout: 5 });
  }
});
