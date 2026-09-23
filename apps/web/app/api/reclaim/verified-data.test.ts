import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findMatchingVerifiedProofData } from "./verified-data.js";

const binding = {
  sessionId: "session-123",
  paymentId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  conditionHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
};

test("matches session, payment, condition, and extracted parameters on the same entry", () => {
  const result = findMatchingVerifiedProofData([
    {
      context: {
        reclaimSessionId: "session-123",
        contextAddress: binding.paymentId,
        contextMessage: binding.conditionHash
      },
      extractedParameters: {
        "github.repo.full_name": "Investorquab/Settleva"
      }
    }
  ], binding);

  assert.deepEqual(result?.extractedParameters, {
    "github.repo.full_name": "Investorquab/Settleva"
  });
});

test("rejects when session and extracted parameters come from different entries", () => {
  const result = findMatchingVerifiedProofData([
    {
      context: {
        reclaimSessionId: "session-123",
        contextAddress: binding.paymentId,
        contextMessage: binding.conditionHash
      }
    },
    {
      context: {
        reclaimSessionId: "other-session",
        contextAddress: binding.paymentId,
        contextMessage: binding.conditionHash
      },
      extractedParameters: {
        "github.repo.full_name": "Investorquab/Settleva"
      }
    }
  ], binding);

  assert.equal(result, null);
});

test("rejects a matching context without verified extracted parameters", () => {
  const result = findMatchingVerifiedProofData([
    {
      context: {
        reclaimSessionId: "session-123",
        contextAddress: binding.paymentId,
        contextMessage: binding.conditionHash
      }
    }
  ], binding);

  assert.equal(result, null);
});

test("rejects a matching session bound to another payment", () => {
  const result = findMatchingVerifiedProofData([
    {
      context: {
        reclaimSessionId: "session-123",
        contextAddress: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        contextMessage: binding.conditionHash
      },
      extractedParameters: {
        "github.repo.full_name": "Investorquab/Settleva"
      }
    }
  ], binding);

  assert.equal(result, null);
});
