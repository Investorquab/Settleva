import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  keccak256,
  stringToHex,
  type Hex
} from "viem";
import type { PaymentCondition } from "@settleva/conditions";
import { ARC_MAINNET_CHAIN_ID, ARC_NATIVE_CURRENCY, ARC_USDC_ADDRESS, SETTLEVA_ABI } from "@settleva/sdk";
export { ARC_NATIVE_CURRENCY };

export interface SettlementPaymentSnapshot {
  readonly expiry: bigint;
  readonly token: string;
  readonly conditionHash: string;
  readonly providerHash: string;
  readonly status: number;
}

export class SettlementChainConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementChainConfigurationError";
  }
}

export class SettlementChainRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementChainRpcError";
  }
}

export type SettlementPaymentStateErrorCode =
  | "PAYMENT_NOT_FUNDED"
  | "PAYMENT_TOKEN_MISMATCH"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_EXPIRY_MISMATCH"
  | "PAYMENT_CONDITION_MISMATCH"
  | "PAYMENT_PROVIDER_MISMATCH";

export class SettlementPaymentStateError extends Error {
  readonly code: SettlementPaymentStateErrorCode;

  constructor(code: SettlementPaymentStateErrorCode, message: string) {
    super(message);
    this.name = "SettlementPaymentStateError";
    this.code = code;
  }
}

/** Pure state binding guard so it can be exercised without a live RPC endpoint. */
export function assertFundedPaymentSnapshot(
  payment: SettlementPaymentSnapshot,
  condition: PaymentCondition,
  expectedConditionHash: Hex,
  now = Math.floor(Date.now() / 1000)
): void {
  if (payment.status !== 1) {
    throw new SettlementPaymentStateError("PAYMENT_NOT_FUNDED", "The on-chain payment is not in Funded state.");
  }
  if (payment.token.toLowerCase() !== ARC_USDC_ADDRESS.toLowerCase()) {
    throw new SettlementPaymentStateError("PAYMENT_TOKEN_MISMATCH", "The funded payment does not use Arc USDC.");
  }
  if (payment.conditionHash.toLowerCase() !== expectedConditionHash.toLowerCase()) {
    throw new SettlementPaymentStateError("PAYMENT_CONDITION_MISMATCH", "On-chain condition hash does not match the submitted policy.");
  }
  const expectedProviderHash = keccak256(stringToHex(condition.provider));
  if (payment.providerHash.toLowerCase() !== expectedProviderHash.toLowerCase()) {
    throw new SettlementPaymentStateError("PAYMENT_PROVIDER_MISMATCH", "On-chain provider hash does not match the policy provider.");
  }
  if (!Number.isSafeInteger(condition.expiresAt) || payment.expiry !== BigInt(condition.expiresAt)) {
    throw new SettlementPaymentStateError("PAYMENT_EXPIRY_MISMATCH", "On-chain payment expiry must exactly match condition.expiresAt.");
  }
  if (!Number.isSafeInteger(now) || payment.expiry <= BigInt(now)) {
    throw new SettlementPaymentStateError("PAYMENT_EXPIRED", "The on-chain payment has expired and cannot be released.");
  }
}

/**
 * Read the real Arc mainnet payment and fail closed unless its on-chain state
 * exactly matches the condition the backend is being asked to verify.
 */
export async function assertFundedPaymentOnchain(
  paymentId: Hex,
  condition: PaymentCondition,
  expectedConditionHash: Hex
): Promise<void> {
  const configuredChainId = process.env.SETTLEVA_CHAIN_ID;
  const rpcUrl = process.env.ARC_RPC_URL;
  const contractAddress = process.env.SETTLEVA_CONTRACT_ADDRESS;

  if (!configuredChainId || !/^\d+$/.test(configuredChainId) || Number(configuredChainId) !== ARC_MAINNET_CHAIN_ID) {
    throw new SettlementChainConfigurationError("SETTLEVA_CHAIN_ID must be 5042 for Arc mainnet verification.");
  }
  if (!rpcUrl || !/^https:\/\//i.test(rpcUrl)) {
    throw new SettlementChainConfigurationError("ARC_RPC_URL must be an HTTPS Arc mainnet RPC endpoint.");
  }
  if (!contractAddress || !isAddress(contractAddress)) {
    throw new SettlementChainConfigurationError("SETTLEVA_CONTRACT_ADDRESS must be the deployed Settleva mainnet contract.");
  }

  const address = getAddress(contractAddress);
  const chain = {
    id: ARC_MAINNET_CHAIN_ID,
    name: "Arc",
    nativeCurrency: ARC_NATIVE_CURRENCY,
    rpcUrls: { default: { http: [rpcUrl] } }
  } as const;
  const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 10_000 }) });

  let actualChainId: number;
  try {
    actualChainId = await client.getChainId();
  } catch {
    throw new SettlementChainRpcError("Could not confirm the configured RPC chain ID.");
  }
  if (actualChainId !== ARC_MAINNET_CHAIN_ID) {
    throw new SettlementChainConfigurationError("ARC_RPC_URL returned chain ID " + actualChainId + ", not Arc mainnet 5042.");
  }

  let payment: readonly [string, string, string, bigint, bigint, Hex, Hex, number];
  try {
    payment = await client.readContract({
      address,
      abi: SETTLEVA_ABI,
      functionName: "payments",
      args: [paymentId]
    }) as unknown as readonly [string, string, string, bigint, bigint, Hex, Hex, number];
  } catch {
    throw new SettlementChainRpcError("Could not read payment state from the configured Arc mainnet contract.");
  }

  assertFundedPaymentSnapshot({
    expiry: payment[4],
    token: payment[2],
    conditionHash: payment[5],
    providerHash: payment[6],
    status: payment[7]
  }, condition, expectedConditionHash);
}
