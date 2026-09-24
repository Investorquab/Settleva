import { ReclaimProofRequest, verifyProof } from "@reclaimprotocol/js-sdk";
import { evaluateClaims, hashCondition, type PaymentCondition } from "@settleva/conditions";
import { buildVerificationAttestationHash } from "@settleva/sdk";
import { extractGitHubDeploymentClaims, isGitHubDeploymentCondition } from "@settleva/providers";
import { findMatchingVerifiedProofData, PostgresReplayStore } from "@settleva/verification";
import { keccak256, stringToHex, type Hex } from "viem";
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

export interface ReclaimVerificationResult {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly claims: readonly {field:string;value:string}[];
  readonly proof: unknown;
  readonly proofIdentifier: string;
  readonly verificationSigner: string;
  readonly verificationSignature: Hex;
}

function parseProofContext(value: string): {paymentId:string;conditionHash:Hex} | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.paymentId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.paymentId)) return null;
    if (typeof parsed.conditionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.conditionHash)) return null;
    return {paymentId:parsed.paymentId,conditionHash:parsed.conditionHash as Hex};
  } catch {
    return null;
  }
}

export async function verifyReclaimAndAttest(input: ReclaimVerificationInput): Promise<ReclaimVerificationResult> {
  if (input.proofs.length !== 1) throw new Error("Exactly one Reclaim proof is required for this payment condition.");
  if (hashCondition(input.condition) !== input.expectedConditionHash) throw new Error("Payment condition does not match the committed proof context.");

  const appId = process.env.RECLAIM_APP_ID;
  const appSecret = process.env.RECLAIM_APP_SECRET;
  const verifierPrivateKey = process.env.SETTLEVA_VERIFIER_PRIVATE_KEY as Hex | undefined;
  if (!appId || !appSecret || !verifierPrivateKey) throw new Error("Reclaim credentials and Settleva verifier signing key are not configured.");
  if (input.condition.provider !== input.expectedProviderId) throw new Error("Payment condition provider does not match the configured Reclaim provider.");
  if (input.condition.providerVersion !== input.expectedProviderVersion) throw new Error("Payment condition provider version does not match the configured Reclaim provider version.");

  const requestConfig = await ReclaimProofRequest.init(appId,appSecret,input.expectedProviderId,{log:false});
  const {providerId,providerVersion} = requestConfig.getProviderVersion();
  if (providerId !== input.expectedProviderId || providerVersion !== input.expectedProviderVersion) throw new Error("Configured Reclaim provider version does not match the provider version resolved for this request.");

  const result = await verifyProof(input.proofs as Parameters<typeof verifyProof>[0],{providerId,providerVersion});
  if (!result.isVerified) throw new Error(result.error?.message || "Reclaim rejected the proof.");

  const proof = input.proofs[0] as Record<string, unknown>;
  const claimData = proof.claimData as Record<string, unknown> | undefined;
  const proofIdentifier = claimData?.identifier;
  if (typeof proofIdentifier !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(proofIdentifier)) throw new Error("Verified Reclaim proof has no valid claim identifier.");

  const data = Array.isArray(result.data) ? result.data : [];
  const matchingProof = findMatchingVerifiedProofData(data,{
    sessionId:input.sessionId,
    paymentId:input.expectedPaymentId,
    conditionHash:input.expectedConditionHash
  });
  if (!matchingProof) throw new Error("Proof is not bound to the initiated Reclaim session, payment, condition, and verified extracted parameters.");

  const contextValue = matchingProof.context?.contextMessage;
  if (typeof contextValue !== "string") throw new Error("Verified proof context message is missing.");
  const parsedContext = parseProofContext(contextValue);
  if (!parsedContext || parsedContext.paymentId !== input.expectedPaymentId || parsedContext.conditionHash !== input.expectedConditionHash) throw new Error("Verified proof context does not match the committed payment binding.");

  const claims = Object.entries(matchingProof.extractedParameters!).map(([field,value]) => ({field,value:String(value)}));

  // The first production provider is intentionally schema-pinned: when the
  // committed condition is the GitHub deployment condition, require the
  // complete five-field deployment evidence shape before evaluation.
  if (isGitHubDeploymentCondition(input.condition) && !extractGitHubDeploymentClaims(claims)) {
    throw new Error("GitHub deployment evidence is incomplete or malformed.");
  }

  const evaluation = evaluateClaims(input.condition,claims);
  if (!evaluation.valid) throw new Error(`Condition failed: ${evaluation.failures.join(", ")}`);

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
  if (!replayStore) throw new Error("Replay protection database is not configured; no verification attestation will be issued.");

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
      throw new Error("Replay protection database is unavailable; no verification attestation will be issued.");
    }
  } finally {
    await replayStore.close();
  }
  if (!replayAccepted) throw new Error("This Reclaim session or proof has already been accepted.");

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
