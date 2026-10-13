-- Release 4: opportunities get a country and an experience level, administrators get an explainable list of
-- suggested experts, choose who to invite, and the invited expert answers interested or not interested.
--
-- Additive only: two optional columns on opportunities, one new table, new functions. Nothing existing is changed or removed.
--
-- Privacy rules built into the functions:
--   * only experts who agreed to be listed (discoverable) can be suggested or invited
--   * nothing is ever sent to an expert unless an administrator chooses them, and there is no automatic contact
--   * the shortlist an administrator shares with an opportunity owner shows an expert's email and phone only if that expert
--     ticked the separate "share my contact details" box when answering

-- 1. Optional matching details on an opportunity -------------------------------------------------
alter table public.opportunities
  add column if not exists country text check (country is null or char_length(btrim(country)) between 2 and 80),
  add column if not exists experience_level text
    check (experience_level is null or experience_level in ('Under 5', '5 to 10', '11 to 20', '21 to 30', '30+'));

-- 2. Invitations ---------------------------------------------------------------------------------
create table if not exists public.opportunity_invitations (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  expert_id text not null references public.experts (expert_id) on delete cascade,
  invited_by text not null,
  invited_at timestamptz not null default now(),
  score int not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  response text not null default 'invited' check (response in ('invited', 'interested', 'not_interested')),
  responded_at timestamptz,
  share_contact boolean not null default false,
  unique (opportunity_id, expert_id),
  check (share_contact is false or response = 'interested')
);
create index if not exists opportunity_invitations_expert_idx on public.opportunity_invitations (expert_id);

alter table public.opportunity_invitations enable row level security;
revoke all on public.opportunity_invitations from anon, authenticated;
grant select on public.opportunity_invitations to authenticated;
drop policy if exists opportunity_invitations_admin_read on public.opportunity_invitations;
create policy opportunity_invitations_admin_read on public.opportunity_invitations for select to authenticated using (public.is_admin());

