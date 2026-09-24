create table if not exists settleva_reclaim_sessions (
  session_id text primary key,
  payment_id text not null,
  condition_hash text not null,
  condition jsonb not null,
  provider_id text not null,
  provider_version text not null,
  status text not null check (status in ('pending', 'verified', 'failed')),
  proof jsonb,
  proof_identifier text,
  verification_signature text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists settleva_reclaim_sessions_payment_idx
  on settleva_reclaim_sessions (payment_id);
