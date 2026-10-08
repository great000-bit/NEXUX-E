-- Phase 2: functions for the expert portal (service role only), admin review (admins only),
-- and the email outbox changes that let status emails share the confirmation email queue.

-- 1. Outbox: several kinds of email per expert, never the same one twice ---------------------
alter table public.email_outbox
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists ref text not null default '';

drop index if exists public.email_outbox_once;
create unique index email_outbox_once on public.email_outbox (expert_id, template, ref);

drop function if exists public.claim_outbox_emails(int, int, int);
create or replace function public.claim_outbox_emails(
  p_batch int default 20,
  p_max_attempts int default 5,
  p_daily_cap int default 100
)
returns table (
  job_id bigint,
  job_expert_id text,
  job_to_email text,
  job_full_name text,
  job_title text,
  job_attempts int,
  job_template text,
  job_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent_today int;
  v_in_flight int;
  v_room int;
begin
  update public.email_outbox o
     set status = 'dead',
         failed_at = now(),
         last_error = coalesce(o.last_error, 'Gave up after the maximum number of attempts')
   where o.attempts >= p_max_attempts
     and (o.status in ('pending', 'failed')
          or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes'));

  select count(*) into v_sent_today
    from public.email_outbox o
   where o.status = 'sent'
     and o.sent_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  select count(*) into v_in_flight
    from public.email_outbox o
   where o.status = 'sending' and o.locked_at >= now() - interval '10 minutes';

  v_room := least(p_batch, p_daily_cap - v_sent_today - v_in_flight);
  if v_room <= 0 then
    return;
  end if;

  return query
  with picked as (
    select o.id
      from public.email_outbox o
     where o.attempts < p_max_attempts
       and (
         (o.status in ('pending', 'failed') and o.next_attempt_at <= now())
         or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes')
       )
     order by o.created_at
     limit v_room
     for update skip locked
  ),
  claimed as (
    update public.email_outbox o
       set status = 'sending',
           locked_at = now(),
           attempts = o.attempts + 1
      from picked
     where o.id = picked.id
    returning o.id, o.expert_id, o.to_email, o.attempts, o.template, o.payload
  )
  select c.id, c.expert_id, c.to_email, e.full_name, e.title, c.attempts, c.template, c.payload
    from claimed c
    join public.experts e on e.expert_id = c.expert_id;
end;
$$;

revoke all on function public.claim_outbox_emails(int, int, int) from public, anon, authenticated;
grant execute on function public.claim_outbox_emails(int, int, int) to service_role;

-- The portal pepper (used to hash IP addresses) can be read by the function like the other secrets.
create or replace function public.get_function_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
    from vault.decrypted_secrets s
   where s.name = p_name
     and p_name in ('resend_api_key', 'email_webhook_secret', 'portal_pepper')
   limit 1;
$$;

-- 2. Expert sign-in ------------------------------------------------------------------------
-- Always answers the same way. Rate limits are counted for every email, registered or not,
-- so the answer never reveals who has registered.
create or replace function public.portal_request_code(
  p_email text,
  p_ip_hash text,
  p_code_hash text,
  p_daily_cap int default 40
)
returns table (r_expert_id text, r_full_name text, r_title text, r_email text, r_should_send boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_key text;
  v_n_email int;
  v_n_ip int;
  v_sent_today int;
  v_expert record;
begin
  delete from public.portal_attempts where created_at < now() - interval '2 days';
  delete from public.expert_login_codes where created_at < now() - interval '1 day';
  delete from public.expert_sessions where expires_at < now() - interval '1 day';

  v_key := encode(extensions.digest(v_email, 'sha256'), 'hex');

  select count(*) into v_n_email from public.portal_attempts a
   where a.kind = 'request_email' and a.key_hash = v_key and a.created_at > now() - interval '15 minutes';
  select count(*) into v_n_ip from public.portal_attempts a
   where a.kind = 'request_ip' and a.key_hash = p_ip_hash and a.created_at > now() - interval '15 minutes';

  insert into public.portal_attempts (kind, key_hash) values ('request_email', v_key), ('request_ip', p_ip_hash);

  if v_n_email >= 3 or v_n_ip >= 10 or length(v_email) < 5 or length(v_email) > 254 then
    return query select null::text, null::text, null::text, null::text, false;
    return;
  end if;

  select e.expert_id, e.full_name, e.title, e.email into v_expert
    from public.experts e where lower(e.email) = v_email;
  if not found then
    return query select null::text, null::text, null::text, null::text, false;
    return;
  end if;

  select count(*) into v_sent_today from public.portal_attempts a
   where a.kind = 'code_sent' and a.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  if v_sent_today >= p_daily_cap then
    return query select null::text, null::text, null::text, null::text, false;
    return;
  end if;

  -- Only the newest code works.
  update public.expert_login_codes c set used_at = now() where c.email = v_email and c.used_at is null;
  insert into public.expert_login_codes (email, code_hash, expires_at)
  values (v_email, p_code_hash, now() + interval '10 minutes');
  insert into public.portal_attempts (kind, key_hash) values ('code_sent', 'all');

  return query select v_expert.expert_id, v_expert.full_name, v_expert.title, v_expert.email, true;
end;
$$;

create or replace function public.portal_verify_code(
  p_email text,
  p_code_hash text,
  p_ip_hash text,
  p_session_hash text,
  p_session_minutes int default 120
)
returns table (r_expert_id text, r_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip_n int;
  v_code public.expert_login_codes%rowtype;
  v_expert text;
  v_exp timestamptz;
begin
  select count(*) into v_ip_n from public.portal_attempts a
   where a.kind = 'verify_ip' and a.key_hash = p_ip_hash and a.created_at > now() - interval '15 minutes';
  insert into public.portal_attempts (kind, key_hash) values ('verify_ip', p_ip_hash);
  if v_ip_n >= 20 then
    return;
  end if;

  select * into v_code from public.expert_login_codes c
   where c.email = v_email and c.used_at is null and c.expires_at > now() and c.attempts < 5
   order by c.created_at desc limit 1
   for update;
  if not found then
    return;
  end if;

  if v_code.code_hash <> p_code_hash then
    update public.expert_login_codes c
       set attempts = c.attempts + 1,
           used_at = case when c.attempts + 1 >= 5 then now() else null end
     where c.id = v_code.id;
    return;
  end if;

  update public.expert_login_codes c set used_at = now() where c.id = v_code.id;

  select e.expert_id into v_expert from public.experts e where lower(e.email) = v_email;
  if v_expert is null then
    return;
  end if;

  v_exp := now() + make_interval(mins => p_session_minutes);
  insert into public.expert_sessions (expert_id, token_hash, expires_at) values (v_expert, p_session_hash, v_exp);
  return query select v_expert, v_exp;
end;
$$;

create or replace function public.portal_session(p_token_hash text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.expert_id
    from public.expert_sessions s
   where s.token_hash = p_token_hash and s.revoked_at is null and s.expires_at > now();
$$;

create or replace function public.portal_sign_out(p_token_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.expert_sessions set revoked_at = now() where token_hash = p_token_hash and revoked_at is null;
$$;

-- 3. Expert evidence -----------------------------------------------------------------------
create or replace function public.portal_record_consent(p_expert_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.experts set evidence_consent_at = coalesce(evidence_consent_at, now()) where expert_id = p_expert_id;
$$;

create or replace function public.portal_add_file(
  p_expert_id text,
  p_kind text,
  p_label text,
  p_original_name text,
  p_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_consent timestamptz;
  v_id uuid;
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_name text;
begin
  select e.verification_status, e.evidence_consent_at into v_status, v_consent
    from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('pending', 'more_evidence') then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  if v_consent is null then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  if p_kind = 'membership' then
    if v_label is null or v_label not in ('NES', 'IEPN', 'NSE', 'NIA', 'NITP', 'NIM', 'IUCN', 'Other') then
      raise exception 'bad_label' using errcode = 'P0001';
    end if;
  else
    v_label := null;
  end if;
  v_name := left(regexp_replace(coalesce(p_original_name, 'file'), '[[:cntrl:]]', '', 'g'), 120);

  insert into public.expert_files (expert_id, kind, label, original_name, storage_path)
  values (p_expert_id, p_kind, v_label, v_name, p_path)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.portal_finalize_file(
  p_expert_id text,
  p_file_id uuid,
  p_content_type text,
  p_size int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.expert_files f
     set state = 'ready', content_type = p_content_type, size_bytes = p_size, ready_at = now()
   where f.id = p_file_id and f.expert_id = p_expert_id and f.state = 'uploading';
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Marks one file deleted and returns its storage path so the function can remove the object.
create or replace function public.portal_delete_file(
  p_expert_id text,
  p_file_id uuid,
  p_reason text default 'removed_by_expert',
  p_require_editable boolean default true
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_path text;
begin
  select e.verification_status into v_status from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_require_editable and v_status not in ('pending', 'more_evidence') then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  update public.expert_files f
     set state = 'deleted', deleted_at = now(), deleted_reason = p_reason
   where f.id = p_file_id and f.expert_id = p_expert_id and f.state <> 'deleted'
  returning f.storage_path into v_path;
  if v_path is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_path;
end;
$$;

create or replace function public.portal_submit(p_expert_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_email text;
  v_audit bigint;
begin
  select e.verification_status, e.email into v_status, v_email
    from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_status not in ('pending', 'more_evidence') then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.expert_files f
     where f.expert_id = p_expert_id and f.state = 'ready' and f.kind <> 'cv'
  ) then
    raise exception 'no_evidence' using errcode = 'P0001';
  end if;

  update public.experts
     set verification_status = 'under_review', submitted_at = now(), review_message = null
   where expert_id = p_expert_id;

  insert into public.verification_audit (expert_id, actor, actor_type, action, old_status, new_status)
  values (p_expert_id, p_expert_id, 'expert', 'submitted_evidence', v_status, 'under_review')
  returning id into v_audit;

  if v_email is not null then
    insert into public.email_outbox (expert_id, to_email, template, ref)
    values (p_expert_id, v_email, 'verification_received', v_audit::text)
    on conflict do nothing;
  end if;
  return jsonb_build_object('status', 'under_review');
end;
$$;

-- 4. Maintenance and data removal (service role) ---------------------------------------------
create or replace function public.system_expire_stale_uploads()
returns setof text
language sql
security definer
set search_path = ''
as $$
  with u as (
    update public.expert_files f
       set state = 'deleted', deleted_at = now(), deleted_reason = 'upload_not_completed'
     where f.state = 'uploading' and f.created_at < now() - interval '1 hour'
    returning f.storage_path
  )
  select storage_path from u;
$$;

create or replace function public.system_files_to_delete(p_expert_id text)
returns table (r_id uuid, r_path text)
language sql
security definer
set search_path = ''
as $$
  select f.id, f.storage_path from public.expert_files f where f.expert_id = p_expert_id and f.state <> 'deleted';
$$;

create or replace function public.system_mark_files_deleted(
  p_expert_id text,
  p_actor text,
  p_actor_type text,
  p_reason text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  v_status text;
begin
  select e.verification_status into v_status from public.experts e where e.expert_id = p_expert_id;
  with u as (
    update public.expert_files f
       set state = 'deleted', deleted_at = now(), deleted_reason = p_reason
     where f.expert_id = p_expert_id and f.state <> 'deleted'
    returning 1
  )
  select count(*) into n from u;
  if n > 0 then
    insert into public.verification_audit (expert_id, actor, actor_type, action, old_status, new_status, reason)
    values (p_expert_id, p_actor, p_actor_type, 'files_deleted', v_status, v_status, p_reason);
  end if;
  return n;
end;
$$;

-- Experts marked Not verified whose files are older than the retention period.
create or replace function public.system_retention_candidates()
returns setof text
language sql
security definer
set search_path = ''
as $$
  select e.expert_id
    from public.experts e
   where e.verification_status = 'not_verified'
     and e.reviewed_at < now() - make_interval(
           days => coalesce((select s.value::int from public.verification_settings s where s.key = 'rejected_retention_days'), 30))
     and exists (select 1 from public.expert_files f where f.expert_id = e.expert_id and f.state <> 'deleted');
$$;

-- 5. Admin review (admins only, checked inside each function) ----------------------------------
create or replace function public.admin_review_expert(
  p_expert_id text,
  p_decision text,
  p_reason text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_old text;
  v_email text;
  v_new text;
  v_template text;
  v_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_audit bigint;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select e.verification_status, e.email into v_old, v_email
    from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_old not in ('under_review', 'verified', 'not_verified') then
    raise exception 'not_reviewable' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    v_new := 'verified'; v_template := 'verification_verified'; v_action := 'approved';
  elsif p_decision = 'reject' then
    v_new := 'not_verified'; v_template := 'verification_not_verified'; v_action := 'rejected';
    if v_reason is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
  elsif p_decision = 'more_evidence' then
    v_new := 'more_evidence'; v_template := 'verification_more_evidence'; v_action := 'requested_more_evidence';
    if v_reason is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
  else
    raise exception 'bad_decision' using errcode = 'P0001';
  end if;

  update public.experts
     set verification_status = v_new,
         reviewed_by = v_admin,
         reviewed_at = now(),
         verified_at = case when v_new = 'verified' then now() else null end,
         review_message = case when v_new = 'verified' then null else v_reason end
   where expert_id = p_expert_id;

  insert into public.verification_audit (expert_id, actor, actor_type, action, old_status, new_status, reason, notes)
  values (p_expert_id, v_admin, 'admin', v_action, v_old, v_new, v_reason, v_notes)
  returning id into v_audit;

  if v_email is not null then
    insert into public.email_outbox (expert_id, to_email, template, ref, payload)
    values (p_expert_id, v_email, v_template, v_audit::text, jsonb_build_object('message', coalesce(v_reason, '')))
    on conflict do nothing;
  end if;

  return jsonb_build_object('ok', true, 'status', v_new);
end;
$$;

create or replace function public.admin_status_counts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_object_agg(t.s, t.c) from (
       select e.verification_status as s, count(*) as c from public.experts e group by e.verification_status
     ) t),
    '{}'::jsonb);
end;
$$;

-- Everything held about one expert, for a data access request. File contents are not included.
create or replace function public.admin_export_expert(p_expert_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'expert', to_jsonb(e),
    'files', coalesce((select jsonb_agg(jsonb_build_object(
        'kind', f.kind, 'label', f.label, 'original_name', f.original_name, 'content_type', f.content_type,
        'size_bytes', f.size_bytes, 'state', f.state, 'uploaded_at', f.created_at, 'deleted_at', f.deleted_at,
        'deleted_reason', f.deleted_reason) order by f.created_at)
      from public.expert_files f where f.expert_id = e.expert_id), '[]'::jsonb),
    'verification_log', coalesce((select jsonb_agg(to_jsonb(a) - 'id' order by a.created_at)
      from public.verification_audit a where a.expert_id = e.expert_id), '[]'::jsonb),
    'emails', coalesce((select jsonb_agg(jsonb_build_object(
        'template', o.template, 'status', o.status, 'created_at', o.created_at, 'sent_at', o.sent_at) order by o.created_at)
      from public.email_outbox o where o.expert_id = e.expert_id), '[]'::jsonb)
  ) into v
  from public.experts e where e.expert_id = p_expert_id;
  if v is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- 6. Permissions ------------------------------------------------------------------------------
revoke all on function
  public.portal_request_code(text, text, text, int),
  public.portal_verify_code(text, text, text, text, int),
  public.portal_session(text),
  public.portal_sign_out(text),
  public.portal_record_consent(text),
  public.portal_add_file(text, text, text, text, text),
  public.portal_finalize_file(text, uuid, text, int),
  public.portal_delete_file(text, uuid, text, boolean),
  public.portal_submit(text),
  public.system_expire_stale_uploads(),
  public.system_files_to_delete(text),
  public.system_mark_files_deleted(text, text, text, text),
  public.system_retention_candidates(),
  public.admin_review_expert(text, text, text, text),
  public.admin_status_counts(),
  public.admin_export_expert(text),
  public.enforce_expert_file_limit(),
  public.block_audit_changes()
from public, anon, authenticated;

grant execute on function
  public.portal_request_code(text, text, text, int),
  public.portal_verify_code(text, text, text, text, int),
  public.portal_session(text),
  public.portal_sign_out(text),
  public.portal_record_consent(text),
  public.portal_add_file(text, text, text, text, text),
  public.portal_finalize_file(text, uuid, text, int),
  public.portal_delete_file(text, uuid, text, boolean),
  public.portal_submit(text),
  public.system_expire_stale_uploads(),
  public.system_files_to_delete(text),
  public.system_mark_files_deleted(text, text, text, text),
  public.system_retention_candidates()
to service_role;

-- Admin functions: callable by signed in users, but each one refuses anyone who is not on the allow-list.
grant execute on function
  public.admin_review_expert(text, text, text, text),
  public.admin_status_counts(),
  public.admin_export_expert(text)
to authenticated;
