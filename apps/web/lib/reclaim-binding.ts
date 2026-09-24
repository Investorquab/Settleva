import type { Hex } from "viem";

export interface ParsedProofContext {
  readonly paymentId: string;
  readonly conditionHash: Hex;
}

export interface VerifiedClaim {
  readonly field: string;
  readonly value: string;
}

export function parseProofContext(value: string): ParsedProofContext | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.paymentId !== "string"
      || !/^0x[0-9a-fA-F]{64}$/.test(parsed.paymentId)
    ) return null;
    if (
      typeof parsed.conditionHash !== "string"
      || !/^0x[0-9a-fA-F]{64}$/.test(parsed.conditionHash)
    ) return null;

    return {
      paymentId: parsed.paymentId,
      conditionHash: parsed.conditionHash as Hex
    };
  } catch {
    return null;
  }
}

export function parseProofIdentifier(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? value
    : null;
}

export function extractedParametersToClaims(
  extractedParameters: Record<string, unknown>
): VerifiedClaim[] {
  return Object.entries(extractedParameters).map(([field, value]) => ({
    field,
    value: String(value)
  }));
}
