-- Row Level Security and the public registration RPC.

alter table public.experts enable row level security;
alter table public.email_outbox enable row level security;
alter table public.admins enable row level security;
alter table public.registration_attempts enable row level security;

-- Start from nothing, then grant only what is needed.
revoke all on public.experts, public.email_outbox, public.admins, public.registration_attempts from anon, authenticated;
revoke all on sequence public.expert_id_seq from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admin reads: authenticated AND on the allow-list. The public has no read access at all.
grant select on public.experts to authenticated;
create policy experts_admin_read on public.experts
  for select to authenticated
  using (public.is_admin());

-- Normalise Nigerian numbers so 0803..., +234 803... and 234803... all collide as duplicates.
create or replace function public.normalise_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if raw is null then return null; end if;
  d := regexp_replace(raw, '\D', '', 'g');
  if d = '' then return null; end if;
  if left(d, 2) = '00' then d := substr(d, 3); end if;
  if left(d, 1) = '0' and length(d) = 11 then d := '234' || substr(d, 2); end if;
  return d;
end;
$$;

create or replace function public.register_expert(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(btrim(payload ->> 'email')), '');
  v_phone text := public.normalise_phone(payload ->> 'phone');
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

  -- Cloudflare Turnstile hook: verify payload ->> 'turnstile_token' here (via an Edge Function
  -- or pg_net call) once Turnstile is enabled. Left open on purpose for the conference launch.

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
  if v_email is null and v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'contact_required');
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  if v_phone is not null and length(v_phone) not between 10 and 15 then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
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
      full_name, title, organisation, position, state, phone, email,
      primary_expertise, secondary_expertise, years_experience, qualification,
      memberships, nes_number, iepn_status,
      assignments, availability, profile_url, discoverable, consent_contact
    ) values (
      btrim(payload ->> 'full_name'),
      payload ->> 'title',
      btrim(payload ->> 'organisation'),
      btrim(payload ->> 'position'),
      payload ->> 'state',
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
      nullif(btrim(coalesce(payload ->> 'profile_url', '')), ''),
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
    when not_null_violation or check_violation or invalid_text_representation then
      return jsonb_build_object('ok', false, 'error', 'invalid');
  end;

  -- Queue the confirmation email (see email_outbox). Nothing is sent in this pass.
  if v_email is not null then
    insert into public.email_outbox (expert_id, to_email) values (v_new_id, v_email);
  end if;

  return jsonb_build_object('ok', true, 'expert_id', v_new_id);
end;
$$;

revoke all on function public.register_expert(jsonb) from public;
grant execute on function public.register_expert(jsonb) to anon, authenticated;
