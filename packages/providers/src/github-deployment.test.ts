import { strict as assert } from "node:assert";
import test from "node:test";
import {
  GITHUB_DEPLOYMENT_CLAIM_FIELDS,
  buildGitHubDeploymentCondition
} from "./github-deployment.js";

test("GitHub deployment condition commits all five deployment claims", () => {
  const condition = buildGitHubDeploymentCondition({
    provider: "reclaim-provider-id",
    repository: "Investorquab/Settleva",
    ref: "main",
    sha: "0123456789abcdef0123456789abcdef01234567",
    environment: "production",
    status: "success",
    expiresAt: 1_800_000_000
  });

  assert.deepEqual(condition.claims, [
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.repository, operator: "equals", value: "Investorquab/Settleva"},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.ref, operator: "equals", value: "main"},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.sha, operator: "equals", value: "0123456789abcdef0123456789abcdef01234567"},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.environment, operator: "equals", value: "production"},
    {field: GITHUB_DEPLOYMENT_CLAIM_FIELDS.status, operator: "equals", value: "success"}
  ]);
});

test("GitHub deployment condition cannot silently omit a committed field", () => {
  const condition = buildGitHubDeploymentCondition({
    provider: "reclaim-provider-id",
    repository: "Investorquab/Settleva",
    ref: "main",
    sha: "0123456789abcdef0123456789abcdef01234567",
    environment: "production",
    status: "failure",
    expiresAt: 1_800_000_000
  });

  assert.equal(condition.claims.length, 5);
  assert.equal(
    condition.claims.some(
      (claim) =>
        claim.field === GITHUB_DEPLOYMENT_CLAIM_FIELDS.status
        && claim.value === "failure"
    ),
    true
  );
});
