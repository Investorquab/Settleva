import type { Evidence, ProofProvider, VerificationResult } from "@settleva/verification";
export class GitHubProofProvider implements ProofProvider {
  readonly id = "github";
  async verifyProof(evidence: Evidence, expectedConditionHash: `0x${string}`): Promise<VerificationResult> {
    if (evidence.provider !== this.id) return {valid:false,reason:"PROVIDER_MISMATCH",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};
    if (evidence.conditionHash !== expectedConditionHash) return {valid:false,reason:"CONDITION_HASH_MISMATCH",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};
    return {valid:false,reason:"PROOF_VERIFIER_NOT_CONFIGURED",claims:evidence.claims,proofId:evidence.proofId,conditionHash:evidence.conditionHash};
  }
}
