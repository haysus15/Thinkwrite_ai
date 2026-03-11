-- Sprint A cleanup: canonical chamber table is public.voice_chambers.
-- Drop legacy public.voice_profiles_chambers only when it is safe (empty).

do $$
declare
  legacy_exists boolean;
  legacy_count bigint;
begin
  select to_regclass('public.voice_profiles_chambers') is not null into legacy_exists;

  if not legacy_exists then
    raise notice 'Legacy table public.voice_profiles_chambers does not exist. Nothing to clean up.';
    return;
  end if;

  execute 'select count(*) from public.voice_profiles_chambers' into legacy_count;

  if legacy_count = 0 then
    execute 'drop table public.voice_profiles_chambers';
    raise notice 'Dropped empty legacy table public.voice_profiles_chambers.';
  else
    raise notice 'Legacy table public.voice_profiles_chambers has % rows; not dropping automatically.', legacy_count;
  end if;
end
$$;
