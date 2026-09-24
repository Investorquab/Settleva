import postgres from "postgres";
import type { ReplayBinding, ReplayStore } from "./replay-store.js";

export class PostgresReplayStore implements ReplayStore {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 1 });
  }

  async claim(binding: ReplayBinding): Promise<boolean> {
    return this.sql.begin(async (sql) => {
      // First make an exact existing claim idempotent. This closes the
      // crash window between replay acceptance and callback-session persistence:
      // a retry of the same cryptographically bound proof may recover, while a
      // different payment/condition/proof still fails closed.
      const existing = await sql`
        select
          (select count(*) from settleva_reclaim_replay
           where identifier_type = 'session'
             and identifier = ${binding.sessionId}
             and proof_identifier = ${binding.proofIdentifier}
             and payment_id = ${binding.paymentId}
             and condition_hash = ${binding.conditionHash}) as session_match,
          (select count(*) from settleva_reclaim_replay
           where identifier_type = 'proof'
             and identifier = ${binding.proofIdentifier}
             and session_id = ${binding.sessionId}
             and payment_id = ${binding.paymentId}
             and condition_hash = ${binding.conditionHash}) as proof_match
      `;
      if (Number(existing[0]?.session_match ?? 0) === 1 && Number(existing[0]?.proof_match ?? 0) === 1) {
        return true;
      }

      // The session row is the ownership token for this verification attempt.
      const sessionInsert = await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('session', ${binding.sessionId}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
        returning identifier
      `;

      if (sessionInsert.length !== 1) {
        // A conflicting session belongs to another binding, or a concurrent
        // identical transaction has not yet completed its proof row. Re-check
        // exact ownership before rejecting the claim.
        const recovered = await sql`
          select count(*) as count
          from settleva_reclaim_replay
          where identifier_type = 'proof'
            and identifier = ${binding.proofIdentifier}
            and session_id = ${binding.sessionId}
            and payment_id = ${binding.paymentId}
            and condition_hash = ${binding.conditionHash}
        `;
        return Number(recovered[0]?.count ?? 0) === 1;
      }

      // The proof identifier is a second independent uniqueness boundary.
      const proofInsert = await sql`
        insert into settleva_reclaim_replay
          (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
        values
          ('proof', ${binding.proofIdentifier}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
        on conflict do nothing
        returning identifier
      `;

      // A conflicting proof identifier belongs to another binding. Roll back
      // our session ownership token rather than partially accepting the proof.
      return proofInsert.length === 1;
    });
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
