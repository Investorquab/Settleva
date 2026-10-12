import type { Hex } from "viem";
import type { PaymentCondition } from "@settleva/conditions";
import { extractGitHubDeploymentClaims, isGitHubDeploymentCondition } from "@settleva/providers";
import { resolveReclaimEvidenceAdapter } from "./reclaim-adapter-registry.ts";

export interface ParsedProofContext {
  readonly paymentId: string;
  readonly conditionHash: Hex;
}

export interface VerifiedClaim {
  readonly field: string;
  readonly value: string;
}

const RECLAIM_GITHUB_FIELD_MAP: Readonly<Record<string, string>> = {
  github_repo_full_name: "github.repo.full_name",
  github_deployment_ref: "github.deployment.ref",
  github_deployment_sha: "github.deployment.sha",
  github_deployment_environment: "github.deployment.environment",
  github_deployment_status: "github.deployment.status"
};

export function parseProofContext(value: string): ParsedProofContext | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.paymentId !== "string"
      || !/^0x[0-9a-fA-F]{64}$/.test(parsed.paymentId)
    ) return null;
    if (
      typeof parsed.conditionHash !== "string"
      || !/^0x[0-9a-fA-F]{64}$/.test(parsed.conditionHash)
    ) return null;

    return {
      paymentId: parsed.paymentId,
      conditionHash: parsed.conditionHash as Hex
    };
  } catch {
    return null;
  }
}

export function parseProofIdentifier(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? value
    : null;
}

export function extractedParametersToClaims(
  extractedParameters: Record<string, unknown>
): VerifiedClaim[] {
  return Object.entries(extractedParameters).map(([field, value]) => ({
    field: RECLAIM_GITHUB_FIELD_MAP[field] ?? field,
    value: String(value)
  }));
}


/**
 * Build exact dynamic parameters from the policy locked on-chain.
 * Values are copied from committed claims; callers cannot supply an unbound URL.
 */
export function buildReclaimProviderParams(condition: PaymentCondition, env: Record<string,string|undefined> = process.env): Record<string,string> {
  return resolveReclaimEvidenceAdapter(condition,env).buildProviderParams(condition);
}
export function normalizeReclaimExtractedParameters(extractedParameters: Record<string,unknown>, condition: PaymentCondition, env: Record<string,string|undefined> = process.env): VerifiedClaim[] {
  return resolveReclaimEvidenceAdapter(condition,env).normalizeClaims(extractedParameters,condition);
}
