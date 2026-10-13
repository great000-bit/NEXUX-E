-- Release 3 (Phase 3): the administrator's verification workflow. Additive. Nothing here changes an existing registration row.
--
--   * a checklist of the four criteria verification rests on (qualifications, professional credentials, documented project
--     roles, references), with notes. "Approve" is refused by the database until all four are ticked. Choosing a professional
--     body or an NGO never ticks anything: those are self-declared and are not a criterion;
--   * duplicates: a function that finds likely duplicates (same name, similar name in the same country, same email name) and
--     a safe merge that moves the records, flags the duplicate (it is not deleted) and writes a log that cannot be edited;
--   * statistics by verification status, with geography and specialisation.
--
-- Status changes: only administrators (is_admin(), checked inside the functions) can set a verification status, through
-- admin_review_expert, which writes the audit log. An expert's own submit only moves Registered to Evidence Submitted
-- (portal_submit, server side). The public and signed-in roles have no UPDATE right on experts and no update policy.

alter table public.experts add column if not exists merged_into text;

-- 1. The checklist -------------------------------------------------------------------------------------------
create table if not exists public.verification_checklists (
  expert_id text primary key references public.experts (expert_id) on delete cascade,
  qualifications_ok boolean not null default false,
  credentials_ok boolean not null default false,
  project_roles_ok boolean not null default false,
  references_ok boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.verification_checklists enable row level security;
revoke all on public.verification_checklists from anon, authenticated;
grant select on public.verification_checklists to authenticated;
drop policy if exists verification_checklists_admin_read on public.verification_checklists;
create policy verification_checklists_admin_read on public.verification_checklists for select to authenticated using (public.is_admin());

create or replace function public.admin_get_checklist(p_expert_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((select to_jsonb(c) from public.verification_checklists c where c.expert_id = p_expert_id),
    jsonb_build_object('expert_id', p_expert_id, 'qualifications_ok', false, 'credentials_ok', false, 'project_roles_ok', false,
                       'references_ok', false, 'notes', null));
end;
$$;

create or replace function public.admin_save_checklist(p_expert_id text, p_q boolean, p_c boolean, p_p boolean, p_r boolean, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if not exists (select 1 from public.experts e where e.expert_id = p_expert_id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.verification_checklists (expert_id, qualifications_ok, credentials_ok, project_roles_ok, references_ok, notes, updated_by, updated_at)
  values (p_expert_id, coalesce(p_q, false), coalesce(p_c, false), coalesce(p_p, false), coalesce(p_r, false),
          left(nullif(btrim(coalesce(p_notes, '')), ''), 2000), v_admin, now())
  on conflict (expert_id) do update
    set qualifications_ok = excluded.qualifications_ok, credentials_ok = excluded.credentials_ok,
        project_roles_ok = excluded.project_roles_ok, references_ok = excluded.references_ok,
        notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now();
  insert into public.verification_audit (expert_id, actor, actor_type, action, notes)
  values (p_expert_id, v_admin, 'admin', 'checklist_saved',
          format('qualifications=%s credentials=%s project_roles=%s references=%s', p_q, p_c, p_p, p_r));
  return jsonb_build_object('ok', true);
end;
$$;

-- 2. The decision: the same function as before, and approving now needs the whole checklist ---------------------
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
    -- Verification rests on four things, all checked by a person. Nothing else (a membership picked, an NGO named) counts.
    if not exists (
      select 1 from public.verification_checklists c
       where c.expert_id = p_expert_id and c.qualifications_ok and c.credentials_ok and c.project_roles_ok and c.references_ok
    ) then
      raise exception 'checklist_incomplete' using errcode = 'P0001';
    end if;
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

-- 3. Duplicates ----------------------------------------------------------------------------------------------------
create table if not exists public.expert_merge_log (
  id bigint generated always as identity primary key,
  kept text not null,
  dropped text not null,
  actor text not null,
  note text,
  moved jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.expert_merge_log enable row level security;
revoke all on public.expert_merge_log from anon, authenticated;
grant select on public.expert_merge_log to authenticated;
drop policy if exists expert_merge_log_admin_read on public.expert_merge_log;
create policy expert_merge_log_admin_read on public.expert_merge_log for select to authenticated using (public.is_admin());

drop trigger if exists expert_merge_log_no_change on public.expert_merge_log;
create trigger expert_merge_log_no_change before update or delete on public.expert_merge_log
  for each row execute function public.block_audit_changes();

-- Likely duplicates, with the reasons. Compares every pair, which is fine for a registry of this size (thousands).
create or replace function public.admin_find_duplicates()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.score desc, t.a_id)
      from (
        select a.expert_id as a_id, b.expert_id as b_id,
               a.full_name as a_name, b.full_name as b_name,
               a.organisation as a_org, b.organisation as b_org,
               a.country as a_country, b.country as b_country,
               a.verification_status as a_status, b.verification_status as b_status,
               array_remove(array[
                 case when lower(btrim(a.full_name)) = lower(btrim(b.full_name)) then 'same name' end,
                 case when lower(btrim(a.full_name)) <> lower(btrim(b.full_name)) and a.country = b.country
                           and extensions.similarity(lower(a.full_name), lower(b.full_name)) >= 0.8 then 'similar name' end,
                 case when a.phone is not null and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') then 'same phone' end,
                 case when lower(split_part(a.email, '@', 1)) = lower(split_part(b.email, '@', 1)) and length(split_part(a.email, '@', 1)) >= 5 then 'same email name' end
               ], null) as reasons,
               (case when lower(btrim(a.full_name)) = lower(btrim(b.full_name)) then 3 else 0 end
                + case when a.phone is not null and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') then 4 else 0 end
                + case when lower(split_part(a.email, '@', 1)) = lower(split_part(b.email, '@', 1)) and length(split_part(a.email, '@', 1)) >= 5 then 2 else 0 end
                + case when a.country = b.country and extensions.similarity(lower(a.full_name), lower(b.full_name)) >= 0.8 then 1 else 0 end) as score
          from public.experts a
          join public.experts b on a.expert_id < b.expert_id
         where a.merged_into is null and b.merged_into is null
           and (lower(btrim(a.full_name)) = lower(btrim(b.full_name))
                or (a.country = b.country and extensions.similarity(lower(a.full_name), lower(b.full_name)) >= 0.8)
                or (a.phone is not null and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(coalesce(b.phone, ''), '\D', '', 'g'))
                or (lower(split_part(a.email, '@', 1)) = lower(split_part(b.email, '@', 1)) and length(split_part(a.email, '@', 1)) >= 5))
         limit 200
      ) t), '[]'::jsonb);
end;
$$;

-- A safe merge. The duplicate is not deleted: its records move to the one that stays, it is hidden from the directory and
-- flagged with merged_into, its sign-in sessions end, and everything is logged. Nothing is lost, and the log can be read back.
create or replace function public.admin_merge_experts(p_keep text, p_drop text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_keep public.experts%rowtype;
  v_drop public.experts%rowtype;
  v_aff int := 0; v_refs int := 0; v_files int := 0; v_int int := 0; v_room int;
  v_phone text;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_keep is null or p_drop is null or p_keep = p_drop then raise exception 'bad_merge' using errcode = 'P0001'; end if;
  select * into v_keep from public.experts where expert_id = p_keep for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into v_drop from public.experts where expert_id = p_drop for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_keep.merged_into is not null or v_drop.merged_into is not null then raise exception 'already_merged' using errcode = 'P0001'; end if;

  -- Memberships and affiliations (an institution both named stays on the expert who stays).
  update public.expert_affiliations set expert_id = p_keep
   where expert_id = p_drop and institution_id not in (select institution_id from public.expert_affiliations where expert_id = p_keep);
  get diagnostics v_aff = row_count;
  delete from public.expert_affiliations where expert_id = p_drop;

  -- References, up to the limit of three. Any left over stay on the duplicate record, which is kept.
  v_room := greatest(0, 3 - (select count(*) from public.expert_references where expert_id = p_keep));
  update public.expert_references set expert_id = p_keep
   where id in (select id from public.expert_references where expert_id = p_drop order by created_at limit v_room);
  get diagnostics v_refs = row_count;

  -- Evidence files and interest in opportunities.
  update public.expert_files set expert_id = p_keep where expert_id = p_drop and state <> 'deleted';
  get diagnostics v_files = row_count;
  update public.opportunity_interest set expert_id = p_keep
   where expert_id = p_drop and opportunity_id not in (select opportunity_id from public.opportunity_interest where expert_id = p_keep);
  get diagnostics v_int = row_count;

  -- Fill what the kept record lacks (the phone number is unique, so it is released from the duplicate first).
  v_phone := v_drop.phone;
  if v_keep.phone is null and v_phone is not null then
    update public.experts set phone = null where expert_id = p_drop;
    update public.experts set phone = v_phone where expert_id = p_keep;
  end if;
  update public.experts set profile_url = coalesce(profile_url, v_drop.profile_url),
                            consulting_availability = coalesce(consulting_availability, v_drop.consulting_availability)
   where expert_id = p_keep;

  update public.expert_sessions set revoked_at = now() where expert_id = p_drop and revoked_at is null;
  update public.experts set merged_into = p_keep, discoverable = false where expert_id = p_drop;

  insert into public.expert_merge_log (kept, dropped, actor, note, moved)
  values (p_keep, p_drop, v_admin, left(nullif(btrim(coalesce(p_note, '')), ''), 500),
          jsonb_build_object('affiliations', v_aff, 'references', v_refs, 'files', v_files, 'interest', v_int));
  insert into public.verification_audit (expert_id, actor, actor_type, action, notes)
  values (p_keep, v_admin, 'admin', 'merged_from', 'Merged duplicate ' || p_drop),
         (p_drop, v_admin, 'admin', 'merged_into', 'Merged into ' || p_keep);
  return jsonb_build_object('ok', true, 'moved', jsonb_build_object('affiliations', v_aff, 'references', v_refs, 'files', v_files, 'interest', v_int));
end;
$$;

create or replace function public.admin_merge_log()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.id desc) from (select * from public.expert_merge_log order by id desc limit 100) l), '[]'::jsonb);
end;
$$;

