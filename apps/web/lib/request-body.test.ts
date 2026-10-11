import assert from "node:assert/strict";
import test from "node:test";
import {JsonRequestBodyError, readJsonRequestBody} from "./request-body.ts";

test("parses valid JSON within the byte budget", async () => {
  const request = new Request("https://example.test/api", {method:"POST", body:JSON.stringify({hello:"settleva"})});
  assert.deepEqual(await readJsonRequestBody(request, 1024), {hello:"settleva"});
});

test("rejects an oversized declared body before parsing", async () => {
  const request = new Request("https://example.test/api", {method:"POST", headers:{"content-length":"8192"}, body:"{}"});
  await assert.rejects(readJsonRequestBody(request,1024),
    (error:unknown) => error instanceof JsonRequestBodyError && error.status === 413);
});

test("rejects an oversized streamed body without Content-Length", async () => {
  const request = new Request("https://example.test/api", {method:"POST", body:JSON.stringify({data:"x".repeat(4096)})});
  await assert.rejects(readJsonRequestBody(request,128),
    (error:unknown) => error instanceof JsonRequestBodyError && error.status === 413);
});

test("rejects malformed JSON safely", async () => {
  const request = new Request("https://example.test/api", {method:"POST", body:"{bad"});
  await assert.rejects(readJsonRequestBody(request,1024),
    (error:unknown) => error instanceof JsonRequestBodyError && error.status === 400);
});
