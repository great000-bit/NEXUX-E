-- Run in the Supabase SQL editor AFTER creating the admin user in Authentication > Users.
-- Replace with the real admin email address(es). Emails must be lowercase.
insert into public.admins (email) values ('admin@example.org')
on conflict (email) do nothing;
