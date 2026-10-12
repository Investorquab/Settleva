export class JsonRequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(status: 400 | 413, message: string) {
    super(message);
    this.name = "JsonRequestBodyError";
    this.status = status;
  }
}

/** Read bounded request bytes without altering them before signature verification. */
export async function readRawRequestBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("A positive request-body byte limit is required.");
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^(0|[1-9]\d*)$/.test(declaredLength)) throw new JsonRequestBodyError(400, "Content-Length is invalid.");
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size > maxBytes) throw new JsonRequestBodyError(413, "Request body exceeds the allowed size.");
  }
  if (!request.body) throw new JsonRequestBodyError(400, "A request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new JsonRequestBodyError(413, "Request body exceeds the allowed size.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof JsonRequestBodyError) throw error;
    throw new JsonRequestBodyError(400, "Request body could not be read.");
  } finally {
    try { reader.releaseLock(); } catch { /* already cancelled or released */ }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Parse bounded JSON, enforcing both the declared and actual streamed size. */
export async function readJsonRequestBody<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const bytes = await readRawRequestBody(request, maxBytes);
  let decoded: string;
  try { decoded = new TextDecoder("utf-8", {fatal:true}).decode(bytes); }
  catch { throw new JsonRequestBodyError(400, "Request body must be valid UTF-8 JSON."); }
  try { return JSON.parse(decoded) as T; }
  catch { throw new JsonRequestBodyError(400, "Request body must be valid JSON."); }
}
