-- Daily retention cleanup for files of experts marked Not verified.
--
-- The retention period lives in public.verification_settings ('rejected_retention_days', default 30):
--   update public.verification_settings set value = '14' where key = 'rejected_retention_days';
--
-- Like the email trigger, this reads the function address from Supabase Vault and swallows errors.
-- Before it does anything, store the address once:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/verification-admin', 'verification_function_url');

create or replace function public.invoke_verification_maintenance()
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
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'verification_function_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_webhook_secret';
    if v_url is not null and v_secret is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
        body := jsonb_build_object('action', 'retention'),
        timeout_milliseconds := 20000
      );
    end if;
  exception when others then
    raise warning 'invoke_verification_maintenance failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.invoke_verification_maintenance() from public, anon, authenticated;

-- Every day at 03:00 UTC.
select cron.schedule('verification-retention', '0 3 * * *', $$select public.invoke_verification_maintenance()$$);

-- The function reads the allow-list with the service role.
grant select on public.admins to service_role;
