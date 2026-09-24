import postgres from "postgres";
import type { ReplayBinding, ReplayStore } from "./replay-store.js";

export class PostgresReplayStore implements ReplayStore {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 1 });
  }

  async claim(binding: ReplayBinding): Promise<boolean> {
    return this.sql.begin(async (sql) => {
      const session = await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('session', ${binding.sessionId}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
        returning identifier
      `;

      if (session.length === 0) return false;

      const proof = await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('proof', ${binding.proofIdentifier}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
        returning identifier
      `;

      if (proof.length === 0) {
        throw new ReplayConflictError();
      }

      return true;
    }).catch((error) => {
      if (error instanceof ReplayConflictError) return false;
      throw error;
    });
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

class ReplayConflictError extends Error {
  constructor() {
    super("Replay identifier already accepted.");
    this.name = "ReplayConflictError";
  }
}
