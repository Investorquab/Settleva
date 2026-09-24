import type { ConditionClaim, PaymentCondition } from "@settleva/conditions";

export const GITHUB_DEPLOYMENT_CLAIM_FIELDS = {
  repository: "github.repo.full_name",
  ref: "github.deployment.ref",
  sha: "github.deployment.sha",
  environment: "github.deployment.environment",
  status: "github.deployment.status"
} as const;

export interface GitHubDeploymentConditionInput {
  readonly provider: string;
  readonly providerVersion: string;
  readonly repository: string;
  readonly ref: string;
  readonly sha: string;
  readonly environment: string;
  readonly status: string;
  readonly expiresAt: number;
}

function assertDeploymentInput(input: GitHubDeploymentConditionInput): void {
  if (!input.provider.trim()) throw new Error("Reclaim provider ID is required.");
  if (!input.providerVersion.trim()) throw new Error("Reclaim provider version is required.");
  if (!/^[^/]+\/[^/]+$/.test(input.repository)) throw new Error("GitHub repository must use owner/name format.");
  if (!input.ref.trim()) throw new Error("GitHub deployment ref is required.");
  if (!/^[0-9a-fA-F]{40}$/.test(input.sha)) throw new Error("GitHub deployment SHA must be a 40-character hexadecimal commit SHA.");
  if (!input.environment.trim()) throw new Error("GitHub deployment environment is required.");
  if (!input.status.trim()) throw new Error("GitHub deployment status is required.");
  if (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("GitHub deployment condition expiry must be a future Unix timestamp.");
  }
}

export interface GitHubDeploymentVerifiedClaims {
  readonly repository: string;
  readonly ref: string;
  readonly sha: string;
  readonly environment: string;
  readonly status: string;
}

export function extractGitHubDeploymentClaims(
  claims: readonly {field: string; value: string}[]
): GitHubDeploymentVerifiedClaims | null {
  const values = new Map(claims.map((claim) => [claim.field, claim.value]));
  const repository = values.get(GITHUB_DEPLOYMENT_CLAIM_FIELDS.repository);
  const ref = values.get(GITHUB_DEPLOYMENT_CLAIM_FIELDS.ref);
  const sha = values.get(GITHUB_DEPLOYMENT_CLAIM_FIELDS.sha);
  const environment = values.get(GITHUB_DEPLOYMENT_CLAIM_FIELDS.environment);
  const status = values.get(GITHUB_DEPLOYMENT_CLAIM_FIELDS.status);
  if (!repository || !ref || !sha || !environment || !status) return null;
  if (!/^[^/]+\\/[^/]+$/.test(repository) || !/^[0-9a-fA-F]{40}$/.test(sha)) return null;
  return {repository, ref, sha, environment, status};
}

export function buildGitHubDeploymentCondition(
  input: GitHubDeploymentConditionInput
): PaymentCondition {
  assertDeploymentInput(input);
  const claims: ConditionClaim[] = [
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.repository, operator: "equals", value: input.repository},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.ref, operator: "equals", value: input.ref},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.sha, operator: "equals", value: input.sha},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.environment, operator: "equals", value: input.environment},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.status, operator: "equals", value: input.status}
  ];

  return {
    version: "1.0",
    provider: input.provider,
    providerVersion: input.providerVersion,
    claims,
    expiresAt: input.expiresAt
  };
}
