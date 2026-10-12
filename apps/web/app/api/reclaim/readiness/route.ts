import { NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import postgres from "postgres";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Hex
} from "viem";
import {
  ARC_MAINNET_CHAIN_ID,
  ARC_USDC_ADDRESS,
  ARC_USDC_DECIMALS,
  SETTLEVA_ABI
} from "@settleva/sdk";
import { hashCondition, type PaymentCondition } from "@settleva/conditions";
import { buildReclaimProviderParams } from "../../../../lib/reclaim-binding.js";
import { validateLiveReadinessEnvironment } from "../../../../lib/live-readiness.js";
import { JsonRequestBodyError, readJsonRequestBody } from "../../../../lib/request-body.js";

export const runtime = "nodejs";

const zeroAddress = "0x0000000000000000000000000000000000000000";
const ERC20_METADATA_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "uint8"}]
  }
] as const;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache"
    }
  });
}

function parsePaymentContext(value: unknown): {paymentId: Hex; conditionHash: Hex} {
  if (typeof value !== "string") throw new Error("A payment commitment is required for readiness.");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error("The payment commitment is not valid JSON.");
  }
  if (typeof parsed.paymentId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.paymentId)
    || typeof parsed.conditionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.conditionHash)) {
    throw new Error("The payment commitment must bind paymentId and conditionHash.");
  }
  return {paymentId:parsed.paymentId as Hex, conditionHash:parsed.conditionHash as Hex};
}

function checkCondition(value: unknown): PaymentCondition {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A payment condition is required before funding.");
  }
  const condition = value as PaymentCondition;
  if (condition.version !== "1.0" || !Array.isArray(condition.claims)
    || !Number.isSafeInteger(condition.expiresAt) || condition.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("The condition must be valid and unexpired before funding.");
  }
  if (typeof condition.provider !== "string" || typeof condition.providerVersion !== "string"
    || !condition.provider.trim() || !condition.providerVersion.trim()) {
    throw new Error("The condition must pin a provider ID and exact version.");
  }
  return condition;
}

