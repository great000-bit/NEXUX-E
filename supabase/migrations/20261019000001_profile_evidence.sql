-- Release 2 (Phase 2): profile completion, documented project roles, references, and "Evidence Submitted" for a complete set.
-- Additive and backwards compatible. Nothing here changes an existing registration row.
--
--   * a new kind of evidence file: a documented project role (the other kinds are unchanged);
--   * references: the expert enters a referee's name, organisation and relationship. Nobody is emailed. An administrator
--     records the outcome of any check they make;
--   * a completion function for the expert's own meter;
--   * submitting for review now needs a complete set (a qualification, a professional membership or licence, a documented
--     project role and one reference, with the evidence consent). Submitting moves the expert to "Evidence Submitted" (the
--     stored value is still under_review) and queues one minimal email to the administrator through the existing outbox.
--
-- Evidence and references are private: tables have row level security on and no public policy; experts reach their own through
-- the sign-in portal function only; administrators read them through admin functions and signed links. Never public, never in exports.

-- 1. Project role documents.
alter table public.expert_files drop constraint if exists expert_files_kind_check;
alter table public.expert_files add constraint expert_files_kind_check
  check (kind in ('membership', 'licence', 'qualification', 'cv', 'project_role'));

-- 2. References.
create table if not exists public.expert_references (
  id uuid primary key default gen_random_uuid(),
  expert_id text not null references public.experts (expert_id) on delete cascade,
  referee_name text not null check (char_length(btrim(referee_name)) between 2 and 120),
  organisation text not null check (char_length(btrim(organisation)) between 2 and 160),
  relationship text not null check (char_length(btrim(relationship)) between 2 and 160),
  created_at timestamptz not null default now(),
  -- Recorded by an administrator only.
  outcome text not null default 'not_checked' check (outcome in ('not_checked', 'confirmed', 'not_confirmed', 'no_response')),
  outcome_note text check (outcome_note is null or char_length(outcome_note) <= 500),
  checked_by text,
  checked_at timestamptz
);
create index if not exists expert_references_expert_idx on public.expert_references (expert_id);

alter table public.expert_references enable row level security;
revoke all on public.expert_references from anon, authenticated;
grant select on public.expert_references to authenticated;
drop policy if exists expert_references_admin_read on public.expert_references;
create policy expert_references_admin_read on public.expert_references for select to authenticated using (public.is_admin());
grant select, insert, update, delete on public.expert_references to service_role;

create or replace function public.enforce_reference_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.expert_references r where r.expert_id = new.expert_id) >= 3 then
    raise exception 'reference_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists expert_references_limit on public.expert_references;
create trigger expert_references_limit before insert on public.expert_references
  for each row execute function public.enforce_reference_limit();

-- 3. The expert's references (through the portal function only). No outcome is shown to the expert.
create or replace function public.portal_list_references(p_expert_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'referee_name', r.referee_name, 'organisation', r.organisation, 'relationship', r.relationship)
                            order by r.created_at), '[]'::jsonb)
    from public.expert_references r where r.expert_id = p_expert_id;
$$;

