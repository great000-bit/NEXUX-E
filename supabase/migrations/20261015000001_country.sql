-- Africa-wide registration: every expert has a country (default Nigeria), the state becomes a free text "state, province
-- or region" outside Nigeria, and phone numbers are checked in international form outside Nigeria.
--
-- Additive and backwards compatible: the old registration form (which sends no country) keeps working and is treated as
-- Nigeria; existing rows become Nigeria through the column default; the unique indexes on email and phone are untouched;
-- the directory functions keep working for callers that do not send p_country.

-- 1. The column, its list of allowed values, and an index for the directory filter.
alter table public.experts add column if not exists country text not null default 'Nigeria';

alter table public.experts drop constraint if exists experts_country_valid;
alter table public.experts add constraint experts_country_valid check (country in ('Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Côte d''Ivoire', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe', 'Other'));

-- The state is typed freely outside Nigeria, so cap its length like the other text fields.
alter table public.experts drop constraint if exists experts_len_state;
alter table public.experts add constraint experts_len_state check (char_length(state) <= 200);

create index if not exists experts_country_idx on public.experts (country);

-- 2. Phone numbers. A local Nigerian number (0803 123 4567) still becomes 234803...; in every other country a number must
--    carry its country code (+254 712 345 678 or 00254 712 345 678), because a local zero means different things in each country.
create or replace function public.normalise_phone(raw text, country text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text;
  intl boolean;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '\D', '', 'g');
  if d = '' then return null; end if;
  intl := btrim(raw) ~ '^(\+|00)';
  if left(d, 2) = '00' then d := substr(d, 3); end if;
  if coalesce(country, 'Nigeria') = 'Nigeria' and not intl and left(d, 1) = '0' and length(d) = 11 then
    d := '234' || substr(d, 2);
  end if;
  return d;
end;
$$;

-- 3. Registration. Same as before, plus the country.
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

  begin
    insert into public.experts (
      full_name, title, organisation, position, country, state, phone, email,
      primary_expertise, secondary_expertise, years_experience, qualification,
      memberships, nes_number, iepn_status,
      assignments, availability, profile_url, discoverable, consent_contact
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
      true
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

  -- Queue the confirmation email.
  insert into public.email_outbox (expert_id, to_email) values (v_new_id, v_email);

  return jsonb_build_object('ok', true, 'expert_id', v_new_id);
end;
$$;

revoke all on function public.register_expert(jsonb) from public;
grant execute on function public.register_expert(jsonb) to anon, authenticated;

-- 4. The directory: a country filter (new last argument, so every older call still works) and the country in each result.
--    The old twelve-argument form is dropped in the same step, so the name never matches two functions at once.
drop function if exists public.directory_search(text, text, text, text, text, text, text, text, text, int, int);

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

revoke all on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text) from public;
revoke all on function public.directory_profile(text) from public;
grant execute on function public.directory_search(text, text, text, text, text, text, text, text, text, int, int, text) to anon, authenticated;
grant execute on function public.directory_profile(text) to anon, authenticated;