-- 3. Matching details ----------------------------------------------------------------------------
create or replace function public.admin_set_opportunity_matching(p_id uuid, p_country text, p_level text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country text := nullif(btrim(coalesce(p_country, '')), '');
  v_level text := nullif(btrim(coalesce(p_level, '')), '');
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if v_level is not null and v_level not in ('Under 5', '5 to 10', '11 to 20', '21 to 30', '30+') then
    raise exception 'bad_level' using errcode = 'P0001';
  end if;
  if v_country is not null and char_length(v_country) not between 2 and 80 then
    raise exception 'bad_country' using errcode = 'P0001';
  end if;
  update public.opportunities set country = v_country, experience_level = v_level, updated_at = now() where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_get_opportunity_matching(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('country', o.country, 'experience_level', o.experience_level) from public.opportunities o where o.id = p_id);
end;
$$;

-- 4. Suggested experts ---------------------------------------------------------------------------
-- A plain points table, 100 at most, and every point has a written reason:
--   expertise     40  the opportunity's expertise is the expert's primary expertise, or 25 if it is one of their secondary ones
--   country       20  the expert is in the opportunity's country (skipped when the opportunity names no country)
--   experience    15  the expert has at least the experience level asked for, or 5 if they are one band short (skipped when none asked)
--   availability  15  consulting availability "available", or 7 for "limited"
--   verification  10  verified by NEXUS-E review
-- An expert with no matching expertise is not suggested at all.
create or replace function public.admin_match_experts(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_o public.opportunities%rowtype;
  v_bands constant text[] := array['Under 5', '5 to 10', '11 to 20', '21 to 30', '30+'];
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into v_o from public.opportunities o where o.id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'expert_id', s.expert_id, 'title', s.title, 'full_name', s.full_name, 'organisation', s.organisation,
             'country', s.country, 'primary_expertise', s.primary_expertise, 'years_experience', s.years_experience,
             'consulting_availability', s.consulting_availability, 'verification_status', s.verification_status,
             'score', s.score, 'reasons', s.reasons,
             'invitation', (select i.response from public.opportunity_invitations i where i.opportunity_id = p_id and i.expert_id = s.expert_id))
           order by s.score desc, s.expert_id)
      from (
        select e.expert_id, e.title, e.full_name, e.organisation, e.country, e.primary_expertise, e.years_experience,
               e.consulting_availability, e.verification_status,
               (x.pe + x.pc + x.px + x.pa + x.pv) as score,
               (select jsonb_agg(r.reason order by r.ord) from (values
                  (1, case when x.pe = 40 then jsonb_build_object('points', 40, 'text', 'Primary expertise matches: ' || e.primary_expertise)
                           when x.pe = 25 then jsonb_build_object('points', 25, 'text', 'A secondary expertise matches') end),
                  (2, case when x.pc = 20 then jsonb_build_object('points', 20, 'text', 'Based in ' || e.country) end),
                  (3, case when x.px = 15 then jsonb_build_object('points', 15, 'text', 'Experience of ' || e.years_experience || ' years meets the level asked for')
                           when x.px = 5 then jsonb_build_object('points', 5, 'text', 'Experience of ' || e.years_experience || ' years is one band below the level asked for') end),
                  (4, case when x.pa = 15 then jsonb_build_object('points', 15, 'text', 'Available for consulting')
                           when x.pa = 7 then jsonb_build_object('points', 7, 'text', 'Limited availability for consulting') end),
                  (5, case when x.pv = 10 then jsonb_build_object('points', 10, 'text', 'Verified by NEXUS-E review') end)
                ) as r(ord, reason) where r.reason is not null) as reasons
          from public.experts e
          cross join lateral (
            select case when e.primary_expertise = any (v_o.expertise_needed) then 40
                        when e.secondary_expertise && v_o.expertise_needed then 25 else 0 end as pe,
                   case when v_o.country is not null and lower(e.country) = lower(v_o.country) then 20 else 0 end as pc,
                   case when v_o.experience_level is null then 0
                        when array_position(v_bands, e.years_experience) >= array_position(v_bands, v_o.experience_level) then 15
                        when array_position(v_bands, e.years_experience) = array_position(v_bands, v_o.experience_level) - 1 then 5
                        else 0 end as px,
                   case e.consulting_availability when 'available' then 15 when 'limited' then 7 else 0 end as pa,
                   case when e.verification_status = 'verified' then 10 else 0 end as pv
          ) x
         where e.discoverable is true and e.merged_into is null
           and (x.pe > 0)
         order by (x.pe + x.pc + x.px + x.pa + x.pv) desc, e.expert_id
         limit 50
      ) s), '[]'::jsonb);
end;
$$;

-- 5. Invite --------------------------------------------------------------------------------------
create or replace function public.admin_invite_experts(p_id uuid, p_expert_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_o public.opportunities%rowtype;
  v_e public.experts%rowtype;
  v_id text;
  v_invited int := 0;
  v_skipped int := 0;
  v_score jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into v_o from public.opportunities o where o.id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_o.status <> 'open' or v_o.deadline < public.nigeria_today() then raise exception 'not_open' using errcode = 'P0001'; end if;
  if p_expert_ids is null or cardinality(p_expert_ids) = 0 or cardinality(p_expert_ids) > 50 then
    raise exception 'bad_selection' using errcode = 'P0001';
  end if;

  select (public.admin_match_experts(p_id)) into v_score;

  foreach v_id in array p_expert_ids loop
    select * into v_e from public.experts e where e.expert_id = v_id;
    -- Only experts who agreed to be listed can be invited.
    if not found or v_e.discoverable is not true or v_e.merged_into is not null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.opportunity_invitations (opportunity_id, expert_id, invited_by, score, reasons)
    select p_id, v_id, v_admin, coalesce((m ->> 'score')::int, 0), coalesce(m -> 'reasons', '[]'::jsonb)
      from (select m from jsonb_array_elements(v_score) m where m ->> 'expert_id' = v_id limit 1) q
    on conflict (opportunity_id, expert_id) do nothing;
    if found then
      v_invited := v_invited + 1;
      insert into public.email_outbox (expert_id, to_email, template, ref, payload)
      values (v_id, v_e.email, 'opportunity_invitation', p_id::text,
              jsonb_build_object('opportunity_id', p_id, 'opportunity_title', v_o.title, 'deadline', v_o.deadline))
      on conflict do nothing;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  return jsonb_build_object('invited', v_invited, 'skipped', v_skipped);
end;
$$;

-- 6. What each invited expert answered, and the shortlist that may be shared -------------------------
create or replace function public.admin_opportunity_invitations(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'expert_id', i.expert_id, 'full_name', e.full_name, 'title', e.title, 'organisation', e.organisation,
             'country', e.country, 'primary_expertise', e.primary_expertise, 'verification_status', e.verification_status,
             'response', i.response, 'invited_at', i.invited_at, 'responded_at', i.responded_at,
             'share_contact', i.share_contact, 'score', i.score, 'invited_by', i.invited_by,
             -- Contact details appear only when the expert agreed to share them.
             'email', case when i.share_contact then e.email end,
             'phone', case when i.share_contact then e.phone end)
           order by i.invited_at desc)
      from public.opportunity_invitations i
      join public.experts e on e.expert_id = i.expert_id
     where i.opportunity_id = p_id), '[]'::jsonb);
