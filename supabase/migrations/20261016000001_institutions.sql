-- Phase 1 of the developer brief: institutions, an expert's memberships and affiliations, and the admin review of both.
--
-- Additive and backwards compatible. No existing registration row is changed (the one new column on experts defaults to
-- false), the old registration form (which sends no affiliations) keeps working, and the directory functions keep their
-- signatures.
--
-- Privacy: membership numbers and licence details live only in expert_affiliations. That table has no policy for the
-- public or for signed-in users: only the functions below reach it, and the only ones that return numbers are the expert's
-- own portal function and the admin functions. Everything declared is self-declared. Nobody becomes "verified" by naming
-- an organisation, and the registry's verification is never presented as statutory licensing.

-- 1. The institutions table.
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  acronym text check (acronym is null or char_length(acronym) <= 40),
  -- An English country name from the registration list, or 'Pan-African'.
  country text check (country is null or char_length(country) <= 80),
  coverage text not null default 'national' check (coverage in ('national', 'regional', 'pan_african', 'international')),
  -- Four categories, kept apart.
  category text not null check (category in ('professional_body', 'statutory_council', 'scientific_society', 'ngo_network')),
  specialisation text check (specialisation is null or char_length(specialisation) <= 300),
  website text check (website is null or website ~* '^https?://[^[:space:]]+$'),
  public_contact text check (public_contact is null or char_length(public_contact) <= 300),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified')),
  verification_date date,
  evidence_source text check (evidence_source is null or char_length(evidence_source) <= 500),
  -- The Expert ID of the person who suggested it (null for seeded records). Never shown to anyone but admins.
  suggested_by text check (suggested_by is null or char_length(suggested_by) <= 20),
  status text not null default 'pending' check (status in ('approved', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists institutions_name_country_key on public.institutions ((lower(name)), (coalesce(country, '')));
create index if not exists institutions_status_idx on public.institutions (status, category);

alter table public.institutions enable row level security;
revoke all on public.institutions from anon, authenticated;

-- 2. An expert's declared memberships and affiliations.
create table if not exists public.expert_affiliations (
  id uuid primary key default gen_random_uuid(),
  expert_id text not null references public.experts (expert_id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete restrict,
  kind text not null check (kind in ('professional', 'ngo')),
  membership_category text check (membership_category is null or char_length(membership_category) <= 80),
  -- Private: visible to the expert and to admins only.
  membership_number text check (membership_number is null or char_length(membership_number) <= 80),
  licence_status text check (licence_status is null or char_length(licence_status) <= 120),
  affiliation_type text check (affiliation_type is null or affiliation_type in ('employee', 'consultant', 'member', 'volunteer', 'board_member', 'partner')),
  declaration text not null default 'self_declared' check (declaration = 'self_declared'),
  -- The three evidence statuses of the brief. Only 'registered' is built so far.
  evidence_status text not null default 'registered' check (evidence_status in ('registered', 'evidence_submitted', 'verified')),
  created_at timestamptz not null default now(),
  unique (expert_id, institution_id)
);

create index if not exists expert_affiliations_expert_idx on public.expert_affiliations (expert_id);
create index if not exists expert_affiliations_institution_idx on public.expert_affiliations (institution_id);

alter table public.expert_affiliations enable row level security;
revoke all on public.expert_affiliations from anon, authenticated;

-- 3. Consent to show memberships and affiliations on the public profile. Off unless the expert turns it on.
alter table public.experts add column if not exists affiliations_public boolean not null default false;
alter table public.experts add column if not exists affiliations_public_at timestamptz;

-- 4. What the registration form may choose from: approved institutions only. Pending suggestions are never listed.
create or replace function public.public_institutions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'name', i.name, 'acronym', i.acronym, 'country', i.country, 'category', i.category)
         order by lower(i.name)), '[]'::jsonb)
    from public.institutions i
   where i.status = 'approved';
$$;

revoke all on function public.public_institutions() from public;
grant execute on function public.public_institutions() to anon, authenticated;

