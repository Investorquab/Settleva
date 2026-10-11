import {
  canonicalizeCondition,
  evaluateClaims,
  type PaymentCondition,
  type VerifiedClaim
} from "@settleva/conditions";

export const PLAYGROUND_SCENARIOS = [
  {
    id: "gaming",
    title: "Gaming rewards",
    category: "GAMING",
    description: "Reward a player only after the achievement service confirms the configured milestone.",
    eventLabel: "Achievement verified",
    policy: { provider: "settleva.demo.game", providerVersion: "1", claims: [
      { field: "game.achievement.status", operator: "equals", value: "verified" },
      { field: "game.player.id", operator: "equals", value: "player_01" }
    ]},
    evidence: [
      { field: "game.achievement.status", value: "verified" },
      { field: "game.player.id", value: "player_01" }
    ]
  },
  {
    id: "freelance",
    title: "Freelance milestones",
    category: "FREELANCE",
    description: "Release a milestone when the accepted deliverable matches the agreed job.",
    eventLabel: "Milestone accepted",
    policy: { provider: "settleva.demo.milestone", providerVersion: "1", claims: [
      { field: "milestone.status", operator: "equals", value: "accepted" },
      { field: "milestone.jobId", operator: "equals", value: "job_204" }
    ]},
    evidence: [
      { field: "milestone.status", value: "accepted" },
      { field: "milestone.jobId", value: "job_204" }
    ]
  },
  {
    id: "commerce",
    title: "Conditional commerce",
    category: "COMMERCE",
    description: "Release a purchase when a trusted delivery event matches the expected order.",
    eventLabel: "Delivery confirmed",
    policy: { provider: "settleva.demo.delivery", providerVersion: "1", claims: [
      { field: "delivery.status", operator: "equals", value: "confirmed" },
      { field: "order.id", operator: "equals", value: "order_581" }
    ]},
    evidence: [
      { field: "delivery.status", value: "confirmed" },
      { field: "order.id", value: "order_581" }
    ]
  },
  {
    id: "agents",
    title: "Agentic economy",
    category: "AI AGENTS",
    description: "Settle an agent task when the configured completion and evaluation claims are present.",
    eventLabel: "Task evaluation passed",
    policy: { provider: "settleva.demo.agent", providerVersion: "1", claims: [
      { field: "task.status", operator: "equals", value: "completed" },
      { field: "evaluation.result", operator: "equals", value: "passed" }
    ]},
    evidence: [
      { field: "task.status", value: "completed" },
      { field: "evaluation.result", value: "passed" }
    ]
  }
] as const;

export type PlaygroundScenarioId = (typeof PLAYGROUND_SCENARIOS)[number]["id"];
export type PlaygroundResult =
  | { ok: true; policy: PaymentCondition; evidence: VerifiedClaim[]; canonical: string; failures: string[] }
  | { ok: false; error: string; line?: number; column?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getPlaygroundScenario(id: PlaygroundScenarioId) {
  const scenario = PLAYGROUND_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error("Unknown playground scenario.");
  return scenario;
}

export function createPolicyText(id: PlaygroundScenarioId, now = Math.floor(Date.now() / 1000)): string {
  const scenario = getPlaygroundScenario(id);
  const policy: PaymentCondition = {
    version: "1.0",
    provider: scenario.policy.provider,
    providerVersion: scenario.policy.providerVersion,
    claims: scenario.policy.claims.map((claim) => ({ ...claim })),
    expiresAt: now + 3600
  };
  return JSON.stringify(policy, null, 2);
}

export function createEvidenceText(id: PlaygroundScenarioId): string {
  return JSON.stringify(getPlaygroundScenario(id).evidence.map((claim) => ({ ...claim })), null, 2);
}

export function parsePlaygroundJson(source: string, label: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    const position = /position\s+(\d+)/i.exec(message);
    const offset = position ? Number(position[1]) : -1;
    const before = offset >= 0 ? source.slice(0, offset) : "";
    const line = offset >= 0 ? before.split("\n").length : undefined;
    const column = offset >= 0 ? before.length - before.lastIndexOf("\n") : undefined;
    throw Object.assign(new Error(label + " is not valid JSON: " + message), { line, column });
  }
}

