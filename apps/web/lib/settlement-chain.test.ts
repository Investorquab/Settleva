import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, stringToHex } from "viem";
import { ARC_USDC_ADDRESS } from "@settleva/sdk";
import {
  ARC_NATIVE_CURRENCY,
  assertFundedPaymentSnapshot,
  SettlementPaymentStateError
} from "./settlement-chain.ts";

const now = 1_800_000_000;
const condition = {
  version: "1.0" as const,
  provider: "reclaim-provider-id",
  providerVersion: "1.0.0",
  claims: [{ field: "github.deployment.status", operator: "equals" as const, value: "success" }],
  expiresAt: now + 3600
};
const conditionHash = keccak256(stringToHex("condition"));

function snapshot(overrides: Partial<{
  expiry: bigint;
  token: string;
  conditionHash: string;
  providerHash: string;
  status: number;
}> = {}) {
  return {
    expiry: BigInt(condition.expiresAt),
    token: ARC_USDC_ADDRESS,
    conditionHash,
    providerHash: keccak256(stringToHex(condition.provider)),
    status: 1,
    ...overrides
  };
}

test("Arc native USDC metadata uses 18 decimals", () => {
  assert.equal(ARC_NATIVE_CURRENCY.decimals, 18);
});

test("a funded Arc payment bound to the exact condition/provider/expiry passes", () => {
  assert.doesNotThrow(() => assertFundedPaymentSnapshot(snapshot(), condition, conditionHash, now));
});

test("backend refuses to attest when a payment is absent or not funded", () => {
  assert.throws(
    () => assertFundedPaymentSnapshot(snapshot({status: 0}), condition, conditionHash, now),
    (error: unknown) => error instanceof SettlementPaymentStateError && error.code === "PAYMENT_NOT_FUNDED"
  );
});

test("backend refuses to attest if arbitrary ERC-20 token was funded", () => {
  assert.throws(
    () => assertFundedPaymentSnapshot(snapshot({token:"0x3333333333333333333333333333333333333333"}), condition, conditionHash, now),
    (error: unknown) => error instanceof SettlementPaymentStateError && error.code === "PAYMENT_TOKEN_MISMATCH"
  );
});

test("backend refuses to attest if on-chain policy hash differs", () => {
  assert.throws(
    () => assertFundedPaymentSnapshot(snapshot({conditionHash: "0x" + "0".repeat(64)}), condition, conditionHash, now),
    (error: unknown) => error instanceof SettlementPaymentStateError && error.code === "PAYMENT_CONDITION_MISMATCH"
  );
});

test("backend refuses to attest if the stored provider hash differs", () => {
  assert.throws(
    () => assertFundedPaymentSnapshot(snapshot({providerHash: "0x" + "0".repeat(64)}), condition, conditionHash, now),
    (error: unknown) => error instanceof SettlementPaymentStateError && error.code === "PAYMENT_PROVIDER_MISMATCH"
  );
});

test("backend refuses to attest if payment expiry differs from policy expiry", () => {
  assert.throws(
    () => assertFundedPaymentSnapshot(snapshot({expiry: BigInt(condition.expiresAt + 1)}), condition, conditionHash, now),
    (error: unknown) => error instanceof SettlementPaymentStateError && error.code === "PAYMENT_EXPIRY_MISMATCH"
  );
});

test("backend refuses expired on-chain payments", () => {
  const expiredCondition = { ...condition, expiresAt: now };
  assert.throws(
    () => assertFundedPaymentSnapshot(snapshot({expiry: BigInt(now)}), expiredCondition, conditionHash, now),
    (error: unknown) => error instanceof SettlementPaymentStateError && error.code === "PAYMENT_EXPIRED"
  );
});
