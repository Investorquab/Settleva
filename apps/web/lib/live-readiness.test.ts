import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateLiveReadinessEnvironment } from "./live-readiness.ts";

const validEnv = {
  ARC_RPC_URL: "https://rpc.mainnet.arc.io",
  SETTLEVA_CHAIN_ID: "5042",
  NEXT_PUBLIC_ARC_CHAIN_ID: "5042",
  SETTLEVA_CONTRACT_ADDRESS: "0x1111111111111111111111111111111111111111",
  NEXT_PUBLIC_SETTLEVA_ADDRESS: "0x1111111111111111111111111111111111111111",
  SETTLEVA_VERIFIER_PRIVATE_KEY: "0x" + "1".repeat(64),
  RECLAIM_APP_ID: "reclaim-app-id-live",
  RECLAIM_APP_SECRET: "reclaim-app-secret-live",
  RECLAIM_PROVIDER_ID: "published-provider-id",
  RECLAIM_PROVIDER_VERSION: "1.0.0",
  NEXT_PUBLIC_RECLAIM_PROVIDER_ID: "published-provider-id",
  NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION: "1.0.0",
  RECLAIM_CALLBACK_URL: "https://settleva.example/api/reclaim/callback",
  DATABASE_URL: "postgres://settleva:secret@db.example:5432/settleva"
};

const envExampleText = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const envExample = new Map(
  envExampleText
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      assert.notEqual(separator, -1, `Invalid environment template line: ${line}`);
      return [line.slice(0, separator), line.slice(separator + 1)] as const;
    })
);

test("valid mainnet configuration normalizes the deployed contract and provider pins", () => {
  const config = validateLiveReadinessEnvironment(validEnv);
  assert.equal(config.settlevaContractAddress, validEnv.SETTLEVA_CONTRACT_ADDRESS);
  assert.equal(config.reclaimProviderId, validEnv.RECLAIM_PROVIDER_ID);
  assert.equal(config.reclaimProviderVersion, validEnv.RECLAIM_PROVIDER_VERSION);
  assert.equal(config.arcRpcUrl, validEnv.ARC_RPC_URL);
});

test("readiness rejects placeholder provider credentials", () => {
  assert.throws(
    () => validateLiveReadinessEnvironment({...validEnv, RECLAIM_PROVIDER_ID:"your_published_provider_id"}),
    /template value/
  );
});

test("readiness rejects mismatched public/server contract addresses", () => {
  assert.throws(
    () => validateLiveReadinessEnvironment({...validEnv, NEXT_PUBLIC_SETTLEVA_ADDRESS:"0x2222222222222222222222222222222222222222"}),
    /do not match/
  );
});

test("readiness rejects mismatched pinned Reclaim provider versions", () => {
  assert.throws(
    () => validateLiveReadinessEnvironment({...validEnv, NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION:"2.0.0"}),
    /versions do not match/
  );
});

test("readiness rejects an HTTP or local Reclaim callback", () => {
  assert.throws(
    () => validateLiveReadinessEnvironment({...validEnv, RECLAIM_CALLBACK_URL:"http://localhost:3000/api/reclaim/callback"}),
    /public HTTPS/
  );
});

test("web environment template includes every required preflight variable", () => {
  const requiredVariables = [
    "ARC_RPC_URL",
    "NEXT_PUBLIC_ARC_RPC_URL",
    "SETTLEVA_CHAIN_ID",
    "NEXT_PUBLIC_ARC_CHAIN_ID",
    "SETTLEVA_CONTRACT_ADDRESS",
    "NEXT_PUBLIC_SETTLEVA_ADDRESS",
    "SETTLEVA_VERIFIER_PRIVATE_KEY",
    "RECLAIM_APP_ID",
    "RECLAIM_APP_SECRET",
    "RECLAIM_PROVIDER_ID",
    "RECLAIM_PROVIDER_VERSION",
    "NEXT_PUBLIC_RECLAIM_PROVIDER_ID",
    "NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION",
    "RECLAIM_CALLBACK_URL",
    "DATABASE_URL",
    "NEXT_PUBLIC_GITHUB_REPOSITORY"
  ];

  for (const name of requiredVariables) {
    assert.ok(envExample.has(name), `${name} is missing from apps/web/.env.example`);
  }
});

test("web environment template leaves deployment secrets and unknown live resources blank", () => {
  const mustBeConfiguredSecurely = [
    "SETTLEVA_CONTRACT_ADDRESS",
    "NEXT_PUBLIC_SETTLEVA_ADDRESS",
    "SETTLEVA_VERIFIER_PRIVATE_KEY",
    "RECLAIM_APP_ID",
    "RECLAIM_APP_SECRET",
    "RECLAIM_PROVIDER_ID",
    "RECLAIM_PROVIDER_VERSION",
    "NEXT_PUBLIC_RECLAIM_PROVIDER_ID",
    "NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION",
    "RECLAIM_CALLBACK_URL",
    "DATABASE_URL"
  ];

  for (const name of mustBeConfiguredSecurely) {
    assert.equal(envExample.get(name), "", `${name} must not imply a working production value`);
  }
});


test("readiness supports an explicit provider registry without a single default provider pin", () => {
  const {
    RECLAIM_PROVIDER_ID: _providerId,
    RECLAIM_PROVIDER_VERSION: _providerVersion,
    NEXT_PUBLIC_RECLAIM_PROVIDER_ID: _publicProviderId,
    NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION: _publicProviderVersion,
    ...otherEnv
  } = validEnv;
  const env = {
    ...otherEnv,
    SETTLEVA_RECLAIM_ADAPTERS: JSON.stringify([{
      providerId:"delivery-provider", providerVersion:"3", kind:"mapped",
      requestParameters:{"order.id":"order_id_input"},
      claimFields:{"delivery_status_result":"delivery.status","order_id_result":"order.id"}
    }])
  };
  const config = validateLiveReadinessEnvironment(env);
  assert.equal(config.reclaimProviderId, undefined);
  assert.equal(config.reclaimProviderVersion, undefined);
});
