import { parseUnits } from "viem";

/**
 * Normalize a positive human-readable token amount to one unambiguous decimal
 * representation. This keeps equivalent inputs such as "01.5000" and "1.5"
 * from producing different payment IDs.
 */
export function normalizeTokenAmount(amount: string): string {
  if (typeof amount !== "string" || !/^\d+(?:\.\d+)?$/.test(amount)) {
    throw new Error("amount must be a positive decimal string without signs or exponent notation");
  }

  const [integerPart = "", fractionPart = ""] = amount.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fractionPart.replace(/0+$/, "");
  const normalized = normalizedFraction ? normalizedInteger + "." + normalizedFraction : normalizedInteger;

  if (normalized === "0") throw new Error("amount must be greater than zero");
  return normalized;
}

/**
 * Convert a human-readable amount to the token's atomic units. This validates
 * fractional precision before a wallet submits an ERC-20 transaction.
 */
export function toTokenUnits(amount: string, decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("token decimals must be an integer between 0 and 255");
  }
  const normalized = normalizeTokenAmount(amount);
  const fractionalDigits = normalized.split(".")[1]?.length ?? 0;
  if (fractionalDigits > decimals) {
    throw new Error("amount has more fractional digits than the token supports (" + decimals + ")");
  }
  try {
    return parseUnits(normalized, decimals);
  } catch {
    throw new Error("amount could not be represented in the token's atomic units");
  }
}
