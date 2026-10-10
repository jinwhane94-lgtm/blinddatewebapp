-- Revoke only the three client MAINTAIN privileges approved for PHASE 3.6.
-- Keep SELECT, RPC grants, RLS, data and server-role privileges unchanged.
BEGIN;

REVOKE MAINTAIN ON TABLE public.coordinators FROM authenticated;
REVOKE MAINTAIN ON TABLE public.dating_profiles FROM anon, authenticated;

COMMIT;