create or replace function public.portal_add_reference(p_expert_id text, p_name text, p_org text, p_rel text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_id uuid;
begin
  select e.verification_status into v_status from public.experts e where e.expert_id = p_expert_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_status not in ('pending', 'more_evidence') then raise exception 'locked' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120
     or char_length(btrim(coalesce(p_org, ''))) not between 2 and 160
     or char_length(btrim(coalesce(p_rel, ''))) not between 2 and 160 then
    raise exception 'bad_value' using errcode = 'P0001';
  end if;
  insert into public.expert_references (expert_id, referee_name, organisation, relationship)
  values (p_expert_id, btrim(regexp_replace(p_name, '[[:cntrl:]]', '', 'g')), btrim(regexp_replace(p_org, '[[:cntrl:]]', '', 'g')),
          btrim(regexp_replace(p_rel, '[[:cntrl:]]', '', 'g')))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.portal_delete_reference(p_expert_id text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select e.verification_status into v_status from public.experts e where e.expert_id = p_expert_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_status not in ('pending', 'more_evidence') then raise exception 'locked' using errcode = 'P0001'; end if;
  delete from public.expert_references where id = p_id and expert_id = p_expert_id;
end;
$$;

-- 4. The completion meter: what is done, and whether the set is complete enough to submit.
create or replace function public.portal_completion(p_expert_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_consent boolean;
  v_consulting boolean;
  v_memberships boolean;
  v_qual boolean;
  v_cred boolean;
  v_role boolean;
  v_ref boolean;
  v_items jsonb;
  v_done int;
begin
  select e.evidence_consent_at is not null, e.consulting_availability is not null into v_consent, v_consulting
    from public.experts e where e.expert_id = p_expert_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  v_memberships := exists (select 1 from public.expert_affiliations a where a.expert_id = p_expert_id);
  v_qual := exists (select 1 from public.expert_files f where f.expert_id = p_expert_id and f.state = 'ready' and f.kind = 'qualification');
  v_cred := exists (select 1 from public.expert_files f where f.expert_id = p_expert_id and f.state = 'ready' and f.kind in ('membership', 'licence'));
  v_role := exists (select 1 from public.expert_files f where f.expert_id = p_expert_id and f.state = 'ready' and f.kind = 'project_role');
  v_ref := exists (select 1 from public.expert_references r where r.expert_id = p_expert_id);
  v_items := jsonb_build_array(
    jsonb_build_object('key', 'registered', 'done', true),
    jsonb_build_object('key', 'consent', 'done', v_consent),
    jsonb_build_object('key', 'consulting', 'done', v_consulting),
    jsonb_build_object('key', 'memberships', 'done', v_memberships),
    jsonb_build_object('key', 'qualification', 'done', v_qual),
    jsonb_build_object('key', 'credential', 'done', v_cred),
    jsonb_build_object('key', 'projectRole', 'done', v_role),
    jsonb_build_object('key', 'reference', 'done', v_ref));
  select count(*) filter (where (x ->> 'done')::boolean) into v_done from jsonb_array_elements(v_items) x;
  return jsonb_build_object(
    'items', v_items,
    'percent', round(100.0 * v_done / jsonb_array_length(v_items)),
    'complete', v_consent and v_qual and v_cred and v_role and v_ref);
end;
$$;

-- 5. Submitting needs the complete set. The move to "Evidence Submitted" (stored as under_review) is automatic, and the
--    administrator is told once, with the minimum: an Expert ID, the expertise and the country. No name, phone or email.
create or replace function public.portal_submit(p_expert_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_email text;
  v_expertise text;
  v_country text;
  v_audit bigint;
  v_admin text;
begin
  select e.verification_status, e.email, e.primary_expertise, e.country into v_status, v_email, v_expertise, v_country
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
  if not coalesce((public.portal_completion(p_expert_id) ->> 'complete')::boolean, false) then
    raise exception 'incomplete' using errcode = 'P0001';
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

  select coalesce(nullif(btrim(max(s.value) filter (where s.key = 'registration_notify_email')), ''),
                  nullif(btrim(max(s.value) filter (where s.key = 'opportunity_notify_email')), ''))
    into v_admin from public.verification_settings s;
  if v_admin is not null then
    insert into public.email_outbox (expert_id, to_email, template, ref, payload)
    values (p_expert_id, v_admin, 'evidence_submitted', v_audit::text,
            jsonb_build_object('primary_expertise', v_expertise, 'country', v_country))
    on conflict do nothing;
  end if;
  return jsonb_build_object('status', 'under_review');
end;
$$;

-- 6. Administrators: see the references and record the outcome of a check. The outcome is logged in the verification log.
create or replace function public.admin_list_references(p_expert_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'referee_name', r.referee_name, 'organisation', r.organisation,
                      'relationship', r.relationship, 'outcome', r.outcome, 'outcome_note', r.outcome_note, 'checked_by', r.checked_by,
                      'checked_at', r.checked_at) order by r.created_at)
                    from public.expert_references r where r.expert_id = p_expert_id), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_reference_outcome(p_id uuid, p_outcome text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_expert text;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_outcome is null or p_outcome not in ('not_checked', 'confirmed', 'not_confirmed', 'no_response') then
    raise exception 'bad_value' using errcode = 'P0001';
  end if;
  update public.expert_references
     set outcome = p_outcome, outcome_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500), checked_by = v_admin, checked_at = now()
   where id = p_id
  returning expert_id into v_expert;
  if v_expert is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.verification_audit (expert_id, actor, actor_type, action, notes)
  values (v_expert, v_admin, 'admin', 'reference_checked', 'Reference outcome: ' || p_outcome);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function
  public.portal_list_references(text), public.portal_add_reference(text, text, text, text), public.portal_delete_reference(text, uuid),
  public.portal_completion(text), public.portal_submit(text)
from public, anon, authenticated;
grant execute on function
  public.portal_list_references(text), public.portal_add_reference(text, text, text, text), public.portal_delete_reference(text, uuid),
  public.portal_completion(text), public.portal_submit(text)
to service_role;

revoke all on function public.admin_list_references(text), public.admin_set_reference_outcome(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_list_references(text), public.admin_set_reference_outcome(uuid, text, text) to authenticated;
