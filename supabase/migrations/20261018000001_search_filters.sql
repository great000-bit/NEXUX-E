-- Release 1 (Phase 2): expert search. Additive and backwards compatible.
--
--   * consulting availability (available, limited, not available): a new optional column an expert sets after registering;
--   * faster search: trigram indexes for the search words and partial indexes for the filters, over listed experts only;
--   * directory_search gains three filters (consulting availability, professional body, NGO) at the end of its argument list,
--     so every older call (which names fewer arguments) keeps working;
--   * the database itself, not only the interface, refuses to show anyone who is not Verified and discoverable:
--     row level security on public.experts now has a public policy for exactly those experts, and the public role may read
--     only the public columns. Contact details, membership numbers and evidence are not in that list and never were public.
--
-- Nothing here changes an existing registration row.

alter table public.experts
  add column if not exists consulting_availability text
  check (consulting_availability is null or consulting_availability in ('available', 'limited', 'not_available'));

create extension if not exists pg_trgm with schema extensions;

create index if not exists experts_listed_name_trgm on public.experts using gin (full_name extensions.gin_trgm_ops)
  where verification_status = 'verified' and discoverable is true;
create index if not exists experts_listed_org_trgm on public.experts using gin (organisation extensions.gin_trgm_ops)
  where verification_status = 'verified' and discoverable is true;
create index if not exists experts_listed_position_trgm on public.experts using gin ("position" extensions.gin_trgm_ops)
  where verification_status = 'verified' and discoverable is true;
create index if not exists experts_listed_filters_idx on public.experts (country, primary_expertise, years_experience)
  where verification_status = 'verified' and discoverable is true;
create index if not exists experts_listed_consulting_idx on public.experts (consulting_availability)
  where verification_status = 'verified' and discoverable is true;

-- Database level gate: the public (and any signed-in user who is not an admin) can see an expert only if Verified and
-- discoverable, and only these columns. Admins keep their own policy.
revoke select on public.experts from anon;
grant select (expert_id, title, full_name, "position", organisation, country, state, primary_expertise, secondary_expertise,
              years_experience, qualification, availability, consulting_availability, verified_at)
  on public.experts to anon;
drop policy if exists experts_public_listed on public.experts;
create policy experts_public_listed on public.experts for select to anon
  using (verification_status = 'verified' and discoverable is true);

-- A person sets their own consulting availability from the sign-in portal (through the expert-portal function only).
create or replace function public.portal_set_consulting(p_expert_id text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value is null or p_value not in ('available', 'limited', 'not_available') then
    raise exception 'bad_value' using errcode = 'P0001';
  end if;
  update public.experts set consulting_availability = p_value where expert_id = p_expert_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.portal_set_consulting(text, text) from public, anon, authenticated;
grant execute on function public.portal_set_consulting(text, text) to service_role;

-- The search. The old argument list is replaced by the same list plus three filters at the end (all default to null).
drop function if exists public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text);

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
  p_offset int default 0,
  p_country text default null,
  p_consulting text default null,
  p_body uuid default null,
  p_ngo uuid default null
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
     -- Only an expert who is Verified AND chose to be discoverable is ever searched.
     where e.verification_status = 'verified'
       and e.discoverable is true
       and (v_like is null
            or e.full_name ilike v_like
            or e.organisation ilike v_like
            or e."position" ilike v_like
            or e.primary_expertise ilike v_like
            or array_to_string(e.secondary_expertise, ' | ') ilike v_like)
       and (nullif(p_expertise, '') is null or e.primary_expertise = p_expertise or p_expertise = any (e.secondary_expertise))
       and (nullif(p_country, '') is null or e.country = p_country)
       and (nullif(p_state, '') is null or e.state = p_state)
       and (nullif(p_qualification, '') is null or e.qualification = p_qualification)
       and (nullif(p_years, '') is null or e.years_experience = p_years)
       and (nullif(p_membership, '') is null or (e.affiliations_public and p_membership = any (e.memberships)))
       and (nullif(p_assignment, '') is null or p_assignment = any (e.assignments))
       and (nullif(p_availability, '') is null or e.availability = p_availability)
       and (nullif(p_consulting, '') is null or e.consulting_availability = p_consulting)
       -- Memberships and affiliations are searched only for experts who agreed to make them public.
       and (p_body is null or (e.affiliations_public and exists (
              select 1 from public.expert_affiliations a join public.institutions i on i.id = a.institution_id
               where a.expert_id = e.expert_id and a.institution_id = p_body and i.status = 'approved')))
       and (p_ngo is null or (e.affiliations_public and exists (
              select 1 from public.expert_affiliations a join public.institutions i on i.id = a.institution_id
               where a.expert_id = e.expert_id and a.institution_id = p_ngo and i.status = 'approved')))
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
                    'country', r.country,
                    'state', r.state,
                    'primary_expertise', r.primary_expertise,
                    'years_experience', r.years_experience,
                    'qualification', r.qualification,
                    'consulting_availability', r.consulting_availability) order by r.rn)
             from ranked r
            where r.rn > v_offset and r.rn <= v_offset + v_limit
         ), '[]'::jsonb)
    into v_total, v_items;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

revoke all on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text, text, uuid, uuid) from public;
grant execute on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text, text, uuid, uuid) to anon, authenticated;

-- A profile also shows the consulting availability. Everything else is unchanged from the institutions release.
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
           'country', e.country,
           'state', e.state,
           'primary_expertise', e.primary_expertise,
           'secondary_expertise', e.secondary_expertise,
           'years_experience', e.years_experience,
           'qualification', e.qualification,
           'consulting_availability', e.consulting_availability,
           'memberships', case when e.affiliations_public then e.memberships else '{}'::text[] end,
           'affiliations', case when e.affiliations_public then coalesce((
              select jsonb_agg(jsonb_build_object(
                       'name', i.name, 'acronym', i.acronym, 'kind', a.kind, 'category', i.category,
                       'membership_category', a.membership_category, 'affiliation_type', a.affiliation_type)
                     order by a.kind, lower(i.name))
                from public.expert_affiliations a
                join public.institutions i on i.id = a.institution_id
               where a.expert_id = e.expert_id and i.status = 'approved'), '[]'::jsonb)
              else '[]'::jsonb end,
           'assignments', e.assignments,
           'availability', e.availability,
           'profile_url', e.profile_url,
           'verified_at', e.verified_at)
    from public.experts e
   where e.expert_id = p_expert_id
     and e.verification_status = 'verified'
     and e.discoverable is true;
$$;
