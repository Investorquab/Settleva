import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { evaluateClaims, hashCondition } from "@settleva/conditions";
import { SignedEvidenceError, verifySignedEvidenceRequest } from "./signed-evidence.ts";

const NOW = 1_800_000_000;
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const policy = {
  version: "1.0" as const,
  provider: "settleva.gaming.match-result",
  providerVersion: "1",
  claims: [
    { field: "game.match.id", operator: "equals" as const, value: "match_123" },
    { field: "game.result.status", operator: "equals" as const, value: "won" }
  ],
  expiresAt: NOW + 3600
};

function environment(publicKeyValue = publicKeyPem) {
  return {
    SETTLEVA_SIGNED_EVIDENCE_ADAPTERS: JSON.stringify([{
      providerId: policy.provider,
      providerVersion: policy.providerVersion,
      publicKeyPem: publicKeyValue
    }])
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: 1,
    providerId: policy.provider,
    providerVersion: policy.providerVersion,
    eventId: "event-123",
    paymentId: "0x" + "1".repeat(64),
    conditionHash: hashCondition(policy),
    condition: policy,
    claims: [
      { field: "game.match.id", value: "match_123" },
      { field: "game.result.status", value: "won" }
    ],
    ...overrides
  };
}

function signedRequest(value = body(), timestamp = String(NOW), env = environment()) {
  const rawBody = Buffer.from(JSON.stringify(value), "utf8");
  const prefix = Buffer.from("SETTLEVA-SIGNED-EVIDENCE-V1\n" + timestamp + "\n", "utf8");
  const signature = sign(null, Buffer.concat([prefix, rawBody]), privateKey).toString("base64url");
  return { rawBody, timestamp, signature, env, now: NOW };
}

test("accepts a fresh, exact Ed25519-signed provider event and hashes its raw body", () => {
  const request = signedRequest();
  const evidence = verifySignedEvidenceRequest(request);
  assert.equal(evidence.providerId, policy.provider);
  assert.equal(evidence.providerVersion, policy.providerVersion);
  assert.equal(evidence.eventId, "event-123");
  assert.match(evidence.proofIdentifier, /^0x[0-9a-f]{64}$/);
  assert.equal(evaluateClaims(evidence.condition, evidence.claims, NOW).valid, true);
});

test("rejects a body changed after the provider signed it", () => {
  const request = signedRequest();
  const changed = Buffer.concat([request.rawBody, Buffer.from(" ", "utf8")]);
  assert.throws(
    () => verifySignedEvidenceRequest({ ...request, rawBody: changed }),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "INVALID_SIGNATURE"
  );
});

test("rejects a stale provider request", () => {
  const request = signedRequest(body(), String(NOW - 301));
  assert.throws(
    () => verifySignedEvidenceRequest(request),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "STALE_REQUEST"
  );
});

test("rejects a signature that does not verify", () => {
  const request = signedRequest();
  assert.throws(
    () => verifySignedEvidenceRequest({ ...request, signature: "A".repeat(86) }),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "INVALID_SIGNATURE"
  );
});

test("rejects providers that are not registered by exact ID and version", () => {
  const request = signedRequest(body({ providerVersion: "2" }));
  assert.throws(
    () => verifySignedEvidenceRequest(request),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "PROVIDER_NOT_REGISTERED"
  );
});

test("rejects condition hash tampering", () => {
  const request = signedRequest(body({ conditionHash: "0x" + "a".repeat(64) }));
  assert.throws(
    () => verifySignedEvidenceRequest(request),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "INVALID_REQUEST"
  );
});

test("rejects a policy from an unregistered provider even if its own condition is valid", () => {
  const otherPolicy = { ...policy, provider: "settleva.other.source" };
  const request = signedRequest(body({
    providerId: otherPolicy.provider,
    condition: otherPolicy,
    conditionHash: hashCondition(otherPolicy)
  }));
  assert.throws(
    () => verifySignedEvidenceRequest(request),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "PROVIDER_NOT_REGISTERED"
  );
});

test("rejects missing, duplicate, or non-policy claim fields", () => {
  const missing = signedRequest(body({ claims: [{ field: "game.result.status", value: "won" }] }));
  assert.throws(() => verifySignedEvidenceRequest(missing), /exactly the condition's claim fields/);

  const duplicate = signedRequest(body({ claims: [
    { field: "game.match.id", value: "match_123" },
    { field: "game.match.id", value: "match_123" }
  ] }));
  assert.throws(() => verifySignedEvidenceRequest(duplicate), /exactly with no duplicates/);

  const extra = signedRequest(body({ claims: [
    { field: "game.match.id", value: "match_123" },
    { field: "game.result.status", value: "won" },
    { field: "profile.email", value: "private@example.com" }
  ] }));
  assert.throws(() => verifySignedEvidenceRequest(extra), /exactly the condition's claim fields/);
});

test("a valid source signature cannot make an unsuccessful event satisfy the committed policy", () => {
  const request = signedRequest(body({ claims: [
    { field: "game.match.id", value: "match_123" },
    { field: "game.result.status", value: "lost" }
  ] }));
  const evidence = verifySignedEvidenceRequest(request);
  assert.equal(evaluateClaims(evidence.condition, evidence.claims, NOW).valid, false);
});

test("rejects invalid or duplicate provider-key configuration", () => {
  assert.throws(
    () => verifySignedEvidenceRequest({ ...signedRequest(), env: {} }),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "CONFIGURATION"
  );
  const duplicates = JSON.stringify([
    { providerId: policy.provider, providerVersion: policy.providerVersion, publicKeyPem },
    { providerId: policy.provider, providerVersion: policy.providerVersion, publicKeyPem }
  ]);
  assert.throws(
    () => verifySignedEvidenceRequest({ ...signedRequest(), env: { SETTLEVA_SIGNED_EVIDENCE_ADAPTERS: duplicates } }),
    (error: unknown) => error instanceof SignedEvidenceError && error.code === "CONFIGURATION"
  );
});
