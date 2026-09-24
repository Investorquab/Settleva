export interface ReplayStore {
  /**
   * Atomically records a Reclaim session as accepted.
   * Returns false when the session was already accepted.
   */
  claimSession(sessionId: string): Promise<boolean>;

  /**
   * Atomically records a proof identifier as accepted.
   * Returns false when the proof identifier was already accepted.
   */
  claimProof(proofIdentifier: string): Promise<boolean>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly sessions = new Set<string>();
  private readonly proofs = new Set<string>();

  async claimSession(sessionId: string): Promise<boolean> {
    if (this.sessions.has(sessionId)) return false;
    this.sessions.add(sessionId);
    return true;
  }

  async claimProof(proofIdentifier: string): Promise<boolean> {
    if (this.proofs.has(proofIdentifier)) return false;
    this.proofs.add(proofIdentifier);
    return true;
  }
}
