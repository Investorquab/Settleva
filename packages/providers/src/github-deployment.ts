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
  readonly repository: string;
  readonly ref: string;
  readonly sha: string;
  readonly environment: string;
  readonly status: string;
  readonly expiresAt: number;
}

export function buildGitHubDeploymentCondition(
  input: GitHubDeploymentConditionInput
): PaymentCondition {
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
    claims,
    expiresAt: input.expiresAt
  };
}
