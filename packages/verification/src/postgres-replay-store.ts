import postgres from "postgres";
import type { ReplayBinding, ReplayStore } from "./replay-store.js";

class ReplayConflictError extends Error {
  constructor() {
    super("Replay identifier is already bound to a different verification");
    this.name = "ReplayConflictError";
  }
}

export class PostgresReplayStore implements ReplayStore {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 1, connect_timeout: 8, idle_timeout: 1 });
  }

  async claim(binding: ReplayBinding): Promise<boolean> {
    try {
      return await this.sql.begin(async (sql) => {
        // Exact retries are idempotent so a crash between replay acceptance
        // and session persistence can recover the same verified result.
        const existing = await sql`
          select
            (select count(*) from settleva_evidence_replay
             where identifier_type = 'session'
               and identifier = ${binding.sessionId}
               and proof_identifier = ${binding.proofIdentifier}
               and payment_id = ${binding.paymentId}
               and condition_hash = ${binding.conditionHash}) as session_match,
            (select count(*) from settleva_evidence_replay
             where identifier_type = 'proof'
               and identifier = ${binding.proofIdentifier}
               and session_id = ${binding.sessionId}
               and payment_id = ${binding.paymentId}
               and condition_hash = ${binding.conditionHash}) as proof_match
        `;
        if (Number(existing[0]?.session_match ?? 0) === 1 && Number(existing[0]?.proof_match ?? 0) === 1) {
          return true;
        }

        const sessionInsert = await sql`
          insert into settleva_evidence_replay
            (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
          values
            ('session', ${binding.sessionId}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
          on conflict do nothing
          returning identifier
        `;

        if (sessionInsert.length !== 1) {
          // A concurrent exact attempt becomes visible after its transaction
          // commits. Only recover if both identifiers are bound to this exact
          // payment/condition/proof tuple.
          const recovered = await sql`
            select count(*) as count
            from settleva_evidence_replay
            where identifier_type = 'proof'
              and identifier = ${binding.proofIdentifier}
              and session_id = ${binding.sessionId}
              and payment_id = ${binding.paymentId}
              and condition_hash = ${binding.conditionHash}
          `;
          return Number(recovered[0]?.count ?? 0) === 1;
        }

        const proofInsert = await sql`
          insert into settleva_evidence_replay
            (identifier_type, identifier, session_id, proof_identifier, payment_id, condition_hash)
          values
            ('proof', ${binding.proofIdentifier}, ${binding.sessionId}, ${binding.proofIdentifier}, ${binding.paymentId}, ${binding.conditionHash})
          on conflict do nothing
          returning identifier
        `;

        // Throwing is deliberate: returning false would COMMIT the newly
        // inserted session row and leave a partial binding behind.
        if (proofInsert.length !== 1) throw new ReplayConflictError();
        return true;
      });
    } catch (error) {
      if (error instanceof ReplayConflictError) return false;
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
