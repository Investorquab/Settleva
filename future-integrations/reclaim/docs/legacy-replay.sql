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

-- Session and proof bindings are separate rows. The uniqueness constraints
-- therefore apply only to their respective identifier types; a proof row must
-- be allowed to carry the same session_id as its owning session row.
drop index if exists settleva_reclaim_replay_session_idx;
drop index if exists settleva_reclaim_replay_proof_idx;

create unique index settleva_reclaim_replay_session_idx
  on settleva_reclaim_replay (session_id)
  where identifier_type = 'session';

create unique index settleva_reclaim_replay_proof_idx
  on settleva_reclaim_replay (proof_identifier)
  where identifier_type = 'proof';
