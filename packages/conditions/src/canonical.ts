import { createHash } from "node:crypto";
import type { PaymentCondition } from "./types.js";

export function canonicalizeCondition(condition: PaymentCondition): string {
  if (condition.version !== "1.0") throw new Error("Unsupported condition version");
  if (!condition.provider) throw new Error("Condition provider is required");
  if (!Number.isSafeInteger(condition.expiresAt) || condition.expiresAt < 0) throw new Error("expiresAt must be a non-negative safe integer");
  const claims = [...condition.claims].map((claim) => ({ field: claim.field, operator: claim.operator, value: claim.value })).sort((a,b) => a.field.localeCompare(b.field));
  return JSON.stringify({version:condition.version,provider:condition.provider,claims,expiresAt:condition.expiresAt});
}

export function hashCondition(condition: PaymentCondition): `0x${string}` {
  return `0x${createHash("sha256").update(canonicalizeCondition(condition)).digest("hex")}`;
}
