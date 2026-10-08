-- Found by the Supabase performance advisor: deleting an expert cascades to their sessions,
-- which needs an index on the foreign key to stay fast.
create index if not exists expert_sessions_expert_idx on public.expert_sessions (expert_id);