-- 5. Registration: the same as before, plus the affiliations. Anything typed under "Other (specify)" becomes a pending
--    suggestion for the admin queue, and is linked to the expert so the expert can see it.
create or replace function public.register_expert(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(btrim(payload ->> 'email')), '');
  v_country text := coalesce(nullif(btrim(payload ->> 'country'), ''), 'Nigeria');
  v_phone text := public.normalise_phone(payload ->> 'phone', coalesce(nullif(btrim(payload ->> 'country'), ''), 'Nigeria'));
  v_url text := nullif(btrim(coalesce(payload ->> 'profile_url', '')), '');
  v_secondary text[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload -> 'secondary_expertise', '[]'::jsonb))), '{}');
  v_memberships text[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload -> 'memberships', '[]'::jsonb))), '{}');
  v_assignments text[] := coalesce(array(select jsonb_array_elements_text(coalesce(payload -> 'assignments', '[]'::jsonb))), '{}');
  v_aff jsonb := case when jsonb_typeof(payload -> 'affiliations') = 'array' then payload -> 'affiliations' else '[]'::jsonb end;
  v_aff_public boolean := coalesce((payload ->> 'affiliations_public') = 'true', false);
  v_item jsonb;
  v_kind text;
  v_inst uuid;
  v_other text;
  v_headers json;
  v_key text;
  v_recent int;
  v_new_id text;
  v_constraint text;
