import { evaluateClaims, type PaymentCondition, type VerifiedClaim } from "@settleva/conditions";
import type { Evidence, ProofProvider, VerificationResult } from "@settleva/verification";

export class HttpProofProvider implements ProofProvider {
  readonly id = "http";

  async verifyProof(
    evidence: Evidence,
    expectedConditionHash: `0x${string}`,
    condition?: PaymentCondition
  ): Promise<VerificationResult> {
    if (evidence.provider !== this.id) return {valid:false,reason:"PROVIDER_MISMATCH",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};
    if (evidence.conditionHash !== expectedConditionHash) return {valid:false,reason:"CONDITION_HASH_MISMATCH",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};
    if (!condition) return {valid:false,reason:"CONDITION_REQUIRED",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};

    const claims: VerifiedClaim[] = evidence.claims.map((claim) => ({
      field: String(claim.field ?? ""),
      value: String(claim.value ?? "")
    }));
    const evaluation = evaluateClaims(condition, claims);
    if (!evaluation.valid) return {valid:false,reason:evaluation.failures.join(","),claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};

    return {valid:false,reason:"PROOF_VERIFIER_NOT_CONFIGURED",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};
  }
}
