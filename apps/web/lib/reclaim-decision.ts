import type { Hex } from "viem";
import type { PaymentCondition } from "@settleva/conditions";
import { parseProofIdentifier } from "./reclaim-binding.ts";

export type VerificationCommitStatus = "committed" | "already-committed" | "conflict";

export function assertSingleProof(proofs: readonly unknown[]): unknown {
  if (proofs.length !== 1) throw new Error("Exactly one Reclaim proof is required for this payment condition.");
  return proofs[0];
}

export function assertConditionCommitment(
  _condition: PaymentCondition,
  expectedConditionHash: Hex,
  actualConditionHash: Hex
): void {
  if (actualConditionHash !== expectedConditionHash) throw new Error("Payment condition does not match the committed proof context.");
}

export function assertProviderPin(condition: PaymentCondition, expectedProviderId: string, expectedProviderVersion: string): void {
  if (condition.provider !== expectedProviderId) throw new Error("Payment condition provider does not match the configured Reclaim provider.");
  if (condition.providerVersion !== expectedProviderVersion) throw new Error("Payment condition provider version does not match the configured Reclaim provider version.");
}

export function assertResolvedProviderPin(providerId: string, providerVersion: string, expectedProviderId: string, expectedProviderVersion: string): void {
  if (providerId !== expectedProviderId || providerVersion !== expectedProviderVersion) {
    throw new Error("Configured Reclaim provider version does not match the provider version resolved for this request.");
  }
}

export function assertProofIdentifier(value: unknown): string {
  const identifier = parseProofIdentifier(value);
  if (!identifier) throw new Error("Verified Reclaim proof has no valid claim identifier.");
  return identifier;
}

export function assertVerifiedContextBinding(value: unknown, expectedConditionHash: Hex): void {
  if (typeof value !== "string") throw new Error("Verified proof context message is missing.");
  if (value !== expectedConditionHash) {
    throw new Error("Verified proof context message does not match the committed condition binding.");
  }
}

export function assertVerifiedProofDataBinding(found: boolean): void {
  if (!found) throw new Error("Proof is not bound to the initiated Reclaim session, payment, condition, and verified extracted parameters.");
}

export function assertGitHubDeploymentEvidence(isGitHubDeployment: boolean, hasCompleteEvidence: boolean): void {
  if (isGitHubDeployment && !hasCompleteEvidence) throw new Error("GitHub deployment evidence is incomplete or malformed.");
}

export function assertConditionEvaluation(valid: boolean, failures: readonly string[]): void {
  if (!valid) throw new Error(`Condition failed: ${failures.join(", ")}`);
}

export function resolveVerificationCommit(
  transitioned: boolean,
  currentStatus: "pending" | "verified" | "failed" | null
): VerificationCommitStatus {
  if (transitioned) return "committed";
  if (currentStatus === "verified") return "already-committed";
  return "conflict";
}

export type CallbackFailureStatus = "mark-failed" | "already-verified" | "retry";

export function resolveCallbackFailure(
  retryable: boolean,
  currentStatus: "pending" | "verified" | "failed" | null
): CallbackFailureStatus {
  if (currentStatus === "verified") return "already-verified";
  if (retryable || currentStatus !== "pending") return "retry";
  return "mark-failed";
}

export function shouldMarkCallbackFailed(
  retryable: boolean,
  currentStatus: "pending" | "verified" | "failed" | null
): boolean {
  return resolveCallbackFailure(retryable, currentStatus) === "mark-failed";
}
