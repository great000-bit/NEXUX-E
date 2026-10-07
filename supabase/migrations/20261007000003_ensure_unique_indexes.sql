-- Repair migration: make sure duplicate registrations are really blocked.
--
-- A live test showed two registrations with the same email, and two with the same phone number,
-- were both accepted. That means the unique indexes from migration 1 were missing in the project.
-- This file is safe to run more than once.
--
-- BEFORE running it, delete any duplicate rows (for example the TEST rows created while testing),
-- otherwise creating a unique index fails:
--
--   delete from public.experts where full_name like 'TEST%';
--   alter sequence public.expert_id_seq restart with 1;   -- only if the table is now empty

create unique index if not exists experts_email_key on public.experts (lower(email)) where email is not null;
create unique index if not exists experts_phone_key on public.experts (phone) where phone is not null;

-- Check afterwards. Both indexes must be listed:
--   select indexname from pg_indexes where schemaname = 'public' and tablename = 'experts';
