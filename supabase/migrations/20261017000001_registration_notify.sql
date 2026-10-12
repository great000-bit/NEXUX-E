-- Tells the admin by email when someone registers. Additive and safe for registration:
--   * the trigger only writes one row to its own outbox table, and swallows any error, so registration can never fail or slow down because of it;
--   * nothing is sent from the database: a pg_cron job wakes an Edge Function once a minute, and only when something is waiting;
--   * existing experts are not backfilled, so nothing is sent for them.
--
-- The admin address is NOT in this file. It is a row in verification_settings (key registration_notify_email) that is set
-- directly with SQL on each project. A second setting, registration_notify_enabled ('true' or 'false'), switches it off.

-- 1. The outbox. One row per registration, until it has been sent.
create table if not exists public.registration_notifications (
  id bigint generated always as identity primary key,
  expert_id text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  -- Set while a run is sending the row, so two runs never send it twice.
  locked_at timestamptz,
  -- Set when it has failed 5 times: it stays here, flagged, and is not retried.
  failed_at timestamptz,
  provider_id text
);

create index if not exists registration_notifications_pending_idx
  on public.registration_notifications (id) where sent_at is null and failed_at is null;

alter table public.registration_notifications enable row level security;
revoke all on public.registration_notifications from anon, authenticated;

-- 2. The switch. Only the 'enabled' flag is created here; the address is set by hand.
insert into public.verification_settings (key, value, description)
values ('registration_notify_enabled', 'true', 'Set to false to stop the admin email that is sent when someone registers.')
on conflict (key) do nothing;

-- 3. The trigger. It must never get in the way of a registration.
create or replace function public.queue_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if coalesce((select s.value from public.verification_settings s where s.key = 'registration_notify_enabled'), 'true') <> 'false' then
      insert into public.registration_notifications (expert_id) values (new.expert_id);
    end if;
  exception when others then
    raise warning 'queue_registration_notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists experts_notify_registration on public.experts;
create trigger experts_notify_registration
  after insert on public.experts
  for each row execute function public.queue_registration_notification();

-- 4. Claiming rows for a run. Skips rows another run holds, and takes back rows whose run died.
create or replace function public.claim_registration_notifications(p_limit int default 100, p_max_attempts int default 5)
returns table (job_id bigint, job_expert_id text, job_created_at timestamptz, job_attempts int,
               job_primary_expertise text, job_country text, job_registered_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select n.id from public.registration_notifications n
     where n.sent_at is null and n.failed_at is null and n.attempts < p_max_attempts
       and (n.locked_at is null or n.locked_at < now() - interval '5 minutes')
     order by n.id
     limit greatest(least(coalesce(p_limit, 100), 500), 1)
     for update skip locked
  ), upd as (
    update public.registration_notifications n set locked_at = now()
      from picked where n.id = picked.id
    returning n.id, n.expert_id, n.created_at, n.attempts
  )
  select u.id, u.expert_id, u.created_at, u.attempts, e.primary_expertise, e.country, e.created_at
    from upd u left join public.experts e on e.expert_id = u.expert_id
   order by u.id;
end;
$$;

-- How many people registered today (Lagos date). A count only.
create or replace function public.registrations_today()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.experts e
   where (e.created_at at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date;
$$;

create or replace function public.mark_registration_notifications_sent(p_ids bigint[], p_provider_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.registration_notifications
     set sent_at = now(), provider_id = p_provider_id, last_error = null, locked_at = null
   where id = any (p_ids) and sent_at is null;
$$;

-- A failed send: count the attempt, remember why, and flag the row after the fifth.
create or replace function public.fail_registration_notifications(p_ids bigint[], p_error text, p_max_attempts int default 5)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.registration_notifications
     set attempts = attempts + 1,
         last_error = left(coalesce(p_error, 'unknown'), 500),
         locked_at = null,
         failed_at = case when attempts + 1 >= p_max_attempts then now() end
   where id = any (p_ids) and sent_at is null;
$$;

revoke all on function
  public.claim_registration_notifications(int, int), public.registrations_today(),
  public.mark_registration_notifications_sent(bigint[], text), public.fail_registration_notifications(bigint[], text, int)
from public, anon, authenticated;
grant execute on function
  public.claim_registration_notifications(int, int), public.registrations_today(),
  public.mark_registration_notifications_sent(bigint[], text), public.fail_registration_notifications(bigint[], text, int)
to service_role;

-- 5. The wake-up. The function lives next to the confirmation email sender, so its address is derived from that one.
create or replace function public.invoke_registration_notifier()
returns void
language plpgsql
security definer
set search_path = 'public', 'extensions', 'vault'
as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    if not exists (
      select 1 from public.registration_notifications n
       where n.sent_at is null and n.failed_at is null and n.attempts < 5
         and (n.locked_at is null or n.locked_at < now() - interval '5 minutes')
    ) then
      return;
    end if;
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_function_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_webhook_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url := replace(v_url, 'send-confirmation-emails', 'notify-registrations'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body := jsonb_build_object('source', 'cron'),
        timeout_milliseconds := 20000
      );
    end if;
  exception when others then
    raise warning 'invoke_registration_notifier failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.invoke_registration_notifier() from public, anon, authenticated;

-- Every minute. A minute with nothing waiting does nothing.
select cron.unschedule('registration-notify') where exists (select 1 from cron.job where jobname = 'registration-notify');
select cron.schedule('registration-notify', '* * * * *', $cron$select public.invoke_registration_notifier()$cron$);
