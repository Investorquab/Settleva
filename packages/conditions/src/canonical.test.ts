import { buildProofContext, canonicalizeCondition, hashCondition, hashProofContext } from "./canonical.js";

const condition = {
  version: "1.0" as const,
  provider: "github",
  claims: [
    { field: "repo.public", operator: "equals" as const, value: "true" },
    { field: "repo.owner", operator: "equals" as const, value: "Investorquab" }
  ],
  expiresAt: 1_800_000_000
};

if (!canonicalizeCondition(condition).includes('"provider":"github"')) throw new Error("canonicalization failed");
if (!hashCondition(condition).startsWith("0x") || hashCondition(condition).length !== 66) throw new Error("condition hash failed");
if (buildProofContext(condition) !== hashCondition(condition)) throw new Error("proof context mismatch");
if (hashProofContext(condition).length !== 66) throw new Error("context hash failed");
