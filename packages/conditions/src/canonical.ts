import { createHash } from "node:crypto";
import type { ConditionClaim, PaymentCondition } from "./types.js";

function compareClaims(a: ConditionClaim, b: ConditionClaim): number {
  return [a.field, a.operator, a.value].join("\u0000")
    .localeCompare([b.field, b.operator, b.value].join("\u0000"));
}

export function canonicalizeCondition(condition: PaymentCondition): string {
  if (condition.version !== "1.0") throw new Error("Unsupported condition version");
  if (!condition.provider) throw new Error("Condition provider is required");
  if (!Number.isSafeInteger(condition.expiresAt) || condition.expiresAt < 0) {
    throw new Error("expiresAt must be a non-negative safe integer");
  }

  const claims = [...condition.claims].sort(compareClaims).map((claim) => {
    if (!claim.field || claim.operator !== "equals") {
      throw new Error("Condition claim is invalid");
    }
    return {field:claim.field, operator:claim.operator, value:claim.value};
  });

  return JSON.stringify({
    version: condition.version,
    provider: condition.provider,
    claims,
    expiresAt: condition.expiresAt
  });
}

export function hashCondition(condition: PaymentCondition): `0x${string}` {
  return `0x${createHash("sha256").update(canonicalizeCondition(condition),"utf8").digest("hex")}`;
}
