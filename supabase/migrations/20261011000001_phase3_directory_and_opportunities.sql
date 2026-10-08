-- Phase 3: searchable directory and project opportunities. Additive only: nothing existing is changed or removed.
--
-- Access model (same as Phase 2):
--   * The public reaches the directory only through two functions that return a fixed list of public fields
--     for experts who are Verified AND chose to be discoverable. Anonymous users still have no access to any table.
--   * Experts use the expert-portal Edge Function (service role), which checks the session on every call.
--   * Admins use their normal login plus the public.admins allow-list, checked inside every admin function.

-- 1. Directory ----------------------------------------------------------------------------------
alter table public.experts add column if not exists discoverable_updated_at timestamptz;

-- Keeps the public search quick: only listed experts are in this index.
create index if not exists experts_listed_name_idx
  on public.experts (lower(full_name))
  where verification_status = 'verified' and discoverable is true;

create or replace function public.directory_search(
  p_q text default null,
  p_expertise text default null,
  p_state text default null,
  p_qualification text default null,
  p_years text default null,
  p_membership text default null,
  p_assignment text default null,
  p_availability text default null,
  p_sort text default 'name',
  p_limit int default 12,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := left(nullif(btrim(coalesce(p_q, '')), ''), 80);
  v_like text;
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_total int;
  v_items jsonb;
begin
  if v_q is not null then
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with listed as (
    select e.*,
           case when p_sort = 'experience' then
             case e.years_experience when '30+' then 5 when '21 to 30' then 4 when '11 to 20' then 3 when '5 to 10' then 2 else 1 end
           end as k1,
           case when p_sort = 'newest' then e.verified_at end as k2
      from public.experts e
     where e.verification_status = 'verified'
       and e.discoverable is true
       and (v_like is null
            or e.full_name ilike v_like
            or e.organisation ilike v_like
            or e.position ilike v_like
            or e.primary_expertise ilike v_like
            or array_to_string(e.secondary_expertise, ' | ') ilike v_like)
       and (nullif(p_expertise, '') is null or e.primary_expertise = p_expertise or p_expertise = any (e.secondary_expertise))
       and (nullif(p_state, '') is null or e.state = p_state)
       and (nullif(p_qualification, '') is null or e.qualification = p_qualification)
       and (nullif(p_years, '') is null or e.years_experience = p_years)
       and (nullif(p_membership, '') is null or p_membership = any (e.memberships))
       and (nullif(p_assignment, '') is null or p_assignment = any (e.assignments))
       and (nullif(p_availability, '') is null or e.availability = p_availability)
  ),
  ranked as (
    select l.*,
           row_number() over (order by l.k1 desc nulls last, l.k2 desc nulls last, lower(l.full_name), l.expert_id) as rn
      from listed l
  )
  select (select count(*) from listed),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'expert_id', r.expert_id,
                    'title', r.title,
                    'full_name', r.full_name,
                    'position', r.position,
                    'organisation', r.organisation,
                    'state', r.state,
                    'primary_expertise', r.primary_expertise,
                    'years_experience', r.years_experience,
                    'qualification', r.qualification) order by r.rn)
             from ranked r
            where r.rn > v_offset and r.rn <= v_offset + v_limit
         ), '[]'::jsonb)
    into v_total, v_items;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

-- One listed expert, or null. Not listed, not verified and not discoverable all look exactly the same: nothing.
create or replace function public.directory_profile(p_expert_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'expert_id', e.expert_id,
           'title', e.title,
           'full_name', e.full_name,
           'position', e.position,
           'organisation', e.organisation,
           'state', e.state,
           'primary_expertise', e.primary_expertise,
           'secondary_expertise', e.secondary_expertise,
           'years_experience', e.years_experience,
           'qualification', e.qualification,
           'memberships', e.memberships,
           'assignments', e.assignments,
           'availability', e.availability,
           'profile_url', e.profile_url,
           'verified_at', e.verified_at)
    from public.experts e
   where e.expert_id = p_expert_id
     and e.verification_status = 'verified'
     and e.discoverable is true;