-- 4. Statistics by verification status, with geography and specialisation -------------------------------------------------
create or replace function public.admin_verification_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'by_status', coalesce((select jsonb_agg(jsonb_build_object('name', t.s, 'count', t.n) order by t.n desc) from
        (select e.verification_status s, count(*) n from public.experts e where e.merged_into is null group by 1) t), '[]'::jsonb),
    'by_country', coalesce((select jsonb_agg(jsonb_build_object('name', t.c, 'status', t.s, 'count', t.n) order by t.c, t.s) from
        (select e.country c, e.verification_status s, count(*) n from public.experts e where e.merged_into is null group by 1, 2) t), '[]'::jsonb),
    'by_specialisation', coalesce((select jsonb_agg(jsonb_build_object('name', t.x, 'status', t.s, 'count', t.n) order by t.x, t.s) from
        (select e.primary_expertise x, e.verification_status s, count(*) n from public.experts e where e.merged_into is null group by 1, 2) t), '[]'::jsonb));
end;
$$;

revoke all on function
  public.admin_get_checklist(text), public.admin_save_checklist(text, boolean, boolean, boolean, boolean, text),
  public.admin_find_duplicates(), public.admin_merge_experts(text, text, text), public.admin_merge_log(), public.admin_verification_stats()
from public, anon, authenticated;
grant execute on function
  public.admin_get_checklist(text), public.admin_save_checklist(text, boolean, boolean, boolean, boolean, text),
  public.admin_find_duplicates(), public.admin_merge_experts(text, text, text), public.admin_merge_log(), public.admin_verification_stats()
to authenticated;

revoke all on function public.admin_review_expert(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_expert(text, text, text, text) to authenticated;
