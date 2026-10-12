-- For the admin CSV export: every expert's declared memberships and affiliations, by name only.
-- No membership number and no licence detail is returned: those never go into the default export.
-- Additive: one new function, admin only.
create or replace function public.admin_affiliations_summary()
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
    select jsonb_object_agg(t.expert_id, t.items)
      from (
        select a.expert_id,
               jsonb_agg(jsonb_build_object('name', i.name, 'acronym', i.acronym, 'kind', a.kind, 'pending', i.status = 'pending')
                         order by a.kind, lower(i.name)) as items
          from public.expert_affiliations a
          join public.institutions i on i.id = a.institution_id
         group by a.expert_id
      ) t), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_affiliations_summary() from public, anon, authenticated;
grant execute on function public.admin_affiliations_summary() to authenticated;
