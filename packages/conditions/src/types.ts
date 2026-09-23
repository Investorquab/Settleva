export type ConditionOperator = "equals";

export interface ConditionClaim {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: string;
}

export interface PaymentCondition {
  readonly version: "1.0";
  readonly provider: string;
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
  claims: readonly VerifiedClaim[]
): ConditionEvaluation {
  const failures: string[] = [];
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
