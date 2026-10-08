-- Fixes found by the Supabase security advisors.

-- A function should not depend on the caller's search_path.
alter function public.normalise_phone(text) set search_path = '';

-- is_admin() is only needed by signed in users (the admin login). The anonymous role can no longer call it.
revoke execute on function public.is_admin() from anon;
