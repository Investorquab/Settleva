import { createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto";
import { hashCondition, type PaymentCondition, type VerifiedClaim } from "@settleva/conditions";
import { keccak256, toHex, type Hex } from "viem";

export const SIGNED_EVIDENCE_MAX_AGE_SECONDS = 5 * 60;
export const SIGNED_EVIDENCE_FUTURE_SKEW_SECONDS = 60;
const MAX_ADAPTERS = 50;
const MAX_BODY_BYTES = 64 * 1024;

export type SignedEvidenceErrorCode =
  | "CONFIGURATION"
  | "PROVIDER_NOT_REGISTERED"
  | "INVALID_REQUEST"
  | "INVALID_SIGNATURE"
  | "STALE_REQUEST";

export class SignedEvidenceError extends Error {
  readonly code: SignedEvidenceErrorCode;
  constructor(code: SignedEvidenceErrorCode, message: string) {
    super(message);
    this.name = "SignedEvidenceError";
    this.code = code;
  }
}

interface SignedEvidenceAdapter {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly publicKey: KeyObject;
}

export interface SignedEvidenceEnvelope {
  readonly protocolVersion: 1;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly eventId: string;
  readonly paymentId: Hex;
  readonly conditionHash: Hex;
  readonly condition: PaymentCondition;
  readonly claims: readonly VerifiedClaim[];
  readonly proofIdentifier: Hex;
}

export interface VerifySignedEvidenceInput {
  readonly rawBody: Uint8Array;
  readonly timestamp: string | null | undefined;
  readonly signature: string | null | undefined;
  readonly env?: Record<string, string | undefined>;
  readonly now?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function requiredString(value: unknown, label: string, pattern: RegExp, maxLength: number): string {
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > maxLength || !pattern.test(value)) {
    throw new SignedEvidenceError("INVALID_REQUEST", label + " is missing or malformed.");
  }
  return value;
}

function parseAdapterRegistry(env: Record<string, string | undefined>): SignedEvidenceAdapter[] {
  const raw = env.SETTLEVA_SIGNED_EVIDENCE_ADAPTERS?.trim();
  if (!raw) {
    throw new SignedEvidenceError("CONFIGURATION", "No signed evidence providers are configured.");
  }
  if (raw.length > MAX_BODY_BYTES) {
    throw new SignedEvidenceError("CONFIGURATION", "Signed evidence provider configuration is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new SignedEvidenceError("CONFIGURATION", "SETTLEVA_SIGNED_EVIDENCE_ADAPTERS must contain valid JSON.");
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_ADAPTERS) {
    throw new SignedEvidenceError("CONFIGURATION", "SETTLEVA_SIGNED_EVIDENCE_ADAPTERS must be an array of 1 to 50 providers.");
  }

  const identities = new Set<string>();
  return parsed.map((item, index) => {
    if (!isRecord(item) || !exactKeys(item, ["providerId", "providerVersion", "publicKeyPem"])) {
      throw new SignedEvidenceError("CONFIGURATION", "Signed evidence adapter " + index + " has an invalid shape.");
    }
    const providerId = requiredString(item.providerId, "Adapter providerId", /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/, 128);
    const providerVersion = requiredString(item.providerVersion, "Adapter providerVersion", /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/, 64);
    const identity = providerId + "\u0000" + providerVersion;
    if (identities.has(identity)) {
      throw new SignedEvidenceError("CONFIGURATION", "Signed evidence configuration contains a duplicate provider ID/version.");
    }
    identities.add(identity);

    if (typeof item.publicKeyPem !== "string" || !item.publicKeyPem.trim() || item.publicKeyPem.length > 4096) {
      throw new SignedEvidenceError("CONFIGURATION", "Each signed evidence adapter requires an Ed25519 publicKeyPem.");
    }
    let publicKey: KeyObject;
    try {
      publicKey = createPublicKey(item.publicKeyPem);
    } catch {
      throw new SignedEvidenceError("CONFIGURATION", "A signed evidence adapter public key could not be parsed.");
    }
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new SignedEvidenceError("CONFIGURATION", "Signed evidence adapter keys must use Ed25519.");
    }
    return { providerId, providerVersion, publicKey };
  });
}

function parseEnvelope(value: unknown, rawBody: Uint8Array): SignedEvidenceEnvelope {
  if (!isRecord(value) || !exactKeys(value, [
    "protocolVersion", "providerId", "providerVersion", "eventId", "paymentId",
    "conditionHash", "condition", "claims"
  ])) {
    throw new SignedEvidenceError("INVALID_REQUEST", "Signed evidence body has an invalid shape.");
  }
  if (value.protocolVersion !== 1) {
    throw new SignedEvidenceError("INVALID_REQUEST", "Unsupported signed evidence protocol version.");
  }
  const providerId = requiredString(value.providerId, "providerId", /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/, 128);
  const providerVersion = requiredString(value.providerVersion, "providerVersion", /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/, 64);
  const eventId = requiredString(value.eventId, "eventId", /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, 128);
  if (typeof value.paymentId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.paymentId)) {
    throw new SignedEvidenceError("INVALID_REQUEST", "paymentId must be a 32-byte hex identifier.");
  }
  if (typeof value.conditionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value.conditionHash)) {
    throw new SignedEvidenceError("INVALID_REQUEST", "conditionHash must be a 32-byte hex value.");
  }
  if (!isRecord(value.condition) || !exactKeys(value.condition, ["version", "provider", "providerVersion", "claims", "expiresAt"])) {
    throw new SignedEvidenceError("INVALID_REQUEST", "condition has an invalid shape.");
  }
  const condition = value.condition as unknown as PaymentCondition;
  if (!Array.isArray(condition.claims) || condition.claims.length < 1 || condition.claims.length > 100) {
    throw new SignedEvidenceError("INVALID_REQUEST", "condition must contain between 1 and 100 claims.");
  }
  for (const claim of condition.claims) {
    if (!isRecord(claim) || !exactKeys(claim, ["field", "operator", "value"])) {
      throw new SignedEvidenceError("INVALID_REQUEST", "Condition claims must contain only field, operator and value.");
    }
  }

  let calculatedHash: Hex;
  try {
    calculatedHash = hashCondition(condition);
  } catch {
    throw new SignedEvidenceError("INVALID_REQUEST", "condition is not a valid Settleva payment condition.");
  }
  if (calculatedHash.toLowerCase() !== value.conditionHash.toLowerCase()) {
    throw new SignedEvidenceError("INVALID_REQUEST", "condition does not match conditionHash.");
  }
  if (condition.provider !== providerId || condition.providerVersion !== providerVersion) {
    throw new SignedEvidenceError("INVALID_REQUEST", "Provider ID/version must match the payment condition.");
  }

  if (!Array.isArray(value.claims) || value.claims.length !== condition.claims.length) {
    throw new SignedEvidenceError("INVALID_REQUEST", "claims must contain exactly the condition's claim fields.");
  }
  const expectedFields = new Set(condition.claims.map((claim) => claim.field));
  const seenFields = new Set<string>();
  const claims: VerifiedClaim[] = [];
  for (const rawClaim of value.claims) {
    if (!isRecord(rawClaim) || !exactKeys(rawClaim, ["field", "value"])) {
      throw new SignedEvidenceError("INVALID_REQUEST", "Each evidence claim must contain only field and value.");
    }
    const field = requiredString(rawClaim.field, "Claim field", /^[^\u0000-\u001f]{1,256}$/, 256);
    if (typeof rawClaim.value !== "string" || rawClaim.value.length > 4096) {
      throw new SignedEvidenceError("INVALID_REQUEST", "Evidence claim values must be strings of at most 4096 characters.");
    }
    if (!expectedFields.has(field) || seenFields.has(field)) {
      throw new SignedEvidenceError("INVALID_REQUEST", "Evidence claims must match the policy fields exactly with no duplicates.");
    }
    seenFields.add(field);
    claims.push({ field, value: rawClaim.value });
  }
  if (seenFields.size !== expectedFields.size) {
    throw new SignedEvidenceError("INVALID_REQUEST", "Evidence is missing one or more committed claim fields.");
  }

  return {
    protocolVersion: 1,
    providerId,
    providerVersion,
    eventId,
    paymentId: value.paymentId as Hex,
    conditionHash: value.conditionHash as Hex,
    condition,
    claims,
    proofIdentifier: keccak256(toHex(rawBody))
  };
}

