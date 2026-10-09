-- Length backstop for the registration fields. The form already stops typing at 120 to 300 characters
-- (see FIELD_LIMITS in src/lib/form.ts); these limits are wider and exist so that nobody can store an enormous value
-- by calling the public function directly.
--
-- Additive and safe to re-run: no data is changed, nothing is dropped except an older copy of the same constraint,
-- and every value the form can send today is far inside the limits. An older cached copy of the form keeps working.

alter table public.experts drop constraint if exists experts_len_full_name;
alter table public.experts drop constraint if exists experts_len_organisation;
alter table public.experts drop constraint if exists experts_len_position;
alter table public.experts drop constraint if exists experts_len_email;
alter table public.experts drop constraint if exists experts_len_phone;
alter table public.experts drop constraint if exists experts_len_profile_url;
alter table public.experts drop constraint if exists experts_len_nes_number;
alter table public.experts drop constraint if exists experts_len_iepn_status;

alter table public.experts add constraint experts_len_full_name check (char_length(full_name) <= 200);
alter table public.experts add constraint experts_len_organisation check (char_length(organisation) <= 300);
alter table public.experts add constraint experts_len_position check (char_length(position) <= 200);
alter table public.experts add constraint experts_len_email check (char_length(email) <= 320);
alter table public.experts add constraint experts_len_phone check (phone is null or char_length(phone) <= 40);
alter table public.experts add constraint experts_len_profile_url check (profile_url is null or char_length(profile_url) <= 600);
alter table public.experts add constraint experts_len_nes_number check (nes_number is null or char_length(nes_number) <= 100);
alter table public.experts add constraint experts_len_iepn_status check (iepn_status is null or char_length(iepn_status) <= 200);
