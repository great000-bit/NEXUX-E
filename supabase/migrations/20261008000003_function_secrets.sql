-- Lets the Edge Function read its two secrets from Supabase Vault when they are not set as
-- Edge Function environment variables. Only the service role can call it, and only these names work.
create or replace function public.get_function_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
    from vault.decrypted_secrets s
   where s.name = p_name
     and p_name in ('resend_api_key', 'email_webhook_secret')
   limit 1;
$$;

revoke all on function public.get_function_secret(text) from public, anon, authenticated;
grant execute on function public.get_function_secret(text) to service_role;
