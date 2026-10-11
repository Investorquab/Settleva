import type { Hex } from "viem";
import type { PaymentCondition } from "@settleva/conditions";
import { parseProofIdentifier } from "./reclaim-binding.ts";

export type VerificationCommitStatus = "committed" | "already-committed" | "conflict";

export const MAX_RECLAIM_PROOF_AGE_SECONDS = 15 * 60;
export const ALLOWED_RECLAIM_CLOCK_SKEW_SECONDS = 60;

/** Reject stale or future-dated proofs even if their signatures otherwise verify. */
export function assertProofFreshness(
  timestampValue: unknown,
  now = Math.floor(Date.now() / 1000),
  maxAgeSeconds = MAX_RECLAIM_PROOF_AGE_SECONDS,
  allowedFutureSkewSeconds = ALLOWED_RECLAIM_CLOCK_SKEW_SECONDS
): void {
  const timestamp = typeof timestampValue === "number"
    ? timestampValue
    : typeof timestampValue === "string" && /^\d+$/.test(timestampValue)
      ? Number(timestampValue)
      : Number.NaN;
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error("Reclaim proof timestampS must be a positive Unix timestamp in seconds.");
  }
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new Error("Proof freshness clock configuration is invalid.");
  }
  if (timestamp > now + allowedFutureSkewSeconds) {
    throw new Error("Reclaim proof timestamp is too far in the future.");
  }
  if (now - timestamp > maxAgeSeconds) {
    throw new Error("Reclaim proof is stale; generate a fresh proof.");
  }
}

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
