import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import type {PaymentCondition} from "@settleva/conditions";
import {ReclaimSessionStore} from "./reclaim-session-store.ts";

const databaseUrl = process.env.DATABASE_URL;
const condition: PaymentCondition = {
  version:"1.0",
  provider:"test-provider-not-for-production",
  providerVersion:"test-version",
  claims:[{field:"github.deployment.status",operator:"equals",value:"success"}],
  expiresAt:Math.floor(Date.now()/1000)+3600
};

test("PostgreSQL session persistence is idempotent and terminal states cannot be overwritten", {skip:!databaseUrl}, async () => {
  const sql = postgres(databaseUrl!, {max:1, connect_timeout:8, idle_timeout:1});
  const suffix = `session-test-${randomUUID()}`;
  const pendingId = `${suffix}-pending`;
  const verifiedId = `${suffix}-verified`;
  const failedId = `${suffix}-failed`;
  const statusTokenHash = "ab".repeat(32);
  const store = new ReclaimSessionStore(databaseUrl!);
  try {
    const pending = {
      sessionId:pendingId,
      paymentId:`${suffix}-payment`,
      conditionHash:`${suffix}-condition`,
      condition,
      providerId:condition.provider,
      providerVersion:condition.providerVersion,
      statusTokenHash
    };
    assert.equal(await store.create(pending), true);
    assert.equal(await store.create(pending), false);
    const created = await store.get(pendingId);
    assert.equal(created?.status, "pending");
    assert.equal(created?.statusTokenHash, statusTokenHash);
    assert.deepEqual(created?.condition, condition);

    const verified = {...pending,sessionId:verifiedId,paymentId:`${suffix}-verified-payment`};
    assert.equal(await store.create(verified), true);
    assert.equal(await store.markVerified(verifiedId,{verified:true},`${suffix}-proof`,"0x1234"), true);
    assert.equal(await store.markFailed(verifiedId,"must not overwrite verified"), false);
    const verifiedRow = await store.get(verifiedId);
    assert.equal(verifiedRow?.status, "verified");
    assert.deepEqual(verifiedRow?.proof, {verified:true});
    assert.equal(verifiedRow?.proofIdentifier, `${suffix}-proof`);
    assert.equal(verifiedRow?.verificationSignature, "0x1234");
    assert.equal(verifiedRow?.error, undefined);

    const failed = {...pending,sessionId:failedId,paymentId:`${suffix}-failed-payment`};
    assert.equal(await store.create(failed), true);
    assert.equal(await store.markFailed(failedId,"safe terminal result"), true);
    assert.equal(await store.markVerified(failedId,{verified:true},`${suffix}-failed-proof`,"0x5678"), false);
    assert.equal((await store.get(failedId))?.status, "failed");
  } finally {
    await store.close().catch(() => undefined);
    await sql`delete from settleva_reclaim_sessions where session_id like ${suffix + "%"}`;
    await sql.end({timeout:5});
  }
});
