import assert from "node:assert/strict";
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
