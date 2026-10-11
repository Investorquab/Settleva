import type { PaymentCondition } from "@settleva/conditions";
import { hashCondition } from "@settleva/conditions";
import { keccak256, stringToHex } from "viem";
import { normalizeTokenAmount } from "./amount.js";
import { ARC_USDC_ADDRESS } from "./arc.js";
import { derivePaymentId } from "./payment-id.js";

export interface CreatePaymentInput {
  readonly payer: `0x${string}`;
  readonly payee: `0x${string}`;
  readonly token: `0x${string}`;
  /** Human-readable token amount, normalized before a payment ID is derived. */
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

/**
 * Prepare a deterministic payment commitment.
 *
 * The payment and policy must share the same future expiry. The SDK does not
 * submit transactions, verify external evidence, custody funds or sign release
 * attestations; those operations remain in the host application/backend.
 */
export function prepareCreatePayment(input: CreatePaymentInput): PreparedCreatePayment {
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.payer)) throw new Error("payer must be an EVM address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.payee)) throw new Error("payee must be an EVM address");
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.token)) throw new Error("token must be an EVM address");
  if (input.token.toLowerCase() !== ARC_USDC_ADDRESS.toLowerCase()) {
    throw new Error("Settleva supports Arc USDC only; token must be " + ARC_USDC_ADDRESS);
  }

  const amount = normalizeTokenAmount(input.amount);
  const conditionHash = hashCondition(input.condition);
  if (!Number.isSafeInteger(input.expiry) || input.expiry <= Math.floor(Date.now() / 1000)) {
    throw new Error("expiry must be a future Unix timestamp in seconds");
  }
  if (input.condition.expiresAt !== input.expiry) {
    throw new Error("payment expiry must exactly match condition.expiresAt");
  }

  const request: CreatePaymentInput = { ...input, amount };
  const paymentId = derivePaymentId(request);
  const providerHash = keccak256(stringToHex(input.condition.provider));
  const proofContext = JSON.stringify({paymentId, conditionHash});

  return {paymentId, conditionHash, providerHash, proofContext, request};
}
