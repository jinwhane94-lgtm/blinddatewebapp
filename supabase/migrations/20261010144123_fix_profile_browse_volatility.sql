-- private.my_profile() performs account validation and is VOLATILE. Match the
-- browse functions' volatility declarations to the function they call.
ALTER FUNCTION listing_api.browse_approved_profiles(
  integer, integer, text[], text[], text[], text[], integer
) VOLATILE;

ALTER FUNCTION public.browse_approved_profiles(
  integer, integer, text[], text[], text[], text[], integer
) VOLATILE;
