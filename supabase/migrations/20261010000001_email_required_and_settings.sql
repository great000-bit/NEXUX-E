-- 1. Settings the email functions read (an environment secret of the same name wins if one is set).
--    EMAIL_REPLY_TO -> email_reply_to: the Reply-To header on every email NEXUS-E sends.
--    CONTACT_EMAIL  -> contact_email:  the address named in the "Not verified" email.
-- Change them later with, for example:
--   update public.verification_settings set value = 'help@nexuse.org' where key in ('email_reply_to', 'contact_email');
insert into public.verification_settings (key, value, description) values
  ('email_reply_to', 'greatemmanwori@gmail.com', 'Reply-To address on every email NEXUS-E sends (confirmation, sign-in code and status emails).'),
  ('contact_email', 'greatemmanwori@gmail.com', 'Contact address named in the Not verified email.')
on conflict (key) do nothing;

-- 2. Registration now requires an email address. Phone stays optional, but is validated when given.
--    Records that already exist without an email stay valid (the table check is unchanged).
create or replace function public.register_expert(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(lower(btrim(payload ->> 'email')), '');
  v_phone text := public.normalise_phone(payload ->> 'phone');
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
    when not_null_violation or check_violation or invalid_text_representation then
      return jsonb_build_object('ok', false, 'error', 'invalid');
  end;

  -- Queue the confirmation email.
  insert into public.email_outbox (expert_id, to_email) values (v_new_id, v_email);

  return jsonb_build_object('ok', true, 'expert_id', v_new_id);
end;
$$;

revoke all on function public.register_expert(jsonb) from public;
grant execute on function public.register_expert(jsonb) to anon, authenticated;

-- 3. An admin can add an email address to an older record that has none, so that expert can sign in.
--    Only when the record has no email yet. The address itself is not copied into the decision log.
create or replace function public.admin_set_expert_email(p_expert_id text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_old text;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;

  select e.email, e.verification_status into v_old, v_status
    from public.experts e where e.expert_id = p_expert_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_old is not null then
    raise exception 'email_exists' using errcode = 'P0001';
  end if;

  begin
    update public.experts set email = v_email where expert_id = p_expert_id;
  exception when unique_violation then
    raise exception 'email_taken' using errcode = 'P0001';
  end;

  insert into public.verification_audit (expert_id, actor, actor_type, action, old_status, new_status, reason)
  values (p_expert_id, v_admin, 'admin', 'email_added', v_status, v_status, 'An email address was added to the record so the expert can sign in.');

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_set_expert_email(text, text) from public, anon;
grant execute on function public.admin_set_expert_email(text, text) to authenticated;
