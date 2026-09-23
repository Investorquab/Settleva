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
