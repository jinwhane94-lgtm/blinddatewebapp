SELECT
  to_regprocedure('private.require_member()') IS NOT NULL AS membership_check_exists,
  to_regclass('public.dating_profiles') IS NOT NULL AS profile_table_exists,
  to_regclass('public.coordinators') IS NOT NULL AS coordinator_table_exists,
  to_regnamespace('listing_api') IS NOT NULL AS listing_schema_exists,
  to_regprocedure('public.browse_approved_profiles(text,integer,integer,text,integer)') IS NOT NULL AS browse_rpc_exists,
  EXISTS (
    SELECT 1 FROM pg_roles r, unnest(r.rolconfig) setting
    WHERE r.rolname = 'authenticator' AND setting LIKE 'pgrst.db_schemas=%'
      AND 'listing_api' = ANY(string_to_array(replace(split_part(setting,'=',2),' ',''),','))
  ) AS listing_schema_explicitly_exposed;