/**
 * Verify a source-owned Ed25519 signature over the exact raw request bytes.
 * Payload: UTF8("SETTLEVA-SIGNED-EVIDENCE-V1\n" + timestamp + "\n") || rawBody.
 * The source's private key must remain in its authoritative server, never a browser.
 */
export function verifySignedEvidenceRequest(input: VerifySignedEvidenceInput): SignedEvidenceEnvelope {
  if (!(input.rawBody instanceof Uint8Array) || input.rawBody.byteLength < 1 || input.rawBody.byteLength > MAX_BODY_BYTES) {
    throw new SignedEvidenceError("INVALID_REQUEST", "Signed evidence body is empty or too large.");
  }
  if (typeof input.timestamp !== "string" || !/^\d{10}$/.test(input.timestamp)) {
    throw new SignedEvidenceError("INVALID_REQUEST", "x-settleva-timestamp must be Unix seconds.");
  }
  if (typeof input.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(input.signature)) {
    throw new SignedEvidenceError("INVALID_SIGNATURE", "x-settleva-signature must be a base64url Ed25519 signature.");
  }

  const now = input.now ?? Math.floor(Date.now() / 1000);
  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(now) || timestamp > now + SIGNED_EVIDENCE_FUTURE_SKEW_SECONDS
    || now - timestamp > SIGNED_EVIDENCE_MAX_AGE_SECONDS) {
    throw new SignedEvidenceError("STALE_REQUEST", "Signed evidence timestamp is outside the allowed freshness window.");
  }

  let rawValue: unknown;
  try {
    rawValue = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.rawBody)) as unknown;
  } catch {
    throw new SignedEvidenceError("INVALID_REQUEST", "Signed evidence body must be valid UTF-8 JSON.");
  }
  if (!isRecord(rawValue)) throw new SignedEvidenceError("INVALID_REQUEST", "Signed evidence body must be a JSON object.");
  const providerId = requiredString(rawValue.providerId, "providerId", /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/, 128);
  const providerVersion = requiredString(rawValue.providerVersion, "providerVersion", /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/, 64);
  const adapters = parseAdapterRegistry(input.env ?? process.env);
  const adapter = adapters.find((item) => item.providerId === providerId && item.providerVersion === providerVersion);
  if (!adapter) {
    throw new SignedEvidenceError("PROVIDER_NOT_REGISTERED", "No signed evidence key is registered for this exact provider ID/version.");
  }

  const signatureBytes = Buffer.from(input.signature, "base64url");
  if (signatureBytes.length !== 64 || signatureBytes.toString("base64url") !== input.signature) {
    throw new SignedEvidenceError("INVALID_SIGNATURE", "The signed evidence signature encoding is invalid.");
  }
  const prefix = Buffer.from("SETTLEVA-SIGNED-EVIDENCE-V1\n" + input.timestamp + "\n", "utf8");
  const payload = Buffer.concat([prefix, Buffer.from(input.rawBody)]);
  let signatureValid = false;
  try {
    signatureValid = verifySignature(null, payload, adapter.publicKey, signatureBytes);
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    throw new SignedEvidenceError("INVALID_SIGNATURE", "The signed evidence signature is invalid.");
  }

  return parseEnvelope(rawValue, input.rawBody);
}
