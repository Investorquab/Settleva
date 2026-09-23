import test from "node:test";
import assert from "node:assert/strict";
import { prepareCreatePayment } from "./client.js";

const input = {
  payer: "0x1111111111111111111111111111111111111111" as const,
  payee: "0x2222222222222222222222222222222222222222" as const,
  token: "0x3333333333333333333333333333333333333333" as const,
  amount: "1000000",
  expiry: 1790000000,
  condition: {
    version: "1.0" as const,
    provider: "github",
    claims: [{field:"repository",operator:"equals" as const,value:"Investorquab/Settleva"}],
    expiresAt: 1790000000
  }
};

test("prepares deterministic payment identifiers", () => {
  const a = prepareCreatePayment(input);
  const b = prepareCreatePayment(input);
  assert.equal(a.paymentId, b.paymentId);
  assert.match(a.paymentId, /^0x[0-9a-f]{64}$/);
  assert.match(a.conditionHash, /^0x[0-9a-f]{64}$/);
});

test("changing a payment parameter changes the payment id", () => {
  const original = prepareCreatePayment(input);
  const changed = prepareCreatePayment({...input, amount:"2000000"});
  assert.notEqual(original.paymentId, changed.paymentId);
});
