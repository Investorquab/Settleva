import { keccak256, stringToHex } from "viem";
import type { ConditionClaim, PaymentCondition } from "./types.js";

function compareClaims(a: ConditionClaim, b: ConditionClaim): number {
  // Compare each component independently. Delimiter concatenation can become
  // ambiguous when user-controlled strings contain the delimiter.
  if (a.field !== b.field) return a.field < b.field ? -1 : 1;
  const leftOperator: string = a.operator;
  const rightOperator: string = b.operator;
  if (leftOperator !== rightOperator) return leftOperator < rightOperator ? -1 : 1;
  if (a.value !== b.value) return a.value < b.value ? -1 : 1;
  return 0;
}

function assertConditionShape(condition: PaymentCondition): void {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    throw new Error("Condition must be an object");
  }
  if (condition.version !== "1.0") throw new Error("Unsupported condition version");
  if (typeof condition.provider !== "string" || !condition.provider.trim()) {
    throw new Error("Condition provider is required");
  }
  if (typeof condition.providerVersion !== "string" || !condition.providerVersion.trim()) {
    throw new Error("Condition provider version is required");
  }
  if (!Number.isSafeInteger(condition.expiresAt) || condition.expiresAt < 0) {
    throw new Error("expiresAt must be a non-negative safe integer");
  }
  if (!Array.isArray(condition.claims) || condition.claims.length === 0) {
    throw new Error("Condition must contain at least one claim");
  }

  const fields = new Set<string>();
  for (const claim of condition.claims) {
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
      throw new Error("Condition claim must be an object");
    }
    if (typeof claim.field !== "string" || !claim.field.trim()) {
      throw new Error("Condition claim field is required");
    }
    if (claim.operator !== "equals") {
      throw new Error("Condition claim operator is unsupported");
    }
    if (typeof claim.value !== "string") {
      throw new Error("Condition claim value must be a string");
    }
    if (fields.has(claim.field)) {
      throw new Error("Duplicate condition claim field: " + claim.field);
    }
    fields.add(claim.field);
  }
}

export function canonicalizeCondition(condition: PaymentCondition): string {
  assertConditionShape(condition);
  const claims = [...condition.claims].sort(compareClaims).map((claim) => ({
    field: claim.field,
    operator: claim.operator,
    value: claim.value
  }));

  return JSON.stringify({
    version: condition.version,
    provider: condition.provider,
    providerVersion: condition.providerVersion,
    claims,
    expiresAt: condition.expiresAt
  });
}

/** EVM-native digest used as the stable condition commitment. */
export function hashCondition(condition: PaymentCondition): `0x${string}` {
  return keccak256(stringToHex(canonicalizeCondition(condition)));
}

/** The condition hash itself is the context message used by the Reclaim flow. */
export function buildProofContext(condition: PaymentCondition): string {
  return hashCondition(condition);
}

/** Hash of the exact proof context string expected by the settlement contract. */
export function hashProofContext(condition: PaymentCondition): `0x${string}` {
  return keccak256(stringToHex(buildProofContext(condition)));
}
