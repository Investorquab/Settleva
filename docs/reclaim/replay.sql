create table if not exists settleva_reclaim_replay (
  identifier_type text not null,
  identifier text not null,
  session_id text not null,
  proof_identifier text not null,
  payment_id text not null,
  condition_hash text not null,
  accepted_at timestamptz not null default now(),
  primary key (identifier_type, identifier)
);

create unique index if not exists settleva_reclaim_replay_session_idx
  on settleva_reclaim_replay (session_id);

create unique index if not exists settleva_reclaim_replay_proof_idx
  on settleva_reclaim_replay (proof_identifier);
