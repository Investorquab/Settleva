import { NextResponse } from "next/server";
import { evaluateClaims } from "@settleva/conditions";
import { ARC_MAINNET_CHAIN_ID, SETTLEVA_ABI, buildVerificationAttestationHash } from "@settleva/sdk";
import { PostgresReplayStore } from "@settleva/verification";
import { createPublicClient, getAddress, http, isAddress, keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SignedEvidenceError, verifySignedEvidenceRequest, type SignedEvidenceEnvelope } from "../../../../lib/signed-evidence.js";
import { JsonRequestBodyError, readRawRequestBody } from "../../../../lib/request-body.js";
import {
  assertFundedPaymentOnchain,
  SettlementChainConfigurationError,
  SettlementChainRpcError,
  SettlementPaymentStateError
} from "../../../../lib/settlement-chain.js";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 64 * 1024;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET() {
  return privateJson({ verified: false, error: "POST a provider-signed event to this endpoint." }, 405);
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return privateJson({ verified: false, error: "Content-Type must be application/json." }, 415);
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readRawRequestBody(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof JsonRequestBodyError) {
      return privateJson({ verified: false, error: error.message }, error.status);
    }
    return privateJson({ verified: false, error: "Request body could not be read." }, 400);
  }

  let evidence: SignedEvidenceEnvelope;
  try {
    evidence = verifySignedEvidenceRequest({
      rawBody,
      timestamp: request.headers.get("x-settleva-timestamp"),
      signature: request.headers.get("x-settleva-signature")
    });
  } catch (error) {
    if (error instanceof SignedEvidenceError) {
      const status = error.code === "CONFIGURATION" ? 503
        : error.code === "PROVIDER_NOT_REGISTERED" ? 403
        : error.code === "INVALID_SIGNATURE" || error.code === "STALE_REQUEST" ? 401
        : 400;
      return privateJson({ verified: false, error: error.message }, status);
    }
    return privateJson({ verified: false, error: "Signed evidence could not be validated." }, 400);
  }

  const evaluation = evaluateClaims(evidence.condition, evidence.claims);
  if (!evaluation.valid) {
    return privateJson({
      verified: false,
      error: "Authenticated evidence does not satisfy the exact committed payment condition."
    }, 422);
  }

  const databaseUrl = process.env.DATABASE_URL;
  const verifierPrivateKey = process.env.SETTLEVA_VERIFIER_PRIVATE_KEY;
  const rpcUrl = process.env.ARC_RPC_URL;
  const contractAddress = process.env.SETTLEVA_CONTRACT_ADDRESS;
  if (!databaseUrl || !verifierPrivateKey || !rpcUrl || !contractAddress
    || !/^0x[0-9a-fA-F]{64}$/.test(verifierPrivateKey)
    || process.env.SETTLEVA_CHAIN_ID !== String(ARC_MAINNET_CHAIN_ID)
    || !isAddress(contractAddress)) {
    return privateJson({ verified: false, error: "Mainnet signer, Arc RPC, contract or database configuration is incomplete." }, 503);
  }

  let verificationSigner: ReturnType<typeof privateKeyToAccount>;
  try {
    verificationSigner = privateKeyToAccount(verifierPrivateKey as Hex);
  } catch {
    return privateJson({ verified: false, error: "The configured settlement signer is invalid." }, 503);
  }
  const verifyingContract = getAddress(contractAddress);

  try {
    await assertFundedPaymentOnchain(evidence.paymentId, evidence.condition, evidence.conditionHash);
    const client = createPublicClient({ transport: http(rpcUrl, { timeout: 10_000 }) });
    const [chainId, deployedSigner] = await Promise.all([
      client.getChainId(),
      client.readContract({ address: verifyingContract, abi: SETTLEVA_ABI, functionName: "verificationSigner" })
    ]);
    if (chainId !== ARC_MAINNET_CHAIN_ID || getAddress(deployedSigner) !== verificationSigner.address) {
      return privateJson({
        verified: false,
        error: "Arc contract verification signer does not match the configured server signer."
      }, 503);
    }
  } catch (error) {
    if (error instanceof SettlementPaymentStateError) {
      return privateJson({ verified: false, error: "The on-chain payment is not eligible for settlement." }, 409);
    }
    if (error instanceof SettlementChainConfigurationError || error instanceof SettlementChainRpcError) {
      return privateJson({ verified: false, error: "Arc payment validation is unavailable; no attestation was issued." }, 503);
    }
    return privateJson({ verified: false, error: "Could not validate the deployed Arc contract and signer." }, 503);
  }

  // Length-prefixed components make this identifier unambiguous even if IDs contain punctuation.
  const sessionId = [evidence.providerId, evidence.providerVersion, evidence.eventId]
    .map((part) => part.length + ":" + part)
    .join("|");
  const replayStore = new PostgresReplayStore(databaseUrl);
  let accepted: boolean;
  try {
    try {
      accepted = await replayStore.claim({
        sessionId,
        proofIdentifier: evidence.proofIdentifier,
        paymentId: evidence.paymentId,
        conditionHash: evidence.conditionHash
      });
    } catch {
      return privateJson({ verified: false, error: "Persistent replay protection is unavailable; no attestation was issued." }, 503);
    }
  } finally {
    await replayStore.close().catch(() => undefined);
  }
  if (!accepted) {
    return privateJson({ verified: false, error: "This provider event or proof is already bound to a different payment context." }, 409);
  }

  try {
    const verificationSignature = await verificationSigner.signMessage({
      message: {
        raw: buildVerificationAttestationHash({
          chainId: BigInt(ARC_MAINNET_CHAIN_ID),
          verifyingContract,
          paymentId: evidence.paymentId,
          conditionHash: evidence.conditionHash,
          providerHash: keccak256(stringToHex(evidence.providerId)),
          proofIdentifier: evidence.proofIdentifier
        })
      }
    });
    return privateJson({
      verified: true,
      chainId: ARC_MAINNET_CHAIN_ID,
      providerId: evidence.providerId,
      providerVersion: evidence.providerVersion,
      eventId: evidence.eventId,
      paymentId: evidence.paymentId,
      conditionHash: evidence.conditionHash,
      proofIdentifier: evidence.proofIdentifier,
      verificationSigner: verificationSigner.address,
      verificationSignature
    });
  } catch {
    return privateJson({ verified: false, error: "Settlement attestation signing failed." }, 503);
  }
}