$$;

revoke all on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int) from public;
revoke all on function public.directory_profile(text) from public;
grant execute on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int) to anon, authenticated;
grant execute on function public.directory_profile(text) to anon, authenticated;

-- An expert turns listing on or off. Called only by the expert-portal function, for the signed in expert.
create or replace function public.portal_set_discoverable(p_expert_id text, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old boolean;
  v_status text;
begin
  select e.discoverable, e.verification_status into v_old, v_status
    from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_value is null then
    raise exception 'bad_value' using errcode = 'P0001';
  end if;
  if v_old is distinct from p_value then
    update public.experts set discoverable = p_value, discoverable_updated_at = now() where expert_id = p_expert_id;
    insert into public.verification_audit (expert_id, actor, actor_type, action, old_status, new_status, reason)
    values (p_expert_id, p_expert_id, 'expert',
            case when p_value then 'discoverable_on' else 'discoverable_off' end,
            v_status, v_status,
            case when p_value then 'The expert chose to be listed in the public directory.'
                 else 'The expert chose to be removed from the public directory.' end);
  end if;
  return jsonb_build_object('discoverable', p_value);
end;
$$;

revoke all on function public.portal_set_discoverable(text, boolean) from public, anon, authenticated;
grant execute on function public.portal_set_discoverable(text, boolean) to service_role;

-- 2. Opportunities -----------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  opp_type text not null check (opp_type in (
    'Consulting', 'ESIA/EIA', 'Environmental and Social Safeguards', 'Technical Expert Panels', 'Field Surveys',
    'Research', 'Government Projects', 'World Bank/AfDB/DFI Projects', 'Oil and Gas', 'Infrastructure',
    'Training', 'Expert Review', 'Short-term international assignments')),
  expertise_needed text[] not null check (
    cardinality(expertise_needed) between 1 and 15
    and expertise_needed <@ array[
      'ESIA and Safeguards', 'Biodiversity and Ecosystems', 'Water and Hydrogeology', 'Geology and Earth Sciences',
      'Climate Change and Carbon', 'Social and Economic Studies', 'Gender and Inclusion',
      'Pollution and Environmental Quality', 'GIS and Remote Sensing', 'Marine and Blue Economy',
      'Environmental Engineering', 'Policy, Governance and Regulation', 'ESG and Sustainability',
      'Occupational and Community Health', 'Other Specialised Expertise']),
  location text not null check (char_length(btrim(location)) between 2 and 120),
  deadline date not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz
);
create index opportunities_status_idx on public.opportunities (status, deadline);

create table public.opportunity_interest (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  expert_id text not null references public.experts (expert_id) on delete cascade,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (opportunity_id, expert_id)
);
create index opportunity_interest_expert_idx on public.opportunity_interest (expert_id);

