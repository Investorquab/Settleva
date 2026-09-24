import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { PostgresReplayStore } from "@settleva/verification";

const databaseUrl = process.env.DATABASE_URL;

test("persistent replay store accepts only one concurrent identical claim", {skip: !databaseUrl}, async () => {
  const sql = postgres(databaseUrl!);
  await sql`
    create table if not exists settleva_reclaim_replay (
      identifier_type text not null,
      identifier text not null,
      session_id text not null,
      proof_identifier text not null,
      payment_id text not null,
      condition_hash text not null,
      accepted_at timestamptz not null default now(),
      primary key (identifier_type, identifier)
    )
  `;
  await sql`create unique index if not exists settleva_reclaim_replay_session_idx on settleva_reclaim_replay (session_id)`;
  await sql`create unique index if not exists settleva_reclaim_replay_proof_idx on settleva_reclaim_replay (proof_identifier)`;

  const suffix = `ci-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const binding = {
    sessionId: `${suffix}-session`,
    proofIdentifier: `${suffix}-proof`,
    paymentId: `${suffix}-payment`,
    conditionHash: `${suffix}-condition`
  };

  const store = new PostgresReplayStore(databaseUrl!);
  try {
    // Use one store per simulated request. Each instance has its own
    // connection, so this exercises the database uniqueness boundaries rather
    // than serializing all contenders through one client connection.
    const stores = Array.from({length: 16}, () => new PostgresReplayStore(databaseUrl!));
    const results = await Promise.all(stores.map((candidate) => candidate.claim(binding)));
    assert.equal(results.filter(Boolean).length, 1);

    const replayStore = new PostgresReplayStore(databaseUrl!);
    try {
      assert.equal(
        await replayStore.claim({...binding, proofIdentifier: `${suffix}-other-proof`}),
        false
      );
      assert.equal(
        await replayStore.claim({...binding, sessionId: `${suffix}-other-session`}),
        false
      );
    } finally {
      await replayStore.close();
    }

    await Promise.all(stores.map((candidate) => candidate.close()));
  } finally {
    await store.close();
    await sql`
      delete from settleva_reclaim_replay
      where session_id = ${binding.sessionId}
         or proof_identifier = ${binding.proofIdentifier}
         or proof_identifier = ${suffix + "-other-proof"}
    `;
    await sql.end({timeout:5});
  }
});
