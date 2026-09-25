import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractedParametersToClaims,
  parseProofContext,
  parseProofIdentifier
} from "./reclaim-binding.ts";

test("parseProofContext accepts the exact payment and condition binding", () => {
  const context = JSON.stringify({
    paymentId: "0x1111111111111111111111111111111111111111111111111111111111111111",
    conditionHash: "0x2222222222222222222222222222222222222222222222222222222222222222"
  });

  assert.deepEqual(parseProofContext(context), {
    paymentId: "0x1111111111111111111111111111111111111111111111111111111111111111",
    conditionHash: "0x2222222222222222222222222222222222222222222222222222222222222222"
  });
});

test("parseProofContext rejects malformed, missing, or extra-type bindings", () => {
  assert.equal(parseProofContext("not-json"), null);
  assert.equal(parseProofContext(JSON.stringify({
    paymentId: "0x1111",
    conditionHash: "0x2222222222222222222222222222222222222222222222222222222222222222"
  })), null);
  assert.equal(parseProofContext(JSON.stringify({
    paymentId: "0x1111111111111111111111111111111111111111111111111111111111111111"
  })), null);
  assert.equal(parseProofContext(JSON.stringify({
    paymentId: "0x1111111111111111111111111111111111111111111111111111111111111111",
    conditionHash: 123
  })), null);
});

test("parseProofIdentifier accepts only a 32-byte hex identifier", () => {
  assert.equal(
    parseProofIdentifier("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  );
  assert.equal(parseProofIdentifier("0x01"), null);
  assert.equal(parseProofIdentifier("not-hex"), null);
  assert.equal(parseProofIdentifier(undefined), null);
});

test("published Reclaim GitHub parameters map to canonical dotted claims", () => {
  assert.deepEqual(
    extractedParametersToClaims({
      github_repo_full_name: "Investorquab/Settleva",
      github_deployment_ref: "main",
      github_deployment_sha: "6dd48e33fa2dada31d33dd77c8294c61987e81d9",
      github_deployment_environment: "production",
      github_deployment_status: "success"
    }),
    [
      {field: "github.repo.full_name", value: "Investorquab/Settleva"},
      {field: "github.deployment.ref", value: "main"},
      {field: "github.deployment.sha", value: "6dd48e33fa2dada31d33dd77c8294c61987e81d9"},
      {field: "github.deployment.environment", value: "production"},
      {field: "github.deployment.status", value: "success"}
    ]
  );
});

test("published Reclaim mapping preserves incomplete and unknown fields", () => {
  assert.deepEqual(
    extractedParametersToClaims({
      github_repo_full_name: "Investorquab/Settleva",
      github_deployment_status: "success",
      unrelated: "value"
    }),
    [
      {field: "github.repo.full_name", value: "Investorquab/Settleva"},
      {field: "github.deployment.status", value: "success"},
      {field: "unrelated", value: "value"}
    ]
  );

  const incomplete = extractedParametersToClaims({
    github_repo_full_name: "Investorquab/Settleva",
    github_deployment_status: "success"
  });
  assert.equal(
    incomplete.some(({field}) => field === "github.deployment.ref"),
    false
  );
  assert.equal(
    incomplete.some(({field}) => field === "github.deployment.sha"),
    false
  );
  assert.equal(
    incomplete.some(({field}) => field === "github.deployment.environment"),
    false
  );
});

test("published Reclaim aliases preserve duplicate claims for downstream rejection", () => {
  assert.deepEqual(
    extractedParametersToClaims({
      "github.repo.full_name": "Investorquab/Settleva",
      github_repo_full_name: "Investorquab/Settleva"
    }),
    [
      {field: "github.repo.full_name", value: "Investorquab/Settleva"},
      {field: "github.repo.full_name", value: "Investorquab/Settleva"}
    ]
  );
});

test("existing canonical dotted fields remain unchanged", () => {
  assert.deepEqual(
    extractedParametersToClaims({
      "github.repo.full_name": "Investorquab/Settleva",
      "github.deployment.status": "success",
      attempt: 2
    }),
    [
      {field: "github.repo.full_name", value: "Investorquab/Settleva"},
      {field: "github.deployment.status", value: "success"},
      {field: "attempt", value: "2"}
    ]
  );
});
