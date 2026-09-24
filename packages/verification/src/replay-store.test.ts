import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryReplayStore } from "./replay-store.js";

const binding = {
  sessionId: "session-1",
  proofIdentifier: "0xproof1",
  paymentId: "0xpayment1",
  conditionHash: "0xcondition1"
};

test("accepts a session/proof pair once", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claim(binding), true);
  assert.equal(await store.claim(binding), false);
});

test("rejects a reused session even with a different proof", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claim(binding), true);
  assert.equal(await store.claim({...binding, proofIdentifier:"0xproof2"}), false);
});

test("rejects a reused proof even with a different session", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claim(binding), true);
  assert.equal(await store.claim({...binding, sessionId:"session-2"}), false);
});

test("keeps session and proof bindings tied to payment and condition", async () => {
  const store = new InMemoryReplayStore();
  assert.equal(await store.claim(binding), true);
  assert.equal(await store.claim({...binding, sessionId:"session-2", proofIdentifier:"0xproof2", paymentId:"0xpayment2"}), true);
});
