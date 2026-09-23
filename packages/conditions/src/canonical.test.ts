import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeCondition, hashCondition } from "./canonical.js";

const base = {version:"1.0" as const,provider:"github",claims:[{field:"commit",operator:"equals" as const,value:"8f31c9a"},{field:"repository",operator:"equals" as const,value:"quab/website"}],expiresAt:1790000000};

test("canonicalization is deterministic regardless of claim order", () => {
  const reordered = {...base, claims:[...base.claims].reverse()};
  assert.equal(canonicalizeCondition(base), canonicalizeCondition(reordered));
  assert.equal(hashCondition(base), hashCondition(reordered));
});

test("hash is 32-byte hex", () => assert.match(hashCondition(base), /^0x[0-9a-f]{64}$/));
