import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  extractedParametersToClaims,
  parseProofContext,
  parseProofIdentifier
} from "./reclaim-binding.js";

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

test("extracted parameters become deterministic string claims", () => {
  assert.deepEqual(
    extractedParametersToClaims({
      "github.repo.full_name": "Investorquab/Settleva",
      "github.deployment.status": "success",
      "attempt": 2
    }),
    [
      {field: "github.repo.full_name", value: "Investorquab/Settleva"},
      {field: "github.deployment.status", value: "success"},
      {field: "attempt", value: "2"}
    ]
  );
});