-- Append only, and no foreign key on purpose: the record survives when an opportunity is deleted.
create table public.opportunity_audit (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null,
  opportunity_title text,
  actor text not null,
  action text not null check (action in ('created', 'updated', 'published', 'closed', 'reopened', 'set_to_draft', 'deleted')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index opportunity_audit_opp_idx on public.opportunity_audit (opportunity_id, created_at desc);

create or replace function public.block_opportunity_audit_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The opportunity log cannot be changed' using errcode = 'P0001';
end;
$$;

create trigger opportunity_audit_no_change
  before update or delete on public.opportunity_audit
  for each row execute function public.block_opportunity_audit_changes();
create trigger opportunity_audit_no_truncate
  before truncate on public.opportunity_audit
  for each statement execute function public.block_opportunity_audit_changes();

alter table public.opportunities enable row level security;
alter table public.opportunity_interest enable row level security;
alter table public.opportunity_audit enable row level security;
revoke all on public.opportunities, public.opportunity_interest, public.opportunity_audit from anon, authenticated;

-- Admins can read the log. Everything else goes through the functions below.
grant select on public.opportunity_audit to authenticated;
create policy opportunity_audit_admin_read on public.opportunity_audit for select to authenticated using (public.is_admin());

-- Today in Nigeria. An opportunity stays open through the whole of its deadline day.
create or replace function public.nigeria_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Africa/Lagos')::date $$;

-- Where interest notifications go. Starts as the contact address and can be changed in the settings table.
insert into public.verification_settings (key, value, description)
select 'opportunity_notify_email', s.value, 'Admin address that is emailed when an expert expresses interest in an opportunity.'
  from public.verification_settings s
 where s.key = 'contact_email'
on conflict (key) do nothing;

-- 3. Admin functions --------------------------------------------------------------------------
create or replace function public.admin_save_opportunity(p_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_desc text := btrim(coalesce(p_payload ->> 'description', ''));
  v_type text := btrim(coalesce(p_payload ->> 'opp_type', ''));
  v_loc text := btrim(coalesce(p_payload ->> 'location', ''));
  v_status text := coalesce(nullif(p_payload ->> 'status', ''), 'draft');
  v_deadline date;
  v_needed text[];
  v_old public.opportunities%rowtype;
  v_id uuid;
  v_action text;
  v_changed text[] := '{}';
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  if char_length(v_title) < 3 or char_length(v_title) > 140 then raise exception 'bad_title' using errcode = 'P0001'; end if;
  if char_length(v_desc) < 10 or char_length(v_desc) > 4000 then raise exception 'bad_description' using errcode = 'P0001'; end if;
  if char_length(v_loc) < 2 or char_length(v_loc) > 120 then raise exception 'bad_location' using errcode = 'P0001'; end if;
  if v_status not in ('draft', 'open', 'closed') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  begin
    v_deadline := (p_payload ->> 'deadline')::date;
  exception when others then
    raise exception 'bad_deadline' using errcode = 'P0001';
  end;
  if v_deadline is null then raise exception 'bad_deadline' using errcode = 'P0001'; end if;
  if v_status = 'open' and v_deadline < public.nigeria_today() then
    raise exception 'deadline_passed' using errcode = 'P0001';
  end if;
  v_needed := coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'expertise_needed', '[]'::jsonb))), '{}');
  if cardinality(v_needed) < 1 then raise exception 'bad_expertise' using errcode = 'P0001'; end if;

  if p_id is null then
    begin
      insert into public.opportunities (title, description, opp_type, expertise_needed, location, deadline, status, created_by, published_at, closed_at)
      values (v_title, v_desc, v_type, v_needed, v_loc, v_deadline, v_status, v_admin,
              case when v_status = 'open' then now() end, case when v_status = 'closed' then now() end)
      returning id into v_id;
    exception when check_violation then
      raise exception 'invalid' using errcode = 'P0001';
    end;
    insert into public.opportunity_audit (opportunity_id, opportunity_title, actor, action, detail)
    values (v_id, v_title, v_admin, 'created', jsonb_build_object('status', v_status));
    if v_status = 'open' then
      insert into public.opportunity_audit (opportunity_id, opportunity_title, actor, action, detail)
      values (v_id, v_title, v_admin, 'published', '{}'::jsonb);
    end if;
    return jsonb_build_object('ok', true, 'id', v_id);
  end if;

  select * into v_old from public.opportunities o where o.id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  if v_old.title is distinct from v_title then v_changed := array_append(v_changed, 'title'); end if;
  if v_old.description is distinct from v_desc then v_changed := array_append(v_changed, 'description'); end if;
  if v_old.opp_type is distinct from v_type then v_changed := array_append(v_changed, 'type'); end if;
  if v_old.expertise_needed is distinct from v_needed then v_changed := array_append(v_changed, 'expertise_needed'); end if;
  if v_old.location is distinct from v_loc then v_changed := array_append(v_changed, 'location'); end if;
  if v_old.deadline is distinct from v_deadline then v_changed := array_append(v_changed, 'deadline'); end if;

  begin
    update public.opportunities
       set title = v_title, description = v_desc, opp_type = v_type, expertise_needed = v_needed,
           location = v_loc, deadline = v_deadline, status = v_status, updated_at = now(),
           published_at = case when v_status = 'open' and v_old.status <> 'open' then now() else published_at end,
           closed_at = case when v_status = 'closed' and v_old.status <> 'closed' then now()
                            when v_status <> 'closed' then null else closed_at end
     where id = p_id;
  exception when check_violation then
    raise exception 'invalid' using errcode = 'P0001';
  end;

  if v_old.status <> v_status then
    v_action := case v_status when 'open' then (case when v_old.status = 'closed' then 'reopened' else 'published' end)
                              when 'closed' then 'closed' else 'set_to_draft' end;
    insert into public.opportunity_audit (opportunity_id, opportunity_title, actor, action, detail)
    values (p_id, v_title, v_admin, v_action, jsonb_build_object('from', v_old.status, 'to', v_status, 'also_changed', to_jsonb(v_changed)));
  elsif cardinality(v_changed) > 0 then
    insert into public.opportunity_audit (opportunity_id, opportunity_title, actor, action, detail)
    values (p_id, v_title, v_admin, 'updated', jsonb_build_object('changed', to_jsonb(v_changed)));
  end if;
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function public.admin_delete_opportunity(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_title text;
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select o.title into v_title from public.opportunities o where o.id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select count(*) into v_n from public.opportunity_interest i where i.opportunity_id = p_id and i.withdrawn_at is null;
  insert into public.opportunity_audit (opportunity_id, opportunity_title, actor, action, detail)
  values (p_id, v_title, v_admin, 'deleted', jsonb_build_object('interested_experts', v_n));
  delete from public.opportunities where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_list_opportunities()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'title', o.title, 'description', o.description, 'opp_type', o.opp_type,
             'expertise_needed', o.expertise_needed, 'location', o.location, 'deadline', o.deadline,
             'status', o.status, 'expired', (o.status = 'open' and o.deadline < public.nigeria_today()),
             'created_at', o.created_at, 'updated_at', o.updated_at,
             'interested', (select count(*) from public.opportunity_interest i where i.opportunity_id = o.id and i.withdrawn_at is null))
           order by o.created_at desc)
      from public.opportunities o), '[]'::jsonb);
