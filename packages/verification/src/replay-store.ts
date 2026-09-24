export interface ReplayBinding {
  readonly sessionId: string;
  readonly proofIdentifier: string;
  readonly paymentId: string;
  readonly conditionHash: string;
}

/**
 * Atomically accepts the session/proof pair for one payment condition.
 * Returns false when either identifier has already been accepted.
 */
export interface ReplayStore {
  claim(binding: ReplayBinding): Promise<boolean>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly sessions = new Map<string, ReplayBinding>();
  private readonly proofs = new Map<string, ReplayBinding>();

  async claim(binding: ReplayBinding): Promise<boolean> {
    if (this.sessions.has(binding.sessionId) || this.proofs.has(binding.proofIdentifier)) {
      return false;
    }

    this.sessions.set(binding.sessionId, binding);
    this.proofs.set(binding.proofIdentifier, binding);
    return true;
  }
}
