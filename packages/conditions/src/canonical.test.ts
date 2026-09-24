import { buildProofContext, canonicalizeCondition, hashCondition, hashProofContext } from "./canonical.js";
import { evaluateClaims } from "./types.js";

const condition = {
  version: "1.0" as const,
  provider: "github",
  providerVersion: "1.0.0",
  claims: [
    { field: "repo.public", operator: "equals" as const, value: "true" },
    { field: "repo.owner", operator: "equals" as const, value: "Investorquab" }
  ],
  expiresAt: 1_800_000_000
};

if (!canonicalizeCondition(condition).includes('"providerVersion":"1.0.0"')) throw new Error("canonicalization failed");
if (!hashCondition(condition).startsWith("0x") || hashCondition(condition).length !== 66) throw new Error("condition hash failed");
if (buildProofContext(condition) !== hashCondition(condition)) throw new Error("proof context mismatch");
if (hashProofContext(condition).length !== 66) throw new Error("context hash failed");

const reordered = {
  ...condition,
  claims: [...condition.claims].reverse()
};
if (canonicalizeCondition(condition) !== canonicalizeCondition(reordered)) {
  throw new Error("claim ordering must not affect canonicalization");
}
if (hashCondition(condition) !== hashCondition(reordered)) {
  throw new Error("claim ordering must not affect condition hash");
}

const passed = evaluateClaims(condition, [
  {field:"repo.public", value:"true"},
  {field:"repo.owner", value:"Investorquab"}
]);
if (!passed.valid) throw new Error("matching claims should pass");

const failed = evaluateClaims(condition, [
  {field:"repo.public", value:"false"},
  {field:"repo.owner", value:"Investorquab"}
]);
if (failed.valid || failed.failures[0] !== "VALUE_MISMATCH:repo.public") throw new Error("mismatched claim should fail");

const expired = evaluateClaims(condition, [
  {field:"repo.public", value:"true"},
  {field:"repo.owner", value:"Investorquab"}
], condition.expiresAt);
if (expired.valid || !expired.failures.includes("CONDITION_EXPIRED")) {
  throw new Error("expired conditions must fail evaluation");
}

const justBeforeExpiry = evaluateClaims(condition, [
  {field:"repo.public", value:"true"},
  {field:"repo.owner", value:"Investorquab"}
], condition.expiresAt - 1);
if (!justBeforeExpiry.valid) throw new Error("condition should remain valid immediately before expiry");

const duplicateCondition = {
  ...condition,
  claims: [...condition.claims, condition.claims[0]!]
};
const duplicateConditionResult = evaluateClaims(duplicateCondition, [
  {field:"repo.public", value:"true"},
  {field:"repo.owner", value:"Investorquab"}
]);
if (duplicateConditionResult.valid || !duplicateConditionResult.failures.includes("DUPLICATE_CONDITION_CLAIM:repo.public")) {
  throw new Error("duplicate condition claims must fail evaluation");
}

const duplicateVerifiedResult = evaluateClaims(condition, [
  {field:"repo.public", value:"true"},
  {field:"repo.public", value:"true"},
  {field:"repo.owner", value:"Investorquab"}
]);
if (duplicateVerifiedResult.valid || !duplicateVerifiedResult.failures.includes("DUPLICATE_VERIFIED_CLAIM:repo.public")) {
  throw new Error("duplicate verified claims must fail evaluation");
}
