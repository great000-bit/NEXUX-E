-- Confirmation email sender: outbox bookkeeping, a safe "claim" function, and the triggers
-- that wake the Edge Function. Registration never waits on any of this.

-- 1. Bookkeeping columns -----------------------------------------------------------------
alter table public.email_outbox
  add column if not exists last_error text,
  add column if not exists failed_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists provider_id text;

-- pending  : waiting to be sent
-- sending  : claimed by a running sender
-- sent     : delivered to Resend
-- failed   : last attempt failed, will be retried after next_attempt_at
-- dead     : gave up (attempt cap reached or the address was rejected). Needs a human.
alter table public.email_outbox drop constraint if exists email_outbox_status_valid;
alter table public.email_outbox add constraint email_outbox_status_valid
  check (status in ('pending', 'sending', 'sent', 'failed', 'dead'));

-- One confirmation per expert, ever. A second insert for the same expert is rejected.
create unique index if not exists email_outbox_once on public.email_outbox (expert_id, template);

create index if not exists email_outbox_work_idx
  on public.email_outbox (status, next_attempt_at) where status in ('pending', 'failed', 'sending');

grant select, update on public.email_outbox to service_role;
grant select on public.experts to service_role;

-- 2. Claim function ----------------------------------------------------------------------
-- Atomically picks due rows and marks them 'sending', so two senders can never take the same row.
-- Honours a daily cap (Resend free plan: 100 a day) and an attempt cap so a bad row cannot loop.
create or replace function public.claim_outbox_emails(
  p_batch int default 20,
  p_max_attempts int default 5,
  p_daily_cap int default 100
)
returns table (
  job_id bigint,
  job_expert_id text,
  job_to_email text,
  job_full_name text,
  job_title text,
  job_attempts int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent_today int;
  v_in_flight int;
  v_room int;
begin
  -- Give up on rows that used all their attempts, including ones stuck in 'sending'.
  update public.email_outbox o
     set status = 'dead',
         failed_at = now(),
         last_error = coalesce(o.last_error, 'Gave up after the maximum number of attempts')
   where o.attempts >= p_max_attempts
     and (o.status in ('pending', 'failed')
          or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes'));

  select count(*) into v_sent_today
    from public.email_outbox o
   where o.status = 'sent'
     and o.sent_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  select count(*) into v_in_flight
    from public.email_outbox o
   where o.status = 'sending' and o.locked_at >= now() - interval '10 minutes';

  v_room := least(p_batch, p_daily_cap - v_sent_today - v_in_flight);
  if v_room <= 0 then
    return;
  end if;

  return query
  with picked as (
    select o.id
      from public.email_outbox o
     where o.attempts < p_max_attempts
       and (
         (o.status in ('pending', 'failed') and o.next_attempt_at <= now())
         or (o.status = 'sending' and o.locked_at < now() - interval '10 minutes')
       )
     order by o.created_at
     limit v_room
     for update skip locked
  ),
  claimed as (
    update public.email_outbox o
       set status = 'sending',
           locked_at = now(),
           attempts = o.attempts + 1
      from picked
     where o.id = picked.id
    returning o.id, o.expert_id, o.to_email, o.attempts
  )
  select c.id, c.expert_id, c.to_email, e.full_name, e.title, c.attempts
    from claimed c
    join public.experts e on e.expert_id = c.expert_id;
end;
$$;

revoke all on function public.claim_outbox_emails(int, int, int) from public, anon, authenticated;
grant execute on function public.claim_outbox_emails(int, int, int) to service_role;

-- 3. Waking the Edge Function ------------------------------------------------------------
-- pg_net posts asynchronously, so the registration transaction never waits for the network.
-- Everything below is wrapped so that any failure is swallowed: registration must always succeed.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- The function URL and shared secret live in Supabase Vault (see README), never in this file.
-- If they are not set yet, this does nothing and rows simply wait in the outbox.
create or replace function public.invoke_email_sender(p_source text default 'unknown')
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_url text;
  v_secret text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_function_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_webhook_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body := jsonb_build_object('source', p_source),
        timeout_milliseconds := 5000
      );
    end if;
  exception when others then
    raise warning 'invoke_email_sender failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.invoke_email_sender(text) from public, anon, authenticated;

create or replace function public.notify_email_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.invoke_email_sender('insert');
  exception when others then
    raise warning 'notify_email_outbox failed: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.notify_email_outbox() from public, anon, authenticated;

drop trigger if exists email_outbox_notify on public.email_outbox;
create trigger email_outbox_notify
  after insert on public.email_outbox
  for each row execute function public.notify_email_outbox();

-- Retry sweep every 10 minutes, but only when there is something to do.
create or replace function public.retry_email_outbox()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.email_outbox
     where attempts < 5
       and ((status in ('pending', 'failed') and next_attempt_at <= now())
            or (status = 'sending' and locked_at < now() - interval '10 minutes'))
  ) then
    perform public.invoke_email_sender('cron');
  end if;
end;
$$;

revoke all on function public.retry_email_outbox() from public, anon, authenticated;

select cron.schedule('email-outbox-retry', '*/10 * * * *', $$select public.retry_email_outbox()$$);
