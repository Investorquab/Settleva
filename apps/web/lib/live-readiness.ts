import { getAddress, isAddress } from "viem";
import { ARC_MAINNET_CHAIN_ID, ARC_USDC_ADDRESS } from "@settleva/sdk";
import { hasConfiguredReclaimAdapter } from "./reclaim-adapter-registry.ts";

export interface LiveReadinessConfig {
  readonly arcRpcUrl: string;
  readonly settlevaContractAddress: `0x${string}`;
  readonly verifierPrivateKey: `0x${string}`;
  readonly reclaimAppId: string;
  readonly reclaimAppSecret: string;
  readonly reclaimProviderId?: string;
  readonly reclaimProviderVersion?: string;
  readonly callbackUrl: string;
  readonly databaseUrl: string;
}

export class LiveReadinessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveReadinessConfigurationError";
  }
}

function required(
  env: Record<string, string | undefined>,
  name: string
): string {
  const value = env[name]?.trim();
  if (!value || /your_|placeholder|replace_me|user:password|host\/database/i.test(value)) {
    throw new LiveReadinessConfigurationError(name + " is missing or still contains a template value.");
  }
  return value;
}

/** Validates non-secret configuration consistency without exposing secrets in results. */
export function validateLiveReadinessEnvironment(
  env: Record<string, string | undefined>
): LiveReadinessConfig {
  const arcRpcUrl = required(env, "ARC_RPC_URL");
  let rpc: URL;
  try {
    rpc = new URL(arcRpcUrl);
  } catch {
    throw new LiveReadinessConfigurationError("ARC_RPC_URL must be an absolute HTTPS URL.");
  }
  if (rpc.protocol !== "https:" || rpc.username || rpc.password) {
    throw new LiveReadinessConfigurationError("ARC_RPC_URL must be HTTPS and must not embed credentials.");
  }

  if (required(env, "SETTLEVA_CHAIN_ID") !== String(ARC_MAINNET_CHAIN_ID)) {
    throw new LiveReadinessConfigurationError("SETTLEVA_CHAIN_ID must be 5042.");
  }
  if (required(env, "NEXT_PUBLIC_ARC_CHAIN_ID") !== String(ARC_MAINNET_CHAIN_ID)) {
    throw new LiveReadinessConfigurationError("NEXT_PUBLIC_ARC_CHAIN_ID must be 5042.");
  }

  const serverContract = required(env, "SETTLEVA_CONTRACT_ADDRESS");
  const publicContract = required(env, "NEXT_PUBLIC_SETTLEVA_ADDRESS");
  if (!isAddress(serverContract) || !isAddress(publicContract)) {
    throw new LiveReadinessConfigurationError("Server and public Settleva contract addresses must be valid EVM addresses.");
  }
  if (getAddress(serverContract) !== getAddress(publicContract)) {
    throw new LiveReadinessConfigurationError("Server and public Settleva contract addresses do not match.");
  }
  if (getAddress(serverContract) === "0x0000000000000000000000000000000000000000") {
    throw new LiveReadinessConfigurationError("A deployed Settleva contract address is required.");
  }

  const verifierPrivateKey = required(env, "SETTLEVA_VERIFIER_PRIVATE_KEY");
  if (!/^0x[0-9a-fA-F]{64}$/.test(verifierPrivateKey)) {
    throw new LiveReadinessConfigurationError("SETTLEVA_VERIFIER_PRIVATE_KEY must be a 32-byte EVM private key.");
  }

  const reclaimAppId = required(env, "RECLAIM_APP_ID");
  const reclaimAppSecret = required(env, "RECLAIM_APP_SECRET");
  const reclaimProviderId = env.RECLAIM_PROVIDER_ID?.trim() ? required(env,"RECLAIM_PROVIDER_ID") : undefined;
  const reclaimProviderVersion = env.RECLAIM_PROVIDER_VERSION?.trim() ? required(env,"RECLAIM_PROVIDER_VERSION") : undefined;
  if (Boolean(reclaimProviderId) !== Boolean(reclaimProviderVersion)) throw new LiveReadinessConfigurationError("RECLAIM_PROVIDER_ID and RECLAIM_PROVIDER_VERSION must be configured together.");
  if (reclaimProviderId && reclaimProviderVersion) {
    if (required(env,"NEXT_PUBLIC_RECLAIM_PROVIDER_ID") !== reclaimProviderId) throw new LiveReadinessConfigurationError("Public and server Reclaim provider IDs do not match.");
    if (required(env,"NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION") !== reclaimProviderVersion) throw new LiveReadinessConfigurationError("Public and server Reclaim provider versions do not match.");
  } else if (!hasConfiguredReclaimAdapter(env)) throw new LiveReadinessConfigurationError("Configure a default Reclaim provider pin or an explicit SETTLEVA_RECLAIM_ADAPTERS registry.");

  const callbackUrl = required(env, "RECLAIM_CALLBACK_URL");
  let callback: URL;
  try {
    callback = new URL(callbackUrl);
  } catch {
    throw new LiveReadinessConfigurationError("RECLAIM_CALLBACK_URL must be an absolute HTTPS URL.");
  }
  if (callback.protocol !== "https:" || callback.username || callback.password || /^(localhost|127\.|0\.0\.0\.0)(:|$)/i.test(callback.hostname)) {
    throw new LiveReadinessConfigurationError("RECLAIM_CALLBACK_URL must use a public HTTPS host without embedded credentials.");
  }
  if (callback.pathname.replace(/\/$/, "") !== "/api/reclaim/callback") {
    throw new LiveReadinessConfigurationError("RECLAIM_CALLBACK_URL must end in /api/reclaim/callback.");
  }

  const databaseUrl = required(env, "DATABASE_URL");
  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new LiveReadinessConfigurationError("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname || !database.pathname || database.pathname === "/") {
    throw new LiveReadinessConfigurationError("DATABASE_URL must point to a PostgreSQL database.");
  }

  return {
    arcRpcUrl,
    settlevaContractAddress: getAddress(serverContract),
    verifierPrivateKey: verifierPrivateKey as `0x${string}`,
    reclaimAppId,
    reclaimAppSecret,
    reclaimProviderId,
    reclaimProviderVersion,
    callbackUrl,
    databaseUrl
  };
}

/** Public asset identity for readiness responses; no key or secret is ever returned. */
export const LIVE_READINESS_ASSET = ARC_USDC_ADDRESS;
