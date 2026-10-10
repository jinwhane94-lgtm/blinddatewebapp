SELECT
  EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20261010140855') AS migration_recorded,
  (SELECT NOT prosecdef FROM pg_proc
    WHERE oid = 'public.browse_approved_profiles(text,integer,integer,text,integer)'::regprocedure
  ) AS exposed_rpc_is_invoker,
  has_function_privilege('authenticated',
    'public.browse_approved_profiles(text,integer,integer,text,integer)', 'EXECUTE'
  ) AS member_can_execute,
  NOT has_function_privilege('anon',
    'public.browse_approved_profiles(text,integer,integer,text,integer)', 'EXECUTE'
  ) AS anonymous_cannot_execute;
