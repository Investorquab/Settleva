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
