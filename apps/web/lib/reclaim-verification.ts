import { ReclaimProofRequest, verifyProof } from "@reclaimprotocol/js-sdk";
import { evaluateClaims, hashCondition, type PaymentCondition } from "@settleva/conditions";
import { buildVerificationAttestationHash } from "@settleva/sdk";
import { extractGitHubDeploymentClaims, isGitHubDeploymentCondition } from "@settleva/providers";
import { findMatchingVerifiedProofData, PostgresReplayStore } from "@settleva/verification";
import { keccak256, stringToHex, type Hex } from "viem";
import { extractedParametersToClaims } from "./reclaim-binding.js";
import {
  assertConditionCommitment,
  assertConditionEvaluation,
  assertGitHubDeploymentEvidence,
  assertProofIdentifier,
  assertProviderPin,
  assertResolvedProviderPin,
  assertSingleProof,
  assertVerifiedContextBinding,
  assertVerifiedProofDataBinding
} from "./reclaim-decision.js";
import { privateKeyToAccount } from "viem/accounts";

export interface ReclaimVerificationInput {
  readonly proofs: unknown[];
  readonly sessionId: string;
  readonly condition: PaymentCondition;
  readonly expectedPaymentId: string;
  readonly expectedConditionHash: Hex;
  readonly expectedProviderId: string;
  readonly expectedProviderVersion: string;
}

export class ReclaimVerificationError extends Error {
  readonly code: "INVALID" | "REPLAY" | "DATABASE";

  constructor(code: "INVALID" | "REPLAY" | "DATABASE", message: string) {
    super(message);
    this.name = "ReclaimVerificationError";
    this.code = code;
  }
}

export interface ReclaimVerificationResult {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly claims: readonly {field:string;value:string}[];
  readonly proof: unknown;
  readonly proofIdentifier: string;
  readonly verificationSigner: string;
  readonly verificationSignature: Hex;
}

export async function verifyReclaimAndAttest(input: ReclaimVerificationInput): Promise<ReclaimVerificationResult> {
  assertSingleProof(input.proofs);
  assertConditionCommitment(
    input.condition,
    input.expectedConditionHash,
    hashCondition(input.condition)
  );

  const appId = process.env.RECLAIM_APP_ID;
  const appSecret = process.env.RECLAIM_APP_SECRET;
  const verifierPrivateKey = process.env.SETTLEVA_VERIFIER_PRIVATE_KEY as Hex | undefined;
  if (!appId || !appSecret || !verifierPrivateKey) throw new Error("Reclaim credentials and Settleva verifier signing key are not configured.");
  assertProviderPin(input.condition,input.expectedProviderId,input.expectedProviderVersion);

  const requestConfig = await ReclaimProofRequest.init(appId,appSecret,input.expectedProviderId,{log:false});
  const {providerId,providerVersion} = requestConfig.getProviderVersion();
  assertResolvedProviderPin(providerId,providerVersion,input.expectedProviderId,input.expectedProviderVersion);

  const result = await verifyProof(input.proofs as Parameters<typeof verifyProof>[0],{providerId,providerVersion});
  if (!result.isVerified) throw new Error(result.error?.message || "Reclaim rejected the proof.");

  const proof = input.proofs[0] as Record<string, unknown>;
  const claimData = proof.claimData as Record<string, unknown> | undefined;
  const proofIdentifier = assertProofIdentifier(claimData?.identifier);

  const data = Array.isArray(result.data) ? result.data : [];
  const matchingProof = findMatchingVerifiedProofData(data,{
    sessionId:input.sessionId,
    paymentId:input.expectedPaymentId,
    conditionHash:input.expectedConditionHash
  });
  assertVerifiedProofDataBinding(Boolean(matchingProof));

  const contextValue = matchingProof?.context?.contextMessage;
  assertVerifiedContextBinding(contextValue,input.expectedConditionHash);

  const claims = extractedParametersToClaims(matchingProof!.extractedParameters!);

  // The first production provider is intentionally schema-pinned: when the
  // committed condition is the GitHub deployment condition, require the
  // complete five-field deployment evidence shape before evaluation.
  assertGitHubDeploymentEvidence(
    isGitHubDeploymentCondition(input.condition),
    Boolean(extractGitHubDeploymentClaims(claims))
  );

  const evaluation = evaluateClaims(input.condition,claims);
  assertConditionEvaluation(evaluation.valid,evaluation.failures);

  // Sign before claiming replay state so a signing failure cannot consume the
  // session/proof binding and leave a valid callback permanently unrecoverable.
  const account = privateKeyToAccount(verifierPrivateKey);
  const verificationSignature = await account.signMessage({
    message:{raw:buildVerificationAttestationHash({
      paymentId:input.expectedPaymentId as Hex,
      conditionHash:input.expectedConditionHash,
      providerHash:keccak256(stringToHex(providerId)),
      proofIdentifier:proofIdentifier as Hex
    })}
  });

  const replayStore = process.env.DATABASE_URL ? new PostgresReplayStore(process.env.DATABASE_URL) : null;
  if (!replayStore) throw new ReclaimVerificationError("DATABASE","Replay protection database is not configured; no verification attestation will be issued.");

  let replayAccepted: boolean;
  try {
    try {
      replayAccepted = await replayStore.claim({
        sessionId:input.sessionId,
        proofIdentifier,
        paymentId:input.expectedPaymentId,
        conditionHash:input.expectedConditionHash
      });
    } catch {
      throw new ReclaimVerificationError("DATABASE","Replay protection database is unavailable; no verification attestation will be issued.");
    }
  } finally {
    await replayStore.close();
  }
  if (!replayAccepted) throw new ReclaimVerificationError("REPLAY","This Reclaim session or proof has already been accepted.");

  return {
    providerId,
    providerVersion,
    claims,
    proof,
    proofIdentifier,
    verificationSigner:account.address,
    verificationSignature
  };
}
