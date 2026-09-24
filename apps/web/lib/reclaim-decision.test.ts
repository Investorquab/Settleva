import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertConditionCommitment,
  assertConditionEvaluation,
  assertGitHubDeploymentEvidence,
  assertProofIdentifier,
  assertProviderPin,
  assertResolvedProviderPin,
  assertSingleProof,
  assertVerifiedContextBinding,
  assertVerifiedProofDataBinding,
  resolveCallbackFailure,
  resolveVerificationCommit,
  shouldMarkCallbackFailed
} from "./reclaim-decision.ts";

const paymentId = "0x1111111111111111111111111111111111111111111111111111111111111111";
const conditionHash = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;
const condition = {
  version: "1.0" as const,
  provider: "provider-1",
  providerVersion: "1",
  claims: [{field:"github.deployment.status",operator:"equals" as const,value:"success"}],
  expiresAt: Math.floor(Date.now()/1000)+3600
};

test("assertSingleProof requires exactly one proof", () => {
  const proof = {claimData:{}};
  assert.equal(assertSingleProof([proof]), proof);
  assert.throws(() => assertSingleProof([]), /Exactly one/);
  assert.throws(() => assertSingleProof([proof, proof]), /Exactly one/);
});

test("assertConditionCommitment rejects a mismatched committed hash", () => {
  assert.doesNotThrow(() => assertConditionCommitment(condition, conditionHash, conditionHash));
  assert.throws(
    () => assertConditionCommitment(condition, conditionHash, "0x3333333333333333333333333333333333333333333333333333333333333333"),
    /does not match/
  );
});

test("provider identity and version are pinned", () => {
  assert.doesNotThrow(() => assertProviderPin(condition, "provider-1", "1"));
  assert.throws(() => assertProviderPin(condition, "provider-2", "1"), /provider/);
  assert.throws(() => assertProviderPin(condition, "provider-1", "2"), /version/);
  assert.doesNotThrow(() => assertResolvedProviderPin("provider-1", "1", "provider-1", "1"));
  assert.throws(() => assertResolvedProviderPin("provider-2", "1", "provider-1", "1"), /version/);
});

test("proof identifier validation fails closed", () => {
  assert.equal(assertProofIdentifier("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.throws(() => assertProofIdentifier("0x01"), /identifier/);
  assert.throws(() => assertProofIdentifier(undefined), /identifier/);
});

test("verified context message must equal the committed condition hash", () => {
  assert.doesNotThrow(() => assertVerifiedContextBinding(conditionHash, conditionHash));
  assert.throws(
    () => assertVerifiedContextBinding("0x3333333333333333333333333333333333333333333333333333333333333333", conditionHash),
    /condition binding/
  );
  assert.throws(() => assertVerifiedContextBinding(undefined, conditionHash), /context message/);
});

});

test("verified proof data must be present on the same entry", () => {
  assert.doesNotThrow(() => assertVerifiedProofDataBinding(true));
  assert.throws(() => assertVerifiedProofDataBinding(false), /not bound/);
});

test("GitHub deployment evidence is fail-closed when incomplete", () => {
  assert.doesNotThrow(() => assertGitHubDeploymentEvidence(false, false));
  assert.doesNotThrow(() => assertGitHubDeploymentEvidence(true, true));
  assert.throws(() => assertGitHubDeploymentEvidence(true, false), /incomplete/);
});

test("condition evaluation failures are surfaced without allowing settlement", () => {
  assert.doesNotThrow(() => assertConditionEvaluation(true, []));
  assert.throws(() => assertConditionEvaluation(false, ["VALUE_MISMATCH: github.deployment.status"]), /Condition failed: VALUE_MISMATCH/);
});

test("callback commit race is idempotent only when the session is already verified", () => {
  assert.equal(resolveVerificationCommit(true, "verified"), "committed");
  assert.equal(resolveVerificationCommit(false, "verified"), "already-committed");
  assert.equal(resolveVerificationCommit(false, "pending"), "conflict");
  assert.equal(resolveVerificationCommit(false, "failed"), "conflict");
  assert.equal(resolveVerificationCommit(false, null), "conflict");
});

test("retryable verification failures never mark a pending callback failed", () => {
  assert.equal(shouldMarkCallbackFailed(true, "pending"), false);
  assert.equal(shouldMarkCallbackFailed(true, "verified"), false);
  assert.equal(shouldMarkCallbackFailed(false, "pending"), true);
  assert.equal(shouldMarkCallbackFailed(false, "verified"), false);
  assert.equal(shouldMarkCallbackFailed(false, "failed"), false);
});

test("callback failure resolution never overwrites a verified session", () => {
  assert.equal(resolveCallbackFailure(false, "verified"), "already-verified");
  assert.equal(resolveCallbackFailure(true, "verified"), "already-verified");
  assert.equal(resolveCallbackFailure(true, "pending"), "retry");
  assert.equal(resolveCallbackFailure(false, "pending"), "mark-failed");
  assert.equal(resolveCallbackFailure(false, "failed"), "retry");
  assert.equal(resolveCallbackFailure(false, null), "retry");
});
