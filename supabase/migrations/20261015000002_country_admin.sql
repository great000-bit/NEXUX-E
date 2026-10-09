-- Adds the country to the list of experts who are interested in an opportunity (admin only). Same signature, one more
-- key in each result, so the existing admin page keeps working before and after.
create or replace function public.admin_opportunity_interest(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'expert_id', e.expert_id, 'title', e.title, 'full_name', e.full_name, 'organisation', e.organisation,
             'position', e.position, 'country', e.country, 'state', e.state, 'email', e.email, 'phone', e.phone,
             'primary_expertise', e.primary_expertise, 'secondary_expertise', e.secondary_expertise,
             'years_experience', e.years_experience, 'qualification', e.qualification, 'memberships', e.memberships,
             'assignments', e.assignments, 'availability', e.availability, 'profile_url', e.profile_url,
             'verification_status', e.verification_status, 'interested_at', i.created_at)
           order by i.created_at)
      from public.opportunity_interest i
      join public.experts e on e.expert_id = i.expert_id
     where i.opportunity_id = p_id and i.withdrawn_at is null), '[]'::jsonb);
end;
$$;
