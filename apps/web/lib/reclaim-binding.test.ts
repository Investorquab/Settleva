import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReclaimProviderParams,
  extractedParametersToClaims,
  normalizeReclaimExtractedParameters,
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


test("Reclaim request params derive from the five committed GitHub deployment claims", () => {
  const policy = {
    version: "1.0" as const,
    provider: "published-provider",
    providerVersion: "1.0.0",
    claims: [
      {field:"github.repo.full_name",operator:"equals" as const,value:"Investorquab/Settleva"},
      {field:"github.deployment.ref",operator:"equals" as const,value:"main"},
      {field:"github.deployment.sha",operator:"equals" as const,value:"6dd48e33fa2dada31d33dd77c8294c61987e81d9"},
      {field:"github.deployment.environment",operator:"equals" as const,value:"production"},
      {field:"github.deployment.status",operator:"equals" as const,value:"success"}
    ],
    expiresAt: Math.floor(Date.now()/1000)+3600
  };
  assert.deepEqual(buildReclaimProviderParams(policy, {RECLAIM_PROVIDER_ID:"published-provider",RECLAIM_PROVIDER_VERSION:"1.0.0"}), {
    github_repo_full_name:"Investorquab/Settleva",
    github_deployment_ref:"main",
    github_deployment_sha:"6dd48e33fa2dada31d33dd77c8294c61987e81d9",
    github_deployment_environment:"production",
    github_deployment_status:"success"
  });
});

test("unregistered policy families fail closed before a Reclaim request is created", () => {
  const policy = {
    version: "1.0" as const,
    provider: "settleva.demo.milestone",
    providerVersion: "1",
    claims: [{field:"milestone.status",operator:"equals" as const,value:"accepted"}],
    expiresAt: Math.floor(Date.now()/1000)+3600
  };
  assert.throws(() => buildReclaimProviderParams(policy, {}), /No evidence adapter is registered/
});


test("registered Reclaim adapters map gaming, freelance, commerce and agentic conditions without hardcoding one scenario", () => {
  const cases: Array<{
    id: string;
    providerId: string;
    providerVersion: string;
    claims: Array<{field:string;operator:"equals";value:string}>;
    requestParameters: Record<string,string>;
    claimFields: Record<string,string>;
    extracted: Record<string,string>;
  }> = [
    {
      id: "gaming", providerId: "game-provider", providerVersion: "1",
      claims: [
        {field:"game.achievement.status",operator:"equals",value:"verified"},
        {field:"game.player.id",operator:"equals",value:"player_01"}
      ],
      requestParameters: {"game.player.id":"player_id_input"},
      claimFields: {"achievement_status_result":"game.achievement.status","player_id_result":"game.player.id"},
      extracted: {achievement_status_result:"verified",player_id_result:"player_01"}
    },
    {
      id: "freelance", providerId: "milestone-provider", providerVersion: "2",
      claims: [
        {field:"milestone.status",operator:"equals",value:"accepted"},
        {field:"milestone.jobId",operator:"equals",value:"job_204"}
      ],
      requestParameters: {"milestone.jobId":"job_id_input"},
      claimFields: {"milestone_status_result":"milestone.status","job_id_result":"milestone.jobId"},
      extracted: {milestone_status_result:"accepted",job_id_result:"job_204"}
    },
    {
      id: "commerce", providerId: "delivery-provider", providerVersion: "3",
      claims: [
        {field:"delivery.status",operator:"equals",value:"confirmed"},
        {field:"order.id",operator:"equals",value:"order_581"}
      ],
      requestParameters: {"order.id":"order_id_input"},
      claimFields: {"delivery_status_result":"delivery.status","order_id_result":"order.id"},
      extracted: {delivery_status_result:"confirmed",order_id_result:"order_581"}
    },
    {
      id: "agents", providerId: "agent-provider", providerVersion: "4",
      claims: [
        {field:"task.status",operator:"equals",value:"completed"},
        {field:"evaluation.result",operator:"equals",value:"passed"}
      ],
      requestParameters: {},
      claimFields: {"task_status_result":"task.status","evaluation_result":"evaluation.result"},
      extracted: {task_status_result:"completed",evaluation_result:"passed"}
    }
  ];

  const env = {
    SETTLEVA_RECLAIM_ADAPTERS: JSON.stringify(cases.map((item) => ({
      providerId:item.providerId, providerVersion:item.providerVersion, kind:"mapped",
      requestParameters:item.requestParameters, claimFields:item.claimFields
    })))
  };

  for (const scenario of cases) {
    const policy = {
      version:"1.0" as const,
      provider:scenario.providerId,
      providerVersion:scenario.providerVersion,
      claims:scenario.claims,
      expiresAt:Math.floor(Date.now()/1000)+3600
    };
    const params = buildReclaimProviderParams(policy, env);
    for (const parameterName of Object.values(scenario.requestParameters)) {
      assert.ok(Object.hasOwn(params, parameterName), scenario.id + " maps its committed request parameter");
    }
    assert.deepEqual(
      normalizeReclaimExtractedParameters(scenario.extracted, policy, env),
      scenario.claims.map((claim) => ({field:claim.field,value:claim.value}))
    );
  }
});

test("mapped adapters cannot reuse a dynamic request parameter as evidence", () => {
  const policy = {
    version:"1.0" as const, provider:"unsafe-provider", providerVersion:"1",
    claims:[{field:"order.id",operator:"equals" as const,value:"order_581"}],
    expiresAt:Math.floor(Date.now()/1000)+3600
  };
  const env = {
    SETTLEVA_RECLAIM_ADAPTERS: JSON.stringify([{
      providerId:"unsafe-provider", providerVersion:"1", kind:"mapped",
      requestParameters:{"order.id":"order_id"}, claimFields:{"order_id":"order.id"}
    }])
  };
  assert.throws(() => buildReclaimProviderParams(policy, env), /cannot treat a dynamic request parameter as verified evidence/);
});
