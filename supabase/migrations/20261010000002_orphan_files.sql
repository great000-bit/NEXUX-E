-- Stored files that no live record points to. This happens when an expert's record is deleted (which removes
-- the file records but cannot remove the stored objects) or when a removal failed part way.
-- The daily retention job deletes them through the Storage API.
create or replace function public.system_orphan_files()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'expert-evidence'
     and not exists (
       select 1 from public.expert_files f
        where f.storage_path = o.name and f.state <> 'deleted'
     );
$$;

revoke all on function public.system_orphan_files() from public, anon, authenticated;
grant execute on function public.system_orphan_files() to service_role;
