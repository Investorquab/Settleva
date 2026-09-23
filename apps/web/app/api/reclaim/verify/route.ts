import { NextResponse } from "next/server";
import { ReclaimProofRequest, verifyProof } from "@reclaimprotocol/js-sdk";
import { evaluateClaims, hashCondition, type PaymentCondition } from "@settleva/conditions";
import { buildVerificationAttestationHash } from "@settleva/sdk";
import { keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { findMatchingVerifiedProofData } from "../verified-data.js";

export const runtime = "nodejs";

function isPaymentCondition(value: unknown): value is PaymentCondition {
  if (!value || typeof value !== "object") return false;
  const condition = value as Record<string, unknown>;
  return condition.version === "1.0"
    && typeof condition.provider === "string"
    && typeof condition.providerVersion === "string"
    && Array.isArray(condition.claims)
    && Number.isSafeInteger(condition.expiresAt)
    && condition.claims.every((claim) =>
      !!claim && typeof claim === "object"
      && typeof (claim as Record<string, unknown>).field === "string"
      && (claim as Record<string, unknown>).operator === "equals"
      && typeof (claim as Record<string, unknown>).value === "string"
    );
}

function parseProofContext(value: string): {paymentId:string;conditionHash:Hex} | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.paymentId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.paymentId)) return null;
    if (typeof parsed.conditionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.conditionHash)) return null;
    return {paymentId:parsed.paymentId,conditionHash:parsed.conditionHash as Hex};
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {proofs?:unknown;expectedContext?:string;condition?:unknown;sessionId?:string};
    if (!Array.isArray(body.proofs) || body.proofs.length !== 1) {
      return NextResponse.json({error:"Exactly one Reclaim proof is required for this payment condition."},{status:400});
    }
    if (typeof body.expectedContext !== "string") return NextResponse.json({error:"Expected proof context is required."},{status:400});
    if (typeof body.sessionId !== "string" || body.sessionId.length < 8) return NextResponse.json({error:"The Reclaim session ID is required."},{status:400});
    if (!isPaymentCondition(body.condition)) return NextResponse.json({error:"The exact payment condition is required."},{status:400});

    const condition = body.condition;
    const committed = parseProofContext(body.expectedContext);
    if (!committed) return NextResponse.json({verified:false,error:"Expected proof context is not a valid Settleva binding."},{status:400});
    if (hashCondition(condition) !== committed.conditionHash) return NextResponse.json({verified:false,error:"Payment condition does not match the committed proof context."},{status:400});

    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const configuredProviderId = process.env.RECLAIM_PROVIDER_ID;
    const configuredProviderVersion = process.env.RECLAIM_PROVIDER_VERSION;
    const verifierPrivateKey = process.env.SETTLEVA_VERIFIER_PRIVATE_KEY as Hex | undefined;
    if (!appId || !appSecret || !configuredProviderId || !configuredProviderVersion || !verifierPrivateKey) {
      return NextResponse.json({error:"Reclaim credentials, pinned provider version, and Settleva verifier signing key are not configured."},{status:503});
    }
    if (condition.provider !== configuredProviderId) return NextResponse.json({verified:false,error:"Payment condition provider does not match the configured Reclaim provider."},{status:400});
    if (condition.providerVersion !== configuredProviderVersion) return NextResponse.json({verified:false,error:"Payment condition provider version does not match the configured Reclaim provider version."},{status:400});

    const requestConfig = await ReclaimProofRequest.init(appId,appSecret,configuredProviderId,{log:false});
    const {providerId,providerVersion} = requestConfig.getProviderVersion();
    if (providerId !== configuredProviderId || providerVersion !== configuredProviderVersion) {
      return NextResponse.json({verified:false,error:"Configured Reclaim provider version does not match the provider version resolved for this request."},{status:503});
    }

    const result = await verifyProof(body.proofs,{providerId,providerVersion});
    if (!result.isVerified) return NextResponse.json({verified:false,error:result.error?.message || "Reclaim rejected the proof."},{status:400});

    const proof = body.proofs[0] as Record<string, unknown>;
    const claimData = proof.claimData as Record<string, unknown> | undefined;
    const proofIdentifier = claimData?.identifier;
    if (typeof proofIdentifier !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(proofIdentifier)) {
      return NextResponse.json({verified:false,error:"Verified Reclaim proof has no valid claim identifier."},{status:400});
    }

    const data = Array.isArray(result.data) ? result.data : [];
    const matchingProof = findMatchingVerifiedProofData(data, {
      sessionId: body.sessionId,
      paymentId: committed.paymentId,
      conditionHash: committed.conditionHash
    });
    if (!matchingProof) {
      return NextResponse.json({
        verified:false,
        error:"Proof is not bound to the initiated Reclaim session, payment, condition, and verified extracted parameters."
      },{status:400});
    }

    const extracted = matchingProof.extractedParameters!;
    const claims = Object.entries(extracted).map(([field,value]) => ({field,value:String(value)}));
    const evaluation = evaluateClaims(condition,claims);
    if (!evaluation.valid) return NextResponse.json({verified:false,error:"Condition failed.",failures:evaluation.failures,claims},{status:400});

    const account = privateKeyToAccount(verifierPrivateKey);
    const attestationHash = buildVerificationAttestationHash({
      paymentId: committed.paymentId as Hex,
      conditionHash: committed.conditionHash,
      providerHash: keccak256(stringToHex(providerId)),
      proofIdentifier: proofIdentifier as Hex
    });
    const verificationSignature = await account.signMessage({message:{raw:attestationHash}});

    return NextResponse.json({
      verified:true,
      providerId,
      providerVersion,
      claims,
      data:result.data,
      proofIdentifier,
      verificationSigner:account.address,
      verificationSignature
    });
  } catch (error) {
    return NextResponse.json({verified:false,error:error instanceof Error ? error.message:"Proof verification failed."},{status:500});
  }
}