begin
  -- Honeypot: real people never fill this. Pretend success so bots learn nothing.
  if nullif(btrim(coalesce(payload ->> 'website', '')), '') is not null then
    return jsonb_build_object('ok', true, 'expert_id', 'NEX-000000');
  end if;

  -- Cloudflare Turnstile hook: verify payload ->> 'turnstile_token' here once Turnstile is enabled.

  -- Rate limit: generous, because a whole conference hall can share one network address.
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  exception when others then
    v_headers := '{}'::json;
  end;
  v_key := coalesce(nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
  select count(*) into v_recent from public.registration_attempts
    where client_key = v_key and created_at > now() - interval '10 minutes';
  if v_recent >= 120 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.registration_attempts (client_key) values (v_key);
  delete from public.registration_attempts where created_at < now() - interval '1 day';

  -- Validation (the database is the last line of defence; the form validates first).
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  if v_phone is not null and length(v_phone) not between 10 and 15 then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;
  if v_phone is not null and v_country <> 'Nigeria' and btrim(payload ->> 'phone') !~ '^(\+|00)' then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;
  if v_url is not null and v_url !~* '^https?://[^[:space:]]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_url');
  end if;
  if cardinality(v_secondary) > 3 then
    return jsonb_build_object('ok', false, 'error', 'too_many_secondary');
  end if;
  if coalesce((payload ->> 'consent_contact')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'error', 'consent_required');
  end if;
  if payload ->> 'discoverable' is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Affiliations are optional. Each is either an approved institution or a typed name, never both and never neither.
  if jsonb_array_length(v_aff) > 20 then
    return jsonb_build_object('ok', false, 'error', 'too_many_affiliations');
  end if;
  for v_item in select * from jsonb_array_elements(v_aff) loop
    v_kind := v_item ->> 'kind';
    v_other := nullif(btrim(coalesce(v_item ->> 'other_name', '')), '');
    begin
      v_inst := nullif(v_item ->> 'institution_id', '')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid_affiliation');
    end;
    if v_kind is null or v_kind not in ('professional', 'ngo')
       or (v_inst is null) = (v_other is null)
       or (v_inst is not null and not exists (select 1 from public.institutions i where i.id = v_inst and i.status = 'approved'))
       or (v_other is not null and char_length(v_other) not between 2 and 200)
       or char_length(coalesce(v_item ->> 'membership_category', '')) > 80
       or char_length(coalesce(v_item ->> 'membership_number', '')) > 80
       or char_length(coalesce(v_item ->> 'licence_status', '')) > 120
       or coalesce(nullif(v_item ->> 'affiliation_type', ''), 'member') not in ('employee', 'consultant', 'member', 'volunteer', 'board_member', 'partner')
    then
      return jsonb_build_object('ok', false, 'error', 'invalid_affiliation');
    end if;
  end loop;

  begin
    insert into public.experts (
      full_name, title, organisation, position, country, state, phone, email,
      primary_expertise, secondary_expertise, years_experience, qualification,
      memberships, nes_number, iepn_status,
      assignments, availability, profile_url, discoverable, consent_contact,
      affiliations_public, affiliations_public_at
    ) values (
      btrim(payload ->> 'full_name'),
      payload ->> 'title',
      btrim(payload ->> 'organisation'),
      btrim(payload ->> 'position'),
      v_country,
      btrim(payload ->> 'state'),
      v_phone,
      v_email,
      payload ->> 'primary_expertise',
      v_secondary,
      payload ->> 'years_experience',
      payload ->> 'qualification',
      v_memberships,
      nullif(btrim(coalesce(payload ->> 'nes_number', '')), ''),
      nullif(btrim(coalesce(payload ->> 'iepn_status', '')), ''),
      v_assignments,
      payload ->> 'availability',
      v_url,
      (payload ->> 'discoverable')::boolean,
      true,
      v_aff_public,
      case when v_aff_public then now() end
    )
    returning expert_id into v_new_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'experts_phone_key' then
        return jsonb_build_object('ok', false, 'error', 'duplicate_phone');
      end if;
      return jsonb_build_object('ok', false, 'error', 'duplicate_email');
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'experts_country_valid' then
        return jsonb_build_object('ok', false, 'error', 'invalid_country');
      end if;
      return jsonb_build_object('ok', false, 'error', 'invalid');
    when not_null_violation or invalid_text_representation then
      return jsonb_build_object('ok', false, 'error', 'invalid');
  end;

  -- Save the affiliations. A typed name is matched to an institution that already has that name, otherwise it is saved as a
  -- pending suggestion: not public, not offered to anyone else, waiting for an admin.
  for v_item in select * from jsonb_array_elements(v_aff) loop
    v_kind := v_item ->> 'kind';
    v_other := nullif(btrim(coalesce(v_item ->> 'other_name', '')), '');
    v_inst := nullif(v_item ->> 'institution_id', '')::uuid;
    if v_other is not null then
      select i.id into v_inst from public.institutions i
        where lower(i.name) = lower(v_other)
        order by (i.status = 'approved') desc, i.created_at limit 1;
      if v_inst is null then
        insert into public.institutions (name, country, coverage, category, verification_status, status, suggested_by, evidence_source)
        values (v_other, case when v_country = 'Other' then null else v_country end, 'national',
                case when v_kind = 'ngo' then 'ngo_network' else 'professional_body' end,
                'unverified', 'pending', v_new_id, 'Suggested by an expert at registration. Self-declared, not checked.')
        on conflict ((lower(name)), (coalesce(country, ''))) do nothing
        returning id into v_inst;
        if v_inst is null then
          select i.id into v_inst from public.institutions i where lower(i.name) = lower(v_other) limit 1;
        end if;
      end if;
    end if;
    insert into public.expert_affiliations (
      expert_id, institution_id, kind, membership_category, membership_number, licence_status, affiliation_type
    ) values (
      v_new_id, v_inst, v_kind,
      nullif(btrim(coalesce(v_item ->> 'membership_category', '')), ''),
      nullif(btrim(coalesce(v_item ->> 'membership_number', '')), ''),
      nullif(btrim(coalesce(v_item ->> 'licence_status', '')), ''),
      nullif(v_item ->> 'affiliation_type', '')
    )
    on conflict (expert_id, institution_id) do nothing;
  end loop;

  -- Queue the confirmation email.
  insert into public.email_outbox (expert_id, to_email) values (v_new_id, v_email);

  return jsonb_build_object('ok', true, 'expert_id', v_new_id);
end;
$$;

revoke all on function public.register_expert(jsonb) from public;
grant execute on function public.register_expert(jsonb) to anon, authenticated;

