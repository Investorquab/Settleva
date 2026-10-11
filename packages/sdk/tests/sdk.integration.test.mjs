import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApprovalCall,
  buildCreatePaymentCall,
  normalizeTokenAmount,
  prepareCreatePayment,
  toTokenUnits
} from "../dist/index.js";
import { hashCondition } from "@settleva/conditions";

const payer = "0x1111111111111111111111111111111111111111";
const payee = "0x2222222222222222222222222222222222222222";
const token = "0x3333333333333333333333333333333333333333";
const settlevaAddress = "0x4444444444444444444444444444444444444444";

function input(amount = "1.25", expiry = Math.floor(Date.now() / 1000) + 3600) {
  return {
    payer, payee, token, amount, expiry,
    condition: {
      version: "1.0",
      provider: "settleva.demo.milestone",
      providerVersion: "1",
      claims: [{ field: "milestone.status", operator: "equals", value: "accepted" }],
      expiresAt: expiry
    }
  };
}

test("equivalent decimal strings create the same canonical payment commitment", () => {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const first = prepareCreatePayment(input("001.25000", expiry));
  const second = prepareCreatePayment(input("1.25", expiry));
  assert.equal(first.request.amount, "1.25");
  assert.equal(first.paymentId, second.paymentId);
  assert.equal(first.conditionHash, hashCondition(first.request.condition));
  assert.equal(JSON.parse(first.proofContext).paymentId, first.paymentId);
  assert.equal(JSON.parse(first.proofContext).conditionHash, first.conditionHash);
});

test("zero representations and unsupported amount syntax are rejected", () => {
  for (const amount of ["0", "0.0", "0.0000", "-1", "+1", ".5", "1e3", "1."]) {
    assert.throws(() => prepareCreatePayment(input(amount)), undefined, amount);
  }
});

test("payment and policy expiries must be identical and in the future", () => {
  const base = input();
  assert.throws(() => prepareCreatePayment({
    ...base,
    expiry: base.expiry + 1
  }), /exactly match condition.expiresAt/);
  assert.throws(() => prepareCreatePayment(input("1.25", 1)), /future Unix timestamp/);
});

test("SDK transaction builders match the contract's atomic amount and commitment arguments", () => {
  const prepared = prepareCreatePayment(input("1.25"));
  const approval = buildApprovalCall(prepared, settlevaAddress, 6);
  const funding = buildCreatePaymentCall(prepared, settlevaAddress, 6);

  assert.equal(approval.address, token);
  assert.equal(approval.functionName, "approve");
  assert.equal(approval.args[0], settlevaAddress);
  assert.equal(approval.args[1], 1_250_000n);

  assert.equal(funding.address, settlevaAddress);
  assert.equal(funding.functionName, "createPayment");
  assert.equal(funding.args[0], prepared.paymentId);
  assert.equal(funding.args[1], payee);
  assert.equal(funding.args[2], token);
  assert.equal(funding.args[3], 1_250_000n);
  assert.equal(funding.args[4], BigInt(prepared.request.expiry));
  assert.equal(funding.args[5], prepared.conditionHash);
  assert.equal(funding.args[6], prepared.providerHash);
});

test("token conversion validates token decimals and fractional precision", () => {
  assert.equal(normalizeTokenAmount("0007.2500"), "7.25");
  assert.equal(toTokenUnits("7.25", 6), 7_250_000n);
  assert.throws(() => toTokenUnits("1.0000001", 6), /fractional digits/);
  assert.throws(() => toTokenUnits("1", -1), /between 0 and 255/);
});

test("a policy with duplicate fields cannot be committed", () => {
  const base = input();
  assert.throws(() => prepareCreatePayment({
    ...base,
    condition: {
      ...base.condition,
      claims: [
        ...base.condition.claims,
        { field: "milestone.status", operator: "equals", value: "rejected" }
      ]
    }
  }), /Duplicate condition claim field/);
});
