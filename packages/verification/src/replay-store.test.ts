import { strict as assert } from "node:assert";
import { test } from "node:test";
import { InMemoryReplayStore } from "./replay-store.js";

test("accepts a session only once", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claimSession("session-1"), true);
  assert.equal(await store.claimSession("session-1"), false);
});

test("accepts a proof identifier only once", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claimProof("proof-1"), true);
  assert.equal(await store.claimProof("proof-1"), false);
});

test("session and proof replay domains are independent", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claimSession("same-value"), true);
  assert.equal(await store.claimProof("same-value"), true);
});
