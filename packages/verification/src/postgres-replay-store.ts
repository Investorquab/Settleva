import postgres from "postgres";
import type { ReplayBinding, ReplayStore } from "./replay-store.js";

export class PostgresReplayStore implements ReplayStore {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 1 });
  }

  async claim(binding: ReplayBinding): Promise<boolean> {
    return this.sql.begin(async (sql) => {
      const existing = await sql`
        select identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash
        from settleva_reclaim_replay
        where (identifier_type = 'session' and identifier = ${binding.sessionId})
           or (identifier_type = 'proof' and identifier = ${binding.proofIdentifier})
        for update
      `;

      for (const row of existing) {
        if (
          row.session_id !== binding.sessionId ||
          row.proof_identifier !== binding.proofIdentifier ||
          row.payment_id !== binding.paymentId ||
          row.condition_hash !== binding.conditionHash
        ) {
          return false;
        }
      }

      await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('session', ${binding.sessionId}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
      `;

      await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('proof', ${binding.proofIdentifier}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
      `;

      const accepted = await sql`
        select session_id, proof_identifier, payment_id, condition_hash
        from settleva_reclaim_replay
        where (identifier_type = 'session' and identifier = ${binding.sessionId})
           or (identifier_type = 'proof' and identifier = ${binding.proofIdentifier})
        for update
      `;

      return accepted.length === 2 && accepted.every((row) =>
        row.session_id === binding.sessionId &&
        row.proof_identifier === binding.proofIdentifier &&
        row.payment_id === binding.paymentId &&
        row.condition_hash === binding.conditionHash
      );
    });
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