-- 6. The directory: memberships and affiliations are shown, and can be searched, only when the expert agreed to show them.
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
  p_country text default null
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
       and (nullif(p_country, '') is null or e.country = p_country)
       and (nullif(p_state, '') is null or e.state = p_state)
       and (nullif(p_qualification, '') is null or e.qualification = p_qualification)
       and (nullif(p_years, '') is null or e.years_experience = p_years)
       and (nullif(p_membership, '') is null or (e.affiliations_public and p_membership = any (e.memberships)))
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
                    'country', r.country,
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
           'memberships', case when e.affiliations_public then e.memberships else '{}'::text[] end,
           -- Names and the kind of tie only, and only approved institutions. Never a number, a licence or a pending suggestion.
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

-- 7. The expert's own view (through the sign-in function only): their declarations with the private details, and the consent.
create or replace function public.portal_get_affiliations(p_expert_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'affiliations_public', coalesce((select e.affiliations_public from public.experts e where e.expert_id = p_expert_id), false),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'kind', a.kind, 'name', i.name, 'acronym', i.acronym, 'institution_status', i.status,
               'membership_category', a.membership_category, 'membership_number', a.membership_number,
               'licence_status', a.licence_status, 'affiliation_type', a.affiliation_type,
               'evidence_status', a.evidence_status)
             order by a.kind, lower(i.name))
        from public.expert_affiliations a
        join public.institutions i on i.id = a.institution_id
       where a.expert_id = p_expert_id), '[]'::jsonb));
$$;

create or replace function public.portal_set_affiliations_public(p_expert_id text, p_value boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value is null then
    raise exception 'bad_value' using errcode = 'P0001';
  end if;
  update public.experts
     set affiliations_public = p_value,
         affiliations_public_at = case when p_value then now() else affiliations_public_at end
   where expert_id = p_expert_id and affiliations_public is distinct from p_value;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.portal_get_affiliations(text), public.portal_set_affiliations_public(text, boolean) from public, anon, authenticated;
grant execute on function public.portal_get_affiliations(text), public.portal_set_affiliations_public(text, boolean) to service_role;

-- 8. Admin: review, edit and approve institutions, merge duplicates, and the registration counts.
create or replace function public.admin_list_institutions()
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
             'id', i.id, 'name', i.name, 'acronym', i.acronym, 'country', i.country, 'coverage', i.coverage,
             'category', i.category, 'specialisation', i.specialisation, 'website', i.website,
             'public_contact', i.public_contact, 'verification_status', i.verification_status,
             'verification_date', i.verification_date, 'evidence_source', i.evidence_source,
             'suggested_by', i.suggested_by, 'status', i.status, 'created_at', i.created_at, 'updated_at', i.updated_at,
             'experts', (select count(*) from public.expert_affiliations a where a.institution_id = i.id))
           order by (i.status = 'pending') desc, lower(i.name))
      from public.institutions i), '[]'::jsonb);
end;
$$;

