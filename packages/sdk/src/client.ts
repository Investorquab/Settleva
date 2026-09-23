import type { PaymentCondition } from "@settleva/conditions";
import { hashCondition } from "@settleva/conditions";
import { derivePaymentId } from "./payment-id.js";
import { keccak256, stringToHex } from "viem";

export interface CreatePaymentInput {
  readonly payer: `0x${string}`;
  readonly payee: `0x${string}`;
  readonly token: `0x${string}`;
  readonly amount: string;
  readonly expiry: number;
  readonly condition: PaymentCondition;
}

export interface PreparedCreatePayment {
  readonly paymentId: `0x${string}`;
  readonly conditionHash: `0x${string}`;
  readonly providerHash: `0x${string}`;
  readonly proofContext: string;
  readonly request: CreatePaymentInput;
}

export function prepareCreatePayment(input: CreatePaymentInput): PreparedCreatePayment {
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.payer)) throw new Error("payer must be an EVM address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.payee)) throw new Error("payee must be an EVM address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.token)) throw new Error("token must be an EVM address");
  if (!/^\d+(?:\.\d+)?$/.test(input.amount) || input.amount === "0") throw new Error("amount must be a positive decimal string");
  if (!Number.isSafeInteger(input.expiry) || input.expiry <= 0) throw new Error("expiry must be a positive safe integer");

  const paymentId = derivePaymentId(input);
  const conditionHash = hashCondition(input.condition);
  const providerHash = keccak256(stringToHex(input.condition.provider));
  const proofContext = JSON.stringify({paymentId, conditionHash});

  return {paymentId, conditionHash, providerHash, proofContext, request:input};
}