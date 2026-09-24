import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findMatchingVerifiedProofData } from "./verified-data.js";

const binding = {
  sessionId: "session-123",
  paymentId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  conditionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
};

test("matches all binding fields on the same verified entry", () => {
  const result = findMatchingVerifiedProofData([{
    context: {
      reclaimSessionId: binding.sessionId,
      contextAddress: binding.paymentId,
      contextMessage: binding.conditionHash
    },
    extractedParameters: {"github.repo.full_name":"Investorquab/Settleva"}
  }], binding);
  assert.deepEqual(result?.extractedParameters, {"github.repo.full_name":"Investorquab/Settleva"});
});

test("rejects session and extracted parameters split across entries", () => {
  const result = findMatchingVerifiedProofData([
    {context:{reclaimSessionId:binding.sessionId,contextAddress:binding.paymentId,contextMessage:binding.conditionHash}},
    {context:{reclaimSessionId:"other-session",contextAddress:binding.paymentId,contextMessage:binding.conditionHash},
     extractedParameters:{"github.repo.full_name":"Investorquab/Settleva"}}
  ], binding);
  assert.equal(result, null);
});

test("rejects a matching context without extracted parameters", () => {
  assert.equal(findMatchingVerifiedProofData([{
    context:{reclaimSessionId:binding.sessionId,contextAddress:binding.paymentId,contextMessage:binding.conditionHash}
  }], binding), null);
});

test("rejects a matching session bound to another payment", () => {
  assert.equal(findMatchingVerifiedProofData([{
    context:{reclaimSessionId:binding.sessionId,contextAddress:"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",contextMessage:binding.conditionHash},
    extractedParameters:{"github.repo.full_name":"Investorquab/Settleva"}
  }], binding), null);
});