end;
$$;

-- Everyone who currently has their hand up for one opportunity, with the details they registered.
create or replace function public.admin_opportunity_interest(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'expert_id', e.expert_id, 'title', e.title, 'full_name', e.full_name, 'organisation', e.organisation,
             'position', e.position, 'state', e.state, 'email', e.email, 'phone', e.phone,
             'primary_expertise', e.primary_expertise, 'secondary_expertise', e.secondary_expertise,
             'years_experience', e.years_experience, 'qualification', e.qualification, 'memberships', e.memberships,
             'assignments', e.assignments, 'availability', e.availability, 'profile_url', e.profile_url,
             'verification_status', e.verification_status, 'interested_at', i.created_at)
           order by i.created_at)
      from public.opportunity_interest i
      join public.experts e on e.expert_id = i.expert_id
     where i.opportunity_id = p_id and i.withdrawn_at is null), '[]'::jsonb);
end;
$$;

create or replace function public.admin_opportunity_log(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('actor', a.actor, 'action', a.action, 'detail', a.detail, 'created_at', a.created_at)
                     order by a.created_at desc)
      from public.opportunity_audit a where a.opportunity_id = p_id), '[]'::jsonb);
end;
$$;

-- 4. Expert functions (service role only, called by the expert-portal function) -------------------
-- Open opportunities, matching ones first. A match is a plain comparison of registered fields:
-- the opportunity needs an expertise the expert has (primary or secondary), or its type is an assignment they offered.
create or replace function public.portal_list_opportunities(p_expert_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e public.experts%rowtype;
begin
  select * into v_e from public.experts e where e.expert_id = p_expert_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'verified', v_e.verification_status = 'verified',
    'items', coalesce((
      select jsonb_agg(t.item order by t.matches desc, t.deadline asc, t.created_at desc)
        from (
          select o.deadline, o.created_at,
                 (o.expertise_needed && (array[v_e.primary_expertise] || v_e.secondary_expertise)
                  or o.opp_type = any (v_e.assignments)) as matches,
                 jsonb_build_object(
                   'id', o.id, 'title', o.title, 'description', o.description, 'opp_type', o.opp_type,
                   'expertise_needed', o.expertise_needed, 'location', o.location, 'deadline', o.deadline,
                   'matches', (o.expertise_needed && (array[v_e.primary_expertise] || v_e.secondary_expertise)
                               or o.opp_type = any (v_e.assignments)),
                   'interested', exists (select 1 from public.opportunity_interest i
                                          where i.opportunity_id = o.id and i.expert_id = p_expert_id and i.withdrawn_at is null)) as item
            from public.opportunities o
           where o.status = 'open' and o.deadline >= public.nigeria_today()
        ) t), '[]'::jsonb));
