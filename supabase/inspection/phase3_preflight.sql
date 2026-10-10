-- READ ONLY. Catalog metadata only; no profile/contact/Auth user rows.
-- Run each SELECT separately if the SQL client returns only the last result.
SELECT n.nspname AS schema_name, c.relname, c.relrowsecurity, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind='r'
ORDER BY 1,2;

SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema IN ('public','private')
ORDER BY table_schema,table_name,ordinal_position;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','private','storage');

SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private');

SELECT schemaname,tablename,indexname,indexdef
FROM pg_indexes WHERE schemaname IN ('public','private');

-- Trigger names only: webhook trigger arguments may contain credentials.
SELECT n.nspname,c.relname,t.tgname,t.tgenabled,p.proname
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname IN ('public','private');

SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.proname IN
  ('submit_dating_profile','insert_dating_profile','claim_like_notification','finish_like_notification',
   'get_my_profile_id','get_my_like_balance','send_like','review_dating_profile','list_active_coordinators',
   'link_reviewed_legacy_profile','is_current_account_active');

SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history_table;
-- Use CLI/MCP migration list to inspect versions. Do not repair history here.
