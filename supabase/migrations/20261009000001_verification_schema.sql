-- Phase 2: verification workflow. Schema, review functions, audit log and private evidence storage.
--
-- Access model:
--   * Experts never get a database role. They sign in with an emailed one-time code and talk to the
--     expert-portal Edge Function, which uses the service role and enforces "own record only".
--   * Admins use their normal Supabase login plus the existing public.admins allow-list.
--   * Every table below has row level security on. Only admins can read, and only through policies.

-- 1. Statuses and review columns ---------------------------------------------------------
alter table public.experts drop constraint if exists experts_verification_valid;
alter table public.experts add constraint experts_verification_valid
  check (verification_status in ('pending', 'under_review', 'more_evidence', 'verified', 'not_verified'));

alter table public.experts
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists verified_at timestamptz,
  add column if not exists review_message text,
  add column if not exists evidence_consent_at timestamptz;

create index if not exists experts_verification_status_idx on public.experts (verification_status);

-- 2. Evidence files ----------------------------------------------------------------------
create table public.expert_files (
  id uuid primary key default gen_random_uuid(),
  expert_id text not null references public.experts (expert_id) on delete cascade,
  kind text not null check (kind in ('membership', 'licence', 'qualification', 'cv')),
  label text,
  original_name text not null,
  content_type text,
  size_bytes integer,
  storage_path text not null unique,
  state text not null default 'uploading' check (state in ('uploading', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  deleted_reason text
);
create index expert_files_expert_idx on public.expert_files (expert_id) where state <> 'deleted';

-- No more than 8 live files per expert, enforced by the database as well as the function.
create or replace function public.enforce_expert_file_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  n int;
begin
  select count(*) into n
    from public.expert_files f
   where f.expert_id = new.expert_id
     and (f.state = 'ready' or (f.state = 'uploading' and f.created_at > now() - interval '1 hour'));
  if n >= 8 then
    raise exception 'file_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger expert_files_limit
  before insert on public.expert_files
  for each row execute function public.enforce_expert_file_limit();

-- 3. Sign-in codes, sessions and rate limit bookkeeping ------------------------------------
create table public.expert_login_codes (
  id bigint generated always as identity primary key,
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index expert_login_codes_email_idx on public.expert_login_codes (email, created_at desc);

create table public.expert_sessions (
  id bigint generated always as identity primary key,
  expert_id text not null references public.experts (expert_id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table public.portal_attempts (
  id bigint generated always as identity primary key,
  kind text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index portal_attempts_lookup_idx on public.portal_attempts (kind, key_hash, created_at desc);

-- 4. Audit log: append only ----------------------------------------------------------------
-- No foreign key on purpose, so the record of a decision survives deleting an expert's data.
create table public.verification_audit (
  id bigint generated always as identity primary key,
  expert_id text not null,
  actor text not null,
  actor_type text not null check (actor_type in ('admin', 'expert', 'system')),
  action text not null,
  old_status text,
  new_status text,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);
create index verification_audit_expert_idx on public.verification_audit (expert_id, created_at desc);

create or replace function public.block_audit_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The verification log cannot be changed' using errcode = 'P0001';
end;
$$;

create trigger verification_audit_no_change
  before update or delete on public.verification_audit
  for each row execute function public.block_audit_changes();
create trigger verification_audit_no_truncate
  before truncate on public.verification_audit
  for each statement execute function public.block_audit_changes();

-- 5. Settings ------------------------------------------------------------------------------
create table public.verification_settings (
  key text primary key,
  value text not null,
  description text
);
insert into public.verification_settings (key, value, description) values
  ('rejected_retention_days', '30', 'Days to keep uploaded files after an expert is marked Not verified. Then the files are deleted.')
on conflict (key) do nothing;

-- 6. Row level security --------------------------------------------------------------------
alter table public.expert_files enable row level security;
alter table public.expert_login_codes enable row level security;
alter table public.expert_sessions enable row level security;
alter table public.portal_attempts enable row level security;
alter table public.verification_audit enable row level security;
alter table public.verification_settings enable row level security;

revoke all on public.expert_files, public.expert_login_codes, public.expert_sessions, public.portal_attempts,
  public.verification_audit, public.verification_settings from anon, authenticated;

-- Admins may read files, the audit log and settings. Nobody may write through the API.
grant select on public.expert_files, public.verification_audit, public.verification_settings to authenticated;
create policy expert_files_admin_read on public.expert_files for select to authenticated using (public.is_admin());
create policy verification_audit_admin_read on public.verification_audit for select to authenticated using (public.is_admin());
create policy verification_settings_admin_read on public.verification_settings for select to authenticated using (public.is_admin());

grant select, insert, update, delete on public.expert_files, public.expert_login_codes, public.expert_sessions,
  public.portal_attempts, public.verification_settings to service_role;
grant select, insert on public.verification_audit to service_role;
grant select, update on public.experts to service_role;
grant select, insert, update on public.email_outbox to service_role;
grant usage, select on all sequences in schema public to service_role;

-- 7. Private storage bucket ----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expert-evidence', 'expert-evidence', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Experts have no storage role at all: with no policy for anon or authenticated users, they cannot read,
-- list, upload or delete. They reach their own files only through short lived signed URLs that the
-- expert-portal function creates after checking ownership. Admins can read and remove evidence.
create policy "Admins can read evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'expert-evidence' and public.is_admin());

create policy "Admins can remove evidence" on storage.objects
  for delete to authenticated
  using (bucket_id = 'expert-evidence' and public.is_admin());