end;
$$;

create or replace function public.portal_set_interest(p_expert_id text, p_opportunity_id uuid, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_opp public.opportunities%rowtype;
  v_row public.opportunity_interest%rowtype;
  v_notify text;
begin
  select e.verification_status into v_status from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into v_opp from public.opportunities o where o.id = p_opportunity_id;

  if p_on is not true then
    -- Withdrawing is always allowed.
    update public.opportunity_interest set withdrawn_at = now()
     where opportunity_id = p_opportunity_id and expert_id = p_expert_id and withdrawn_at is null;
    return jsonb_build_object('interested', false);
  end if;

  if v_status <> 'verified' then
    raise exception 'not_verified' using errcode = 'P0001';
  end if;
  if v_opp.id is null or v_opp.status <> 'open' or v_opp.deadline < public.nigeria_today() then
    raise exception 'not_open' using errcode = 'P0001';
  end if;

  select * into v_row from public.opportunity_interest i
   where i.opportunity_id = p_opportunity_id and i.expert_id = p_expert_id;
  if found then
    update public.opportunity_interest set withdrawn_at = null where id = v_row.id;
  else
    insert into public.opportunity_interest (opportunity_id, expert_id) values (p_opportunity_id, p_expert_id);
  end if;

  -- Tell the admin once per expert and opportunity, so switching interest off and on cannot flood anyone.
  select s.value into v_notify from public.verification_settings s where s.key = 'opportunity_notify_email';
  if nullif(btrim(coalesce(v_notify, '')), '') is not null then
    insert into public.email_outbox (expert_id, to_email, template, ref, payload)
    values (p_expert_id, btrim(v_notify), 'opportunity_interest', p_opportunity_id::text,
            jsonb_build_object('opportunity_id', p_opportunity_id, 'opportunity_title', v_opp.title))
    on conflict do nothing;
  end if;
  return jsonb_build_object('interested', true);
end;
$$;

-- 5. Permissions ---------------------------------------------------------------------------------
revoke all on function
  public.portal_list_opportunities(text),
  public.portal_set_interest(text, uuid, boolean),
  public.admin_save_opportunity(uuid, jsonb),
  public.admin_delete_opportunity(uuid),
  public.admin_list_opportunities(),
  public.admin_opportunity_interest(uuid),
  public.admin_opportunity_log(uuid),
  public.block_opportunity_audit_changes(),
  public.nigeria_today()
from public, anon, authenticated;

grant execute on function public.portal_list_opportunities(text), public.portal_set_interest(text, uuid, boolean) to service_role;
grant execute on function
  public.admin_save_opportunity(uuid, jsonb),
  public.admin_delete_opportunity(uuid),
  public.admin_list_opportunities(),
  public.admin_opportunity_interest(uuid),
  public.admin_opportunity_log(uuid)
to authenticated;
