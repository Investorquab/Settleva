import test from "node:test";
import assert from "node:assert/strict";
import { canTransition } from "./payment.js";

test("settlement is only reachable from verification",()=>{
  assert.equal(canTransition("VERIFYING","SETTLED"),true);
  assert.equal(canTransition("WAITING_FOR_PROOF","SETTLED"),false);
});

test("terminal states cannot transition",()=>{
  assert.equal(canTransition("SETTLED","REFUNDED"),false);
  assert.equal(canTransition("REFUNDED","SETTLED"),false);
});
