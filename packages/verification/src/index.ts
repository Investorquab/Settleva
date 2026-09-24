export interface Evidence {
  readonly provider:string;
  readonly proofId:string;
  readonly conditionHash:`0x${string}`;
  readonly claims:readonly Record<string,string>[];
  readonly proofPayload:string;
}

export interface VerificationResult {
  readonly valid:boolean;
  readonly reason?:string;
  readonly claims:readonly Record<string,string>[];
  readonly proofId:string;
  readonly conditionHash:`0x${string}`;
}

export interface ProofProvider {
  readonly id:string;
  verifyProof(
    evidence:Evidence,
    expectedConditionHash:`0x${string}`
  ):Promise<VerificationResult>;
}

export * from "./replay-store.js";
export * from "./verified-data.js";

export * from "./postgres-replay-store.js";