create or replace function public.admin_save_institution(p_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_status text := coalesce(nullif(p_payload ->> 'status', ''), 'pending');
  v_verification text := coalesce(nullif(p_payload ->> 'verification_status', ''), 'unverified');
  v_date date := nullif(p_payload ->> 'verification_date', '')::date;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'bad_name' using errcode = 'P0001';
  end if;
  -- An institution is only "verified" with a date and an evidence source, so the label always has something behind it.
  if v_verification = 'verified' and (v_date is null or nullif(btrim(coalesce(p_payload ->> 'evidence_source', '')), '') is null) then
    raise exception 'verification_needs_evidence' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into public.institutions (name, acronym, country, coverage, category, specialisation, website, public_contact,
                                     verification_status, verification_date, evidence_source, status)
    values (v_name, nullif(btrim(coalesce(p_payload ->> 'acronym', '')), ''), nullif(btrim(coalesce(p_payload ->> 'country', '')), ''),
            coalesce(nullif(p_payload ->> 'coverage', ''), 'national'), p_payload ->> 'category',
            nullif(btrim(coalesce(p_payload ->> 'specialisation', '')), ''), nullif(btrim(coalesce(p_payload ->> 'website', '')), ''),
            nullif(btrim(coalesce(p_payload ->> 'public_contact', '')), ''), v_verification, v_date,
            nullif(btrim(coalesce(p_payload ->> 'evidence_source', '')), ''), v_status)
    returning id into v_id;
  else
    update public.institutions set
      name = v_name,
      acronym = nullif(btrim(coalesce(p_payload ->> 'acronym', '')), ''),
      country = nullif(btrim(coalesce(p_payload ->> 'country', '')), ''),
      coverage = coalesce(nullif(p_payload ->> 'coverage', ''), coverage),
      category = coalesce(nullif(p_payload ->> 'category', ''), category),
      specialisation = nullif(btrim(coalesce(p_payload ->> 'specialisation', '')), ''),
      website = nullif(btrim(coalesce(p_payload ->> 'website', '')), ''),
      public_contact = nullif(btrim(coalesce(p_payload ->> 'public_contact', '')), ''),
      verification_status = v_verification,
      verification_date = v_date,
      evidence_source = nullif(btrim(coalesce(p_payload ->> 'evidence_source', '')), ''),
      status = v_status,
      updated_at = now()
    where id = v_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
exception
  when unique_violation then
    raise exception 'duplicate_name' using errcode = 'P0001';
  when check_violation then
    raise exception 'invalid_institution' using errcode = 'P0001';
end;
$$;

-- Merging: everything that pointed at the duplicate points at the one that stays, then the duplicate is removed.
create or replace function public.admin_merge_institutions(p_from uuid, p_into uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moved int;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_from is null or p_into is null or p_from = p_into then
    raise exception 'bad_merge' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.institutions where id = p_into) or not exists (select 1 from public.institutions where id = p_from) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- An expert who already named both keeps the declaration on the institution that stays.
  delete from public.expert_affiliations a
   where a.institution_id = p_from
     and exists (select 1 from public.expert_affiliations b where b.expert_id = a.expert_id and b.institution_id = p_into);
  update public.expert_affiliations set institution_id = p_into where institution_id = p_from;
  get diagnostics v_moved = row_count;
  delete from public.institutions where id = p_from;
  return jsonb_build_object('ok', true, 'moved', v_moved);
end;
$$;

create or replace function public.admin_expert_affiliations(p_expert_id text)
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
             'id', a.id, 'kind', a.kind, 'institution_id', i.id, 'name', i.name, 'acronym', i.acronym,
             'institution_status', i.status, 'membership_category', a.membership_category,
             'membership_number', a.membership_number, 'licence_status', a.licence_status,
             'affiliation_type', a.affiliation_type, 'declaration', a.declaration, 'evidence_status', a.evidence_status)
           order by a.kind, lower(i.name))
      from public.expert_affiliations a join public.institutions i on i.id = a.institution_id
     where a.expert_id = p_expert_id), '[]'::jsonb);
end;
$$;

create or replace function public.admin_registration_stats()
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
  return jsonb_build_object(
    'by_specialisation', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n) order by t.n desc, t.name)
                                    from (select e.primary_expertise as name, count(*) as n from public.experts e group by 1) t), '[]'::jsonb),
    'by_country', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n) order by t.n desc, t.name)
                              from (select e.country as name, count(*) as n from public.experts e group by 1) t), '[]'::jsonb),
    'by_institution', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'count', t.n) order by t.n desc, t.name)
                                 from (select i.id, i.name, i.status, count(*) as n
                                         from public.expert_affiliations a join public.institutions i on i.id = a.institution_id
                                        group by i.id, i.name, i.status) t), '[]'::jsonb));
end;
$$;

revoke all on function
  public.admin_list_institutions(), public.admin_save_institution(uuid, jsonb), public.admin_merge_institutions(uuid, uuid),
  public.admin_expert_affiliations(text), public.admin_registration_stats()
from public, anon, authenticated;
grant execute on function
  public.admin_list_institutions(), public.admin_save_institution(uuid, jsonb), public.admin_merge_institutions(uuid, uuid),
  public.admin_expert_affiliations(text), public.admin_registration_stats()
to authenticated;

revoke all on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text) from public;
revoke all on function public.directory_profile(text) from public;
grant execute on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text) to anon, authenticated;
grant execute on function public.directory_profile(text) to anon, authenticated;
