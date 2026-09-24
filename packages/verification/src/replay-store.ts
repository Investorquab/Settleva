export interface ReplayBinding {
  readonly sessionId: string;
  readonly proofIdentifier: string;
  readonly paymentId: string;
  readonly conditionHash: string;
}

/**
 * Atomically accepts the session/proof pair for one payment condition.
 * An exact previously accepted binding is idempotently recoverable; any
 * conflicting identifier binding is rejected.
 */
export interface ReplayStore {
  claim(binding: ReplayBinding): Promise<boolean>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly sessions = new Map<string, ReplayBinding>();
  private readonly proofs = new Map<string, ReplayBinding>();

  async claim(binding: ReplayBinding): Promise<boolean> {
    const existingSession = this.sessions.get(binding.sessionId);
    const existingProof = this.proofs.get(binding.proofIdentifier);
    if (existingSession || existingProof) {
      return Boolean(
        existingSession &&
        existingProof &&
        existingSession.proofIdentifier === binding.proofIdentifier &&
        existingSession.paymentId === binding.paymentId &&
        existingSession.conditionHash === binding.conditionHash &&
        existingProof.sessionId === binding.sessionId &&
        existingProof.paymentId === binding.paymentId &&
        existingProof.conditionHash === binding.conditionHash
      );
    }

    this.sessions.set(binding.sessionId, binding);
    this.proofs.set(binding.proofIdentifier, binding);
    return true;
  }
}
