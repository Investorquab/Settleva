import postgres from "postgres";
import type { PaymentCondition } from "@settleva/conditions";

export interface ReclaimSessionRecord {
  readonly sessionId: string;
  readonly paymentId: string;
  readonly conditionHash: string;
  readonly condition: PaymentCondition;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly statusTokenHash: string;
  readonly status: "pending" | "verified" | "failed";
  readonly proof?: unknown;
  readonly proofIdentifier?: string;
  readonly verificationSignature?: string;
  readonly error?: string;
}

export class ReclaimSessionStore {
  private readonly sql: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 1 });
  }

  async create(record: Omit<ReclaimSessionRecord, "status">): Promise<void> {
    await this.sql`
      insert into settleva_reclaim_sessions
        (session_id, payment_id, condition_hash, condition, provider_id, provider_version, status_token_hash, status)
      values
        (${record.sessionId}, ${record.paymentId}, ${record.conditionHash}, ${JSON.stringify(record.condition)}, ${record.providerId}, ${record.providerVersion}, ${record.statusTokenHash}, 'pending')
      on conflict (session_id) do nothing
    `;
  }

  async get(sessionId: string): Promise<ReclaimSessionRecord | null> {
    const rows = await this.sql`
      select session_id, payment_id, condition_hash, condition, provider_id, provider_version,
             status_token_hash, status, proof, proof_identifier, verification_signature, error
      from settleva_reclaim_sessions
      where session_id = ${sessionId}
      limit 1
    `;
    if (!rows[0]) return null;
    const row = rows[0] as any;
    return {
      sessionId: row.session_id,
      paymentId: row.payment_id,
      conditionHash: row.condition_hash,
      condition: row.condition,
      providerId: row.provider_id,
      providerVersion: row.provider_version,
      statusTokenHash: row.status_token_hash,
      status: row.status,
      proof: row.proof ?? undefined,
      proofIdentifier: row.proof_identifier ?? undefined,
      verificationSignature: row.verification_signature ?? undefined,
      error: row.error ?? undefined
    };
  }

  async markVerified(sessionId: string, proof: unknown, proofIdentifier: string, verificationSignature: string): Promise<boolean> {
    const result = await this.sql`
      update settleva_reclaim_sessions
      set status = 'verified',
          proof = ${JSON.stringify(proof)},
          proof_identifier = ${proofIdentifier},
          verification_signature = ${verificationSignature},
          error = null,
          updated_at = now()
      where session_id = ${sessionId}
        and status = 'pending'
    `;
    return result.count === 1;
  }

  async markFailed(sessionId: string, error: string): Promise<boolean> {
    const result = await this.sql`
      update settleva_reclaim_sessions
      set status = 'failed', error = ${error}, updated_at = now()
      where session_id = ${sessionId}
        and status = 'pending'
    `;
    return result.count === 1;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