function validatePolicyShape(value: Record<string, unknown>): string | null {
  if (value.version !== "1.0") return "Policy version must be \"1.0\".";
  if (typeof value.provider !== "string" || !value.provider.trim()) return "Policy provider must be a non-empty string.";
  if (typeof value.providerVersion !== "string" || !value.providerVersion.trim()) return "Policy providerVersion must be a non-empty string.";
  if (!Number.isSafeInteger(value.expiresAt) || (value.expiresAt as number) < 0) return "Policy expiresAt must be a non-negative safe integer.";
  if (!Array.isArray(value.claims)) return "Policy must include a claims array.";
  for (const [index, claim] of value.claims.entries()) {
    if (!isRecord(claim)) return "Policy claim " + index + " must be an object.";
    if (typeof claim.field !== "string" || !claim.field.trim()) return "Policy claim " + index + " needs a non-empty field.";
    if (claim.operator !== "equals") return "Policy claim " + index + " uses an unsupported operator. The current SDK supports equals only.";
    if (typeof claim.value !== "string") return "Policy claim " + index + " value must be a string.";
  }
  return null;
}

export function evaluatePlayground(
  policySource: string,
  evidenceSource: string,
  now = Math.floor(Date.now() / 1000)
): PlaygroundResult {
  let parsedPolicy: unknown;
  let parsedEvidence: unknown;
  try {
    parsedPolicy = parsePlaygroundJson(policySource, "Policy");
  } catch (error) {
    const parsed = error as Error & { line?: number; column?: number };
    return {
      ok: false,
      error: parsed.message,
      ...(parsed.line !== undefined ? { line: parsed.line } : {}),
      ...(parsed.column !== undefined ? { column: parsed.column } : {})
    };
  }
  try {
    parsedEvidence = parsePlaygroundJson(evidenceSource, "Evidence");
  } catch (error) {
    const parsed = error as Error & { line?: number; column?: number };
    return {
      ok: false,
      error: parsed.message,
      ...(parsed.line !== undefined ? { line: parsed.line } : {}),
      ...(parsed.column !== undefined ? { column: parsed.column } : {})
    };
  }

  if (!isRecord(parsedPolicy)) return { ok: false, error: "Policy must be a JSON object." };
  const shapeError = validatePolicyShape(parsedPolicy);
  if (shapeError) return { ok: false, error: shapeError };
  if (!Array.isArray(parsedEvidence)) return { ok: false, error: "Evidence must be a JSON array of verified claims." };

  const policy = parsedPolicy as unknown as PaymentCondition;
  const evidence: VerifiedClaim[] = [];
  for (const [index, entry] of parsedEvidence.entries()) {
    if (!isRecord(entry) || typeof entry.field !== "string" || !entry.field.trim() || typeof entry.value !== "string") {
      return { ok: false, error: "Evidence item " + index + " must contain a non-empty string field and a string value." };
    }
    evidence.push({ field: entry.field, value: entry.value });
  }

  try {
    const canonical = canonicalizeCondition(policy);
    const evaluation = evaluateClaims(policy, evidence, now);
    return { ok: true, policy, evidence, canonical, failures: [...evaluation.failures] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Policy validation failed." };
  }
}

export function simulateNonQualifyingEvidence(source: string): string {
  const parsed = parsePlaygroundJson(source, "Evidence");
  if (!Array.isArray(parsed) || parsed.length === 0 || !isRecord(parsed[0]) || typeof parsed[0].value !== "string") {
    throw new Error("Evidence needs at least one claim with a string value to simulate a non-matching event.");
  }
  const evidence = parsed as Array<Record<string, unknown>>;
  return JSON.stringify(
    evidence.map((claim, index) => index === 0 ? { ...claim, value: "__not_matching__" } : claim),
    null,
    2
  );
}
