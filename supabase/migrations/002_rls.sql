-- ==========================================
-- Migration 002: Row Level Security Policies
-- ==========================================

-- Enable RLS
ALTER TABLE public.coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dating_profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- coordinators RLS
-- ==========================================

-- Anyone can read coordinator id + name (for public dropdown)
CREATE POLICY "anyone can read active coordinator names"
  ON public.coordinators
  FOR SELECT
  USING (active = true);

-- No one can insert/update/delete coordinators via client
-- (done only via service role key / server-side script)

-- ==========================================
-- dating_profiles RLS
-- ==========================================

-- Anonymous users: INSERT only (status forced to 'pending' in app + check constraint)
CREATE POLICY "anon can insert profiles"
  ON public.dating_profiles
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');

-- Authenticated coordinators: SELECT only their own profiles
CREATE POLICY "coordinator can select own profiles"
  ON public.dating_profiles
  FOR SELECT
  TO authenticated
  USING (
    coordinator_id IN (
      SELECT id FROM public.coordinators
      WHERE auth_user_id = auth.uid()
        AND active = true
    )
  );

-- Authenticated coordinators: UPDATE only their own profiles (status fields only)
CREATE POLICY "coordinator can update own profiles"
  ON public.dating_profiles
  FOR UPDATE
  TO authenticated
  USING (
    coordinator_id IN (
      SELECT id FROM public.coordinators
      WHERE auth_user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    coordinator_id IN (
      SELECT id FROM public.coordinators
      WHERE auth_user_id = auth.uid()
        AND active = true
    )
  );

-- No DELETE for anyone via client
-- (only via service role if needed)
