import postgres from "postgres";
import type { ReplayBinding, ReplayStore } from "./replay-store.js";

export class PostgresReplayStore implements ReplayStore {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 1 });
  }

  async claim(binding: ReplayBinding): Promise<boolean> {
    return this.sql.begin(async (sql) => {
      // The session row is the ownership token for this verification attempt.
      // RETURNING makes concurrent identical claims mutually exclusive: only the
      // transaction that inserts the session row may proceed to the proof row.
      const sessionInsert = await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('session', ${binding.sessionId}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
        returning identifier
      `;

      if (sessionInsert.length !== 1) return false;

      // The proof identifier is a second independent uniqueness boundary.
      const proofInsert = await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('proof', ${binding.proofIdentifier}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
        returning identifier
      `;

      // If the proof identifier was concurrently accepted elsewhere, this
      // transaction fails closed and rolls back its session ownership token.
      return proofInsert.length === 1;
    });
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
