import { keccak256, stringToHex } from "viem";
import type { ConditionClaim, PaymentCondition } from "./types.js";

function compareClaims(a: ConditionClaim, b: ConditionClaim): number {
  const left = [a.field, a.operator, a.value].join("\u0000");
  const right = [b.field, b.operator, b.value].join("\u0000");
  // Canonicalization must be runtime-independent. localeCompare() can vary
  // with locale/runtime configuration, so use deterministic UTF-16 code-unit
  // ordering instead.
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalizeCondition(condition: PaymentCondition): string {
  if (condition.version !== "1.0") throw new Error("Unsupported condition version");
  if (!condition.provider) throw new Error("Condition provider is required");
  if (!condition.providerVersion) throw new Error("Condition provider version is required");
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
    providerVersion: condition.providerVersion,
    claims,
    expiresAt: condition.expiresAt
  });
}

/** EVM-native digest used as the stable condition commitment. */
export function hashCondition(condition: PaymentCondition): `0x${string}` {
  return keccak256(stringToHex(canonicalizeCondition(condition)));
}

/** The exact Reclaim context committed by Settleva. */
export function buildProofContext(condition: PaymentCondition): string {
  return hashCondition(condition);
}

/** Hash of the exact proof context string expected by the settlement contract. */
export function hashProofContext(condition: PaymentCondition): `0x${string}` {
  return keccak256(stringToHex(buildProofContext(condition)));
}