async function checkDatabase(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, {max:1, connect_timeout:8, idle_timeout:1});
  try {
    const probe = await sql`select 1 as ready`;
    if (Number(probe[0]?.ready) !== 1) throw new Error("database probe failed");

    const tables = await sql`
      select
        to_regclass('public.settleva_reclaim_sessions') as sessions_table,
        to_regclass('public.settleva_reclaim_replay') as replay_table
    `;
    if (!tables[0]?.sessions_table || !tables[0]?.replay_table) {
      throw new Error("session/replay tables missing");
    }

    const columns = await sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema='public'
        and table_name in ('settleva_reclaim_sessions','settleva_reclaim_replay')
    `;
    const existingColumns = new Set(columns.map((row) => row.table_name + "." + row.column_name));
    const requiredColumns = [
      "settleva_reclaim_sessions.session_id",
      "settleva_reclaim_sessions.payment_id",
      "settleva_reclaim_sessions.condition_hash",
      "settleva_reclaim_sessions.condition",
      "settleva_reclaim_sessions.provider_id",
      "settleva_reclaim_sessions.provider_version",
      "settleva_reclaim_sessions.status_token_hash",
      "settleva_reclaim_sessions.status",
      "settleva_reclaim_sessions.proof_identifier",
      "settleva_reclaim_sessions.verification_signature",
      "settleva_reclaim_replay.identifier_type",
      "settleva_reclaim_replay.identifier",
      "settleva_reclaim_replay.session_id",
      "settleva_reclaim_replay.proof_identifier",
      "settleva_reclaim_replay.payment_id",
      "settleva_reclaim_replay.condition_hash"
    ];
    if (requiredColumns.some((column) => !existingColumns.has(column))) {
      throw new Error("session/replay schema is incomplete; apply the documented database migration");
    }

    const indexes = await sql`
      select indexname from pg_indexes
      where schemaname='public'
        and indexname in (
          'settleva_reclaim_sessions_payment_idx',
          'settleva_reclaim_replay_session_idx',
          'settleva_reclaim_replay_proof_idx'
        )
    `;
    const existingIndexes = new Set(indexes.map((row) => row.indexname));
    if ([
      "settleva_reclaim_sessions_payment_idx",
      "settleva_reclaim_replay_session_idx",
      "settleva_reclaim_replay_proof_idx"
    ].some((indexName) => !existingIndexes.has(indexName))) {
      throw new Error("session/replay indexes are incomplete; apply the documented database migration");
    }
  } finally {
    await sql.end({timeout:3});
  }
}

export async function GET() {
  return privateJson({ready:false,error:"Use POST with a prepared policy and payment commitment."},405);
}

export async function POST(request: Request) {
  try {
    const body = await readJsonRequestBody<{condition?: unknown;proofContext?: unknown}>(request, 64 * 1024);
    const config = validateLiveReadinessEnvironment(process.env);
    const condition = checkCondition(body.condition);
    const context = parsePaymentContext(body.proofContext);
    const expectedConditionHash = hashCondition(condition);
    if (context.conditionHash.toLowerCase() !== expectedConditionHash.toLowerCase()) {
      return privateJson({ready:false,error:"The policy and prepared condition hash do not match."},400);
    }
    const providerParams = buildReclaimProviderParams(condition);

    // Resolve the actual configured provider before any allowance/funding transaction.
    let reclaimRequest: ReclaimProofRequest;
    try {
      reclaimRequest = await ReclaimProofRequest.init(
        config.reclaimAppId,
        config.reclaimAppSecret,
        condition.provider,
        {log:false, providerVersion:condition.providerVersion, useBrowserExtension:false}
      );
      const resolved = reclaimRequest.getProviderVersion();
      if (resolved.providerId !== condition.provider || resolved.providerVersion !== condition.providerVersion) {
        throw new Error("Resolved provider does not match the exact configured pin.");
      }
      reclaimRequest.setParams(providerParams);
      reclaimRequest.setAppCallbackUrl(config.callbackUrl, true);
      reclaimRequest.setContext(context.paymentId, context.conditionHash);
    } catch {
      return privateJson({
        ready:false,
        error:"Reclaim could not resolve the configured published provider/version with these app credentials. No wallet transaction has been requested."
      },503);
    }

    const verifierAccount = privateKeyToAccount(config.verifierPrivateKey);
    if (!isAddress(config.settlevaContractAddress) || getAddress(verifierAccount.address) === zeroAddress) {
      return privateJson({ready:false,error:"A valid deployed contract and dedicated verifier signer are required."},503);
    }

    const client = createPublicClient({transport:http(config.arcRpcUrl,{timeout:10_000})});
    let chainId: number;
    try {
      chainId = await client.getChainId();
    } catch {
      return privateJson({ready:false,error:"The configured Arc RPC did not respond. No wallet transaction has been requested."},503);
    }
    if (chainId !== ARC_MAINNET_CHAIN_ID) {
      return privateJson({ready:false,error:"The configured RPC is not Arc mainnet (chain ID 5042). No wallet transaction has been requested."},503);
    }

    try {
      const [contractCode, usdcCode, decimals, configuredToken, onchainSigner] = await Promise.all([
        client.getBytecode({address:config.settlevaContractAddress}),
        client.getBytecode({address:ARC_USDC_ADDRESS}),
        client.readContract({address:ARC_USDC_ADDRESS,abi:ERC20_METADATA_ABI,functionName:"decimals"}),
        client.readContract({address:config.settlevaContractAddress,abi:SETTLEVA_ABI,functionName:"ARC_USDC"}),
        client.readContract({address:config.settlevaContractAddress,abi:SETTLEVA_ABI,functionName:"verificationSigner"})
      ]);
      if (!contractCode || contractCode === "0x") throw new Error("no Settleva bytecode");
      if (!usdcCode || usdcCode === "0x") throw new Error("no Arc USDC bytecode");
      if (decimals !== ARC_USDC_DECIMALS) throw new Error("USDC ERC-20 decimals mismatch");
      if (getAddress(configuredToken) !== getAddress(ARC_USDC_ADDRESS)) throw new Error("deployed token allowlist mismatch");
      if (getAddress(onchainSigner) !== getAddress(verifierAccount.address)) throw new Error("deployed verification signer mismatch");
    } catch {
      return privateJson({
        ready:false,
        error:"The deployed contract, Arc USDC interface, or immutable verifier signer failed live-chain validation. No wallet transaction has been requested."
      },503);
    }

    try {
      await checkDatabase(config.databaseUrl);
    } catch {
      return privateJson({
        ready:false,
        error:"The production session/replay database is unavailable or incomplete. Apply the documented migration before funding. No wallet transaction has been requested."
      },503);
    }

    return privateJson({
      ready:true,
      chainId:ARC_MAINNET_CHAIN_ID,
      asset:ARC_USDC_ADDRESS,
      contractAddress:config.settlevaContractAddress,
      providerId:condition.provider,
      providerVersion:condition.providerVersion
    });
  } catch (error) {
    if (error instanceof JsonRequestBodyError) {
      return privateJson({ready:false,error:error.message},error.status);
    }
    const message = error instanceof Error
      && /payment commitment|valid JSON|payment condition|condition must be valid|must pin a provider/i.test(error.message)
      ? error.message
      : "Live settlement readiness could not be completed. Review server configuration and retry.";
    return privateJson({ready:false,error:message},503);
  }
}
