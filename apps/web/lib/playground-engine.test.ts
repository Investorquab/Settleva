import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEvidenceText,
  createPolicyText,
  evaluatePlayground,
  simulateNonQualifyingEvidence
} from "./playground-engine.ts";

test("a matching policy and evidence pass the actual condition evaluator", () => {
  const now = Math.floor(Date.now() / 1000);
  const result = evaluatePlayground(createPolicyText("freelance", now), createEvidenceText("freelance"), now);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.failures, []);
});

test("non-qualifying evidence returns failures instead of authorizing settlement", () => {
  const now = Math.floor(Date.now() / 1000);
  const evidence = simulateNonQualifyingEvidence(createEvidenceText("gaming"));
  const result = evaluatePlayground(createPolicyText("gaming", now), evidence, now);
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.failures.some((failure) => failure.startsWith("VALUE_MISMATCH:")));
});

test("invalid JSON returns a useful line and column when available", () => {
  const result = evaluatePlayground('{"claims": [}', "[]");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Policy is not valid JSON/);
});

test("unsupported operators fail validation", () => {
  const now = Math.floor(Date.now() / 1000);
  const policy = JSON.parse(createPolicyText("commerce", now)) as Record<string, unknown>;
  policy.claims = [{ field: "delivery.status", operator: "gte", value: "1" }];
  const result = evaluatePlayground(JSON.stringify(policy), createEvidenceText("commerce"), now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Condition claim is invalid/);
});

test("expired conditions are reported by the condition evaluator", () => {
  const policy = JSON.parse(createPolicyText("agents", 10)) as Record<string, unknown>;
  policy.expiresAt = 10;
  const result = evaluatePlayground(JSON.stringify(policy), createEvidenceText("agents"), 20);
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.failures.includes("CONDITION_EXPIRED"));
});

test("malformed condition claim values produce a configuration error", () => {
  const now = Math.floor(Date.now() / 1000);
  const policy = JSON.parse(createPolicyText("gaming", now)) as Record<string, unknown>;
  policy.claims = [{ field: "game.achievement.status", operator: "equals" }];
  const result = evaluatePlayground(JSON.stringify(policy), createEvidenceText("gaming"), now);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /value must be a string/);
});
