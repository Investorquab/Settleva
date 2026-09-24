export interface VerifiedProofDataEntry {
  readonly context?: {
    readonly reclaimSessionId?: unknown;
    readonly contextAddress?: unknown;
    readonly contextMessage?: unknown;
  };
  readonly extractedParameters?: Record<string, unknown>;
}

export interface VerifiedProofBinding {
  readonly sessionId: string;
  readonly paymentId: string;
  readonly conditionHash: string;
}

export function findMatchingVerifiedProofData(
  data: readonly unknown[],
  binding: VerifiedProofBinding
): VerifiedProofDataEntry | null {
  for (const value of data) {
    if (!value || typeof value !== "object") continue;
    const entry = value as VerifiedProofDataEntry;
    const context = entry.context;
    if (!context || typeof context !== "object") continue;
    if (
      context.reclaimSessionId !== binding.sessionId ||
      context.contextAddress !== binding.paymentId ||
      context.contextMessage !== binding.conditionHash
    ) continue;
    if (
      !entry.extractedParameters ||
      typeof entry.extractedParameters !== "object" ||
      Array.isArray(entry.extractedParameters)
    ) continue;
    return entry;
  }
  return null;
}
