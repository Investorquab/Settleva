import { keccak256, stringToHex } from "viem";
import { canonicalizeCondition, type PaymentCondition } from "@settleva/conditions";

export interface PaymentIdInput {
  readonly payer: string;
  readonly payee: string;
  readonly token: string;
  readonly amount: string;
  readonly expiry: number;
  readonly condition: PaymentCondition;
}

export function derivePaymentId(input: PaymentIdInput): `0x${string}` {
  const payload = JSON.stringify({
    payer: input.payer.toLowerCase(),
    payee: input.payee.toLowerCase(),
    token: input.token.toLowerCase(),
    amount: input.amount,
    expiry: input.expiry,
    condition: canonicalizeCondition(input.condition)
  });

  return keccak256(stringToHex(payload));
}
