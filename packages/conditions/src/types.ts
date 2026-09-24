export type ConditionOperator = "equals";

export interface ConditionClaim {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: string;
}

export interface PaymentCondition {
  readonly version: "1.0";
  readonly provider: string;
  readonly providerVersion: string;
  readonly claims: readonly ConditionClaim[];
  readonly expiresAt: number;
}

export interface VerifiedClaim {
  readonly field: string;
  readonly value: string;
}

export interface ConditionEvaluation {
  readonly valid: boolean;
  readonly failures: readonly string[];
}

export function evaluateClaims(
  condition: PaymentCondition,
  claims: readonly VerifiedClaim[],
  now = Math.floor(Date.now() / 1000)
): ConditionEvaluation {
  const failures: string[] = [];
  const expectedFields = new Set<string>();
  for (const expected of condition.claims) {
    if (expectedFields.has(expected.field)) failures.push(`DUPLICATE_CONDITION_CLAIM:${expected.field}`);
    expectedFields.add(expected.field);
  }
  const verifiedFields = new Set<string>();
  for (const claim of claims) {
    if (verifiedFields.has(claim.field)) failures.push(`DUPLICATE_VERIFIED_CLAIM:${claim.field}`);
    verifiedFields.add(claim.field);
  }
  if (!Number.isSafeInteger(now) || now >= condition.expiresAt) {
    failures.push("CONDITION_EXPIRED");
  }
  for (const expected of condition.claims) {
    const actual = claims.find((claim) => claim.field === expected.field);
    if (!actual) {
      failures.push(`MISSING_CLAIM:${expected.field}`);
      continue;
    }
    if (expected.operator === "equals" && actual.value !== expected.value) {
      failures.push(`VALUE_MISMATCH:${expected.field}`);
    }
  }
  return {valid: failures.length === 0, failures};
}
