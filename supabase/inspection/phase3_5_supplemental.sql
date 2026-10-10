-- READ ONLY: supplemental catalog checks not covered by the recovered preflight.
-- No profile/contact/Auth user rows, credentials, trigger arguments or job bodies.
SELECT jsonb_build_object(
  'comments', (
    SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'comment', obj_description(c.oid, 'pg_class')))
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('coordinators', 'dating_profiles')
  ),
  'standalone_types', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'type', t.typname, 'kind', t.typtype)), '[]'::jsonb)
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('public', 'private') AND t.typrelid = 0 AND t.typelem = 0
  ),
  'column_acls', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'column', a.attname, 'acl', a.attacl::text)), '[]'::jsonb)
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'private') AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  ),
  'event_triggers', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('name', evtname, 'event', evtevent, 'enabled', evtenabled, 'tags', evttags)), '[]'::jsonb)
    FROM pg_event_trigger
  ),
  'auth_uid', (
    SELECT jsonb_build_object('result', pg_get_function_result(p.oid), 'arguments', pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid' AND p.pronargs = 0
  ),
  'owner_capabilities', jsonb_build_object(
    'postgres_create_public', has_schema_privilege('postgres', 'public', 'CREATE'),
    'postgres_create_database', has_database_privilege('postgres', current_database(), 'CREATE'),
    'postgres_read_auth_users', has_table_privilege('postgres', 'auth.users', 'SELECT'),
    'anon_member_authenticated', pg_has_role('anon', 'authenticated', 'MEMBER')
  )
) AS supplemental_metadata;