end;
$$;

-- 7. Expert side (service role only, called by the expert-portal function) --------------------------
create or replace function public.portal_list_invitations(p_expert_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'opportunity_id', o.id, 'title', o.title, 'description', o.description, 'opp_type', o.opp_type,
             'location', o.location, 'country', o.country, 'deadline', o.deadline,
             'expertise_needed', o.expertise_needed, 'experience_level', o.experience_level,
             'response', i.response, 'share_contact', i.share_contact,
             'open', (o.status = 'open' and o.deadline >= public.nigeria_today()))
           order by i.invited_at desc)
      from public.opportunity_invitations i
      join public.opportunities o on o.id = i.opportunity_id
     where i.expert_id = p_expert_id), '[]'::jsonb);
end;
$$;

create or replace function public.portal_respond_invitation(p_expert_id text, p_opportunity_id uuid, p_response text, p_share_contact boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.opportunity_invitations%rowtype;
  v_o public.opportunities%rowtype;
  v_notify text;
begin
  if p_response not in ('interested', 'not_interested') then raise exception 'bad_value' using errcode = 'P0001'; end if;
  select * into v_i from public.opportunity_invitations i where i.opportunity_id = p_opportunity_id and i.expert_id = p_expert_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into v_o from public.opportunities o where o.id = p_opportunity_id;
  if v_o.status <> 'open' or v_o.deadline < public.nigeria_today() then raise exception 'not_open' using errcode = 'P0001'; end if;

  update public.opportunity_invitations
     set response = p_response, responded_at = now(),
         share_contact = (p_response = 'interested' and p_share_contact is true)
   where id = v_i.id;

  -- Tell the administrator once per expert and opportunity, with the same email that expressing interest sends.
  if p_response = 'interested' and v_i.response <> 'interested' then
    select s.value into v_notify from public.verification_settings s where s.key = 'opportunity_notify_email';
    if nullif(btrim(coalesce(v_notify, '')), '') is not null then
      insert into public.email_outbox (expert_id, to_email, template, ref, payload)
      values (p_expert_id, btrim(v_notify), 'opportunity_interest', p_opportunity_id::text,
              jsonb_build_object('opportunity_id', p_opportunity_id, 'opportunity_title', v_o.title))
      on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('response', p_response, 'share_contact', p_response = 'interested' and p_share_contact is true);
end;
$$;

-- 8. Permissions ---------------------------------------------------------------------------------
revoke all on function
  public.admin_set_opportunity_matching(uuid, text, text),
  public.admin_get_opportunity_matching(uuid),
  public.admin_match_experts(uuid),
  public.admin_invite_experts(uuid, text[]),
  public.admin_opportunity_invitations(uuid),
  public.portal_list_invitations(text),
  public.portal_respond_invitation(text, uuid, text, boolean)
from public, anon, authenticated;

grant execute on function
  public.admin_set_opportunity_matching(uuid, text, text),
  public.admin_get_opportunity_matching(uuid),
  public.admin_match_experts(uuid),
  public.admin_invite_experts(uuid, text[]),
  public.admin_opportunity_invitations(uuid)
to authenticated;

grant execute on function
  public.portal_list_invitations(text),
  public.portal_respond_invitation(text, uuid, text, boolean)
to service_role;
