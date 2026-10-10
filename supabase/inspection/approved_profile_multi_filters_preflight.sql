SELECT
  to_regprocedure('private.my_profile()') IS NOT NULL AS owned_profile_check_exists,
  to_regprocedure('public.browse_approved_profiles(text,integer,integer,text,integer)') IS NOT NULL AS current_browse_rpc_exists,
  to_regprocedure('public.browse_approved_profiles(integer,integer,text[],text[],text[],text[],integer)') IS NOT NULL AS new_browse_rpc_exists,
  to_regclass('private.profile_owners') IS NOT NULL AS profile_owners_exists,
  to_regclass('public.dating_profiles') IS NOT NULL AS profile_table_exists;
