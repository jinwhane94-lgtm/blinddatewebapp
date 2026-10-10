-- PHASE 3. Apply only after 001, 002 and 003 have been reconciled/applied.
-- No existing profile is assigned to an Auth account automatically.
BEGIN;

DO $$ BEGIN
  IF to_regclass('private.profile_contacts') IS NULL
     OR to_regclass('public.likes') IS NULL
     OR to_regclass('private.notification_logs') IS NULL THEN
    RAISE EXCEPTION 'PHASE3_PREREQUISITE: reconcile migration history and apply 003 first';
  END IF;
END $$;

CREATE TABLE private.profile_owners (
  profile_id uuid PRIMARY KEY REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  linked_at timestamptz NOT NULL DEFAULT now(),
  link_method text NOT NULL DEFAULT 'registration' CHECK (link_method IN ('registration', 'reviewed_legacy'))
);
ALTER TABLE private.profile_owners ADD CONSTRAINT profile_owners_pair_unique UNIQUE(profile_id,user_id);

ALTER TABLE private.profile_contacts ADD COLUMN kakao_id text
  CHECK (kakao_id IS NULL OR length(btrim(kakao_id)) BETWEEN 1 AND 100);

CREATE TABLE private.like_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_low uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  profile_high uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'mutual' CHECK (status IN ('mutual', 'final', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (profile_low < profile_high),
  CHECK ((status = 'mutual') = (resolved_at IS NULL)),
  UNIQUE (profile_low, profile_high)
);
CREATE INDEX matches_profile_high_idx ON public.matches(profile_high, created_at DESC);

CREATE TABLE private.match_decisions (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'match', 'sorry')),
  decided_at timestamptz,
  PRIMARY KEY (match_id, profile_id),
  CHECK ((decision = 'pending') = (decided_at IS NULL))
);
CREATE INDEX match_decisions_profile_idx ON private.match_decisions(profile_id);

CREATE TABLE private.profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  object_path text NOT NULL UNIQUE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profile_photos_position_idx ON private.profile_photos(profile_id, position)
  WHERE status <> 'removed';

CREATE TABLE private.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  product text NOT NULL DEFAULT 'likes_10' CHECK (product = 'likes_10'),
  amount integer NOT NULL DEFAULT 1500 CHECK (amount = 1500),
  like_quantity integer NOT NULL DEFAULT 10 CHECK (like_quantity = 10),
  currency text NOT NULL DEFAULT 'KRW' CHECK (currency = 'KRW'),
  provider text NOT NULL DEFAULT 'kakaopay' CHECK (provider = 'kakaopay'),
  environment text NOT NULL CHECK (environment IN ('test', 'live')),
  merchant_id text NOT NULL,
  provider_payment_id text,
  request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN
    ('created', 'ready', 'approving', 'verification_pending', 'approved', 'failed', 'cancelled', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  credited_at timestamptz,
  FOREIGN KEY (profile_id,user_id) REFERENCES private.profile_owners(profile_id,user_id) ON DELETE RESTRICT,
  UNIQUE (user_id, request_id),
  UNIQUE (provider, environment, merchant_id, provider_payment_id),
  CHECK (credited_at IS NULL OR approved_at IS NOT NULL)
);
CREATE INDEX payments_profile_idx ON private.payments(profile_id);
CREATE INDEX payments_user_created_idx ON private.payments(user_id, created_at DESC);

CREATE TABLE private.like_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES private.like_wallets(user_id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('purchase', 'sent_like', 'refund', 'admin_adjustment')),
  delta integer NOT NULL CHECK (delta <> 0),
  payment_id uuid REFERENCES private.payments(id) ON DELETE RESTRICT,
  like_id uuid REFERENCES public.likes(id) ON DELETE RESTRICT,
  operation_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'purchase' AND delta = 10 AND payment_id IS NOT NULL AND like_id IS NULL AND operation_id IS NULL)
    OR (kind = 'sent_like' AND delta = -1 AND like_id IS NOT NULL AND payment_id IS NULL AND operation_id IS NULL)
    OR (kind = 'refund' AND delta < 0 AND payment_id IS NOT NULL AND like_id IS NULL AND operation_id IS NOT NULL)
    OR (kind = 'admin_adjustment' AND payment_id IS NULL AND like_id IS NULL AND operation_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX like_transactions_purchase_once ON private.like_transactions(payment_id) WHERE kind = 'purchase';
CREATE UNIQUE INDEX like_transactions_like_once ON private.like_transactions(like_id) WHERE kind = 'sent_like';
CREATE INDEX like_transactions_user_created_idx ON private.like_transactions(user_id, created_at DESC);
CREATE INDEX like_transactions_payment_idx ON private.like_transactions(payment_id);

-- Future operations access remains closed until server endpoints are implemented.
CREATE TABLE private.admin_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE private.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  profile_id uuid REFERENCES public.dating_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_actor_idx ON private.admin_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX admin_audit_profile_idx ON private.admin_audit_logs(profile_id);

CREATE FUNCTION private.guard_profile_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'OWNERSHIP_TRANSFER_FORBIDDEN';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_owner_immutable BEFORE UPDATE ON private.profile_owners
  FOR EACH ROW EXECUTE FUNCTION private.guard_profile_owner();

CREATE FUNCTION private.guard_match_decision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id = NEW.match_id
    AND NEW.profile_id IN (profile_low,profile_high)) THEN
    RAISE EXCEPTION 'MATCH_PARTICIPANT_REQUIRED';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.match_id IS DISTINCT FROM OLD.match_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR (OLD.decision <> 'pending' AND NEW IS DISTINCT FROM OLD) THEN
      RAISE EXCEPTION 'DECISION_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER match_decision_guard BEFORE INSERT OR UPDATE ON private.match_decisions
  FOR EACH ROW EXECUTE FUNCTION private.guard_match_decision();

CREATE FUNCTION private.guard_ledger() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'LEDGER_APPEND_ONLY';
END $$;
CREATE TRIGGER like_transactions_append_only BEFORE UPDATE OR DELETE ON private.like_transactions
  FOR EACH ROW EXECUTE FUNCTION private.guard_ledger();

ALTER TABLE private.notification_logs ALTER COLUMN like_id DROP NOT NULL;
ALTER TABLE private.notification_logs ADD COLUMN match_id uuid REFERENCES public.matches(id) ON DELETE RESTRICT;
ALTER TABLE private.notification_logs DROP CONSTRAINT notification_logs_type_check;
ALTER TABLE private.notification_logs ADD CONSTRAINT notification_logs_type_check CHECK
  (notification_type IN ('kakao_alimtalk_like_received', 'MUTUAL_LIKE', 'FINAL_MATCH'));
ALTER TABLE private.notification_logs ADD CONSTRAINT notification_logs_source_check CHECK (
  (notification_type = 'kakao_alimtalk_like_received' AND like_id IS NOT NULL AND match_id IS NULL)
  OR (notification_type IN ('MUTUAL_LIKE', 'FINAL_MATCH') AND like_id IS NULL AND match_id IS NOT NULL)
);
CREATE UNIQUE INDEX notification_logs_match_recipient_once
  ON private.notification_logs(match_id, notification_type, recipient_id) WHERE match_id IS NOT NULL;
CREATE INDEX notification_logs_pending_idx ON private.notification_logs(created_at) WHERE status = 'pending';

CREATE INDEX dating_profiles_coordinator_idx ON public.dating_profiles(coordinator_id, created_at DESC);
CREATE INDEX dating_profiles_reviewed_by_idx ON public.dating_profiles(reviewed_by);
CREATE INDEX dating_profiles_browse_idx ON public.dating_profiles(gender, created_at DESC, id) WHERE status = 'approved';
CREATE INDEX coordinators_auth_user_idx ON public.coordinators(auth_user_id) WHERE active;

-- RLS plus no browser schema/table grants. Browser APIs below return projections.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profile_owners','like_wallets','match_decisions','profile_photos',
    'payments','like_transactions','admin_members','admin_audit_logs'] LOOP
    EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.matches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.likes FROM PUBLIC, anon, authenticated;

-- Check the current Auth account, not client claims about a profile or email.
-- MVP deliberately has no email_confirmed_at gate: Auth controls sign-in policy.
CREATE FUNCTION private.require_member() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = u AND NOT coalesce(is_anonymous, false)
      AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until <= now())
      AND nullif(email, '') IS NOT NULL
  ) THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  RETURN u;
END $$;

CREATE FUNCTION private.my_profile() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := private.require_member(); p uuid;
BEGIN
  SELECT profile_id INTO p FROM private.profile_owners WHERE user_id = u AND active;
  IF p IS NULL THEN RAISE EXCEPTION 'PROFILE_REQUIRED' USING ERRCODE = '42501'; END IF;
  RETURN p;
END $$;

-- Public RPCs are deliberately small privileged entry points. Each checks its
-- caller inside the function and has an explicit EXECUTE allowlist below.
CREATE FUNCTION public.get_my_profile_id() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := private.require_member(); p uuid;
BEGIN
  SELECT profile_id INTO p FROM private.profile_owners WHERE user_id = u AND active;
  RETURN p;
END $$;

CREATE FUNCTION public.is_current_account_active() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.require_member();
  RETURN true;
END $$;

CREATE FUNCTION public.list_active_coordinators() RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id, name FROM public.coordinators WHERE active ORDER BY name, id;
$$;

DROP POLICY "anyone can read active coordinator names" ON public.coordinators;
CREATE POLICY "coordinator reads own account" ON public.coordinators FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) AND active AND (SELECT public.is_current_account_active()));
REVOKE ALL ON public.coordinators FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.coordinators FROM authenticated;
GRANT SELECT ON public.coordinators TO authenticated;
DROP POLICY "coordinator can update own profiles" ON public.dating_profiles;
DROP POLICY "coordinator can select own profiles" ON public.dating_profiles;
CREATE POLICY "coordinator can select own profiles" ON public.dating_profiles FOR SELECT TO authenticated
  USING ((SELECT public.is_current_account_active()) AND coordinator_id IN (
    SELECT id FROM public.coordinators WHERE auth_user_id = (SELECT auth.uid()) AND active
  ));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dating_profiles FROM anon, authenticated;

CREATE FUNCTION public.review_dating_profile(p_profile_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := private.require_member(); c uuid;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'INVALID_REVIEW';
  END IF;
  SELECT dp.coordinator_id INTO c FROM public.dating_profiles dp
    JOIN public.coordinators co ON co.id = dp.coordinator_id
    WHERE dp.id = p_profile_id AND co.auth_user_id = u AND co.active FOR UPDATE OF dp;
  IF c IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_AVAILABLE' USING ERRCODE = '42501'; END IF;
  UPDATE public.dating_profiles SET status = p_status, reviewed_by = c, reviewed_at = now(),
    rejection_reason = CASE WHEN p_status = 'rejected' THEN left(p_reason, 1000) ELSE NULL END
    WHERE id = p_profile_id;
END $$;

-- Preserve 003's atomic contact insert as an internal implementation only.
ALTER FUNCTION public.submit_dating_profile(uuid,text,text,integer,text,integer,text,text[],text[],text[],
  integer,integer,boolean,integer,integer,boolean,text[],text[],text[],text[],text[],text[],text,text,boolean)
  SET SCHEMA private;
ALTER FUNCTION private.submit_dating_profile(uuid,text,text,integer,text,integer,text,text[],text[],text[],
  integer,integer,boolean,integer,integer,boolean,text[],text[],text[],text[],text[],text[],text,text,boolean)
  RENAME TO insert_dating_profile;

CREATE FUNCTION private.valid_profile_values(p_values text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(array_ndims(p_values) = 1 AND cardinality(p_values) BETWEEN 1 AND 30
    AND NOT EXISTS (SELECT 1 FROM unnest(p_values) v WHERE v IS NULL OR length(btrim(v)) NOT BETWEEN 1 AND 100), false);
$$;

CREATE FUNCTION public.submit_dating_profile(
  p_coordinator_id uuid, p_nickname text, p_gender text, p_age integer, p_company text,
  p_height_cm integer, p_mbti text, p_preferred_skin_types text[], p_preferred_animal_types text[],
  p_preferred_face_types text[], p_preferred_age_min integer, p_preferred_age_max integer,
  p_preferred_age_any boolean, p_preferred_height_min integer, p_preferred_height_max integer,
  p_preferred_height_any boolean, p_preferred_body_types text[], p_preferred_traits text[],
  p_self_skin_types text[], p_self_animal_types text[], p_self_face_types text[], p_self_traits text[],
  p_self_body_type text, p_phone_number text, p_kakao_notification_enabled boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := private.require_member(); p uuid;
BEGIN
  -- Serializes registration attempts for this account. UNIQUE remains the backstop.
  PERFORM 1 FROM auth.users WHERE id = u FOR UPDATE;
  IF EXISTS (SELECT 1 FROM private.profile_owners WHERE user_id = u) THEN
    RAISE EXCEPTION 'PROFILE_ALREADY_EXISTS' USING ERRCODE = '23505';
  END IF;
  IF coalesce(length(btrim(p_nickname)),0) NOT BETWEEN 1 AND 20
    OR coalesce(length(btrim(p_company)),0) NOT BETWEEN 1 AND 200
    OR p_mbti IS NULL OR p_mbti !~ '^[EI][NS][FT][JP]$'
    OR (NOT p_preferred_age_any AND (p_preferred_age_min IS NULL OR p_preferred_age_max IS NULL
      OR p_preferred_age_min > p_preferred_age_max))
    OR (NOT p_preferred_height_any AND (p_preferred_height_min IS NULL OR p_preferred_height_max IS NULL
      OR p_preferred_height_min > p_preferred_height_max)) THEN
    RAISE EXCEPTION 'INVALID_PROFILE';
  END IF;
  IF NOT private.valid_profile_values(p_preferred_skin_types)
    OR NOT private.valid_profile_values(p_preferred_animal_types)
    OR NOT private.valid_profile_values(p_preferred_face_types)
    OR NOT private.valid_profile_values(p_preferred_body_types)
    OR NOT private.valid_profile_values(p_preferred_traits)
    OR NOT private.valid_profile_values(p_self_skin_types)
    OR NOT private.valid_profile_values(p_self_animal_types)
    OR NOT private.valid_profile_values(p_self_face_types)
    OR NOT private.valid_profile_values(p_self_traits)
    OR coalesce(length(btrim(p_self_body_type)),0) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'INVALID_PROFILE';
  END IF;
  p := private.insert_dating_profile(p_coordinator_id,p_nickname,p_gender,p_age,p_company,
    p_height_cm,p_mbti,p_preferred_skin_types,p_preferred_animal_types,p_preferred_face_types,
    p_preferred_age_min,p_preferred_age_max,p_preferred_age_any,p_preferred_height_min,
    p_preferred_height_max,p_preferred_height_any,p_preferred_body_types,p_preferred_traits,
    p_self_skin_types,p_self_animal_types,p_self_face_types,p_self_traits,p_self_body_type,
    p_phone_number,p_kakao_notification_enabled);
  INSERT INTO private.profile_owners(profile_id,user_id) VALUES(p,u);
  INSERT INTO private.like_wallets(user_id) VALUES(u);
  RETURN p;
END $$;

CREATE FUNCTION public.get_my_like_balance() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p uuid := private.my_profile(); b integer;
BEGIN
  SELECT w.balance INTO STRICT b FROM private.like_wallets w
    JOIN private.profile_owners o ON o.user_id = w.user_id WHERE o.profile_id = p;
  RETURN b;
END $$;

-- Out-of-band identity review is mandatory. Email equality is never proof of
-- ownership, especially when email confirmation is disabled in Auth.
CREATE FUNCTION public.link_reviewed_legacy_profile(p_profile_id uuid, p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := private.require_member();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_members WHERE user_id = actor AND active) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM auth.users WHERE id = p_user_id AND NOT coalesce(is_anonymous,false)
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until <= now())
    AND nullif(email,'') IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_AVAILABLE'; END IF;
  PERFORM 1 FROM public.dating_profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_AVAILABLE'; END IF;
  INSERT INTO private.profile_owners(profile_id,user_id,link_method)
    VALUES(p_profile_id,p_user_id,'reviewed_legacy');
  INSERT INTO private.like_wallets(user_id) VALUES(p_user_id);
  INSERT INTO private.admin_audit_logs(actor_user_id,action,profile_id)
    VALUES(actor,'link_reviewed_legacy_profile',p_profile_id);
END $$;

CREATE FUNCTION public.send_like(p_target_profile_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sender uuid := private.my_profile(); u uuid := auth.uid(); l uuid; m uuid;
  lo uuid; hi uuid;
BEGIN
  IF p_target_profile_id IS NULL OR sender = p_target_profile_id THEN RAISE EXCEPTION 'INVALID_TARGET'; END IF;
  lo := least(sender,p_target_profile_id); hi := greatest(sender,p_target_profile_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lo::text || ':' || hi::text,0));
  -- All profile locks are ordered, including reciprocal requests.
  PERFORM 1 FROM public.dating_profiles WHERE id IN (lo,hi) ORDER BY id FOR SHARE;
  PERFORM 1 FROM private.profile_owners WHERE profile_id IN (lo,hi) ORDER BY profile_id FOR SHARE;
  IF NOT EXISTS (
    SELECT 1 FROM public.dating_profiles a JOIN public.dating_profiles b ON b.id = p_target_profile_id
      JOIN private.profile_owners bo ON bo.profile_id = b.id AND bo.active
      JOIN auth.users bu ON bu.id = bo.user_id AND NOT coalesce(bu.is_anonymous,false)
        AND bu.deleted_at IS NULL AND (bu.banned_until IS NULL OR bu.banned_until <= now())
      JOIN private.profile_owners ao ON ao.profile_id = a.id AND ao.active AND ao.user_id = u
    WHERE a.id = sender AND a.status = 'approved' AND b.status = 'approved' AND a.gender <> b.gender
  ) THEN RAISE EXCEPTION 'PROFILE_NOT_AVAILABLE' USING ERRCODE = '42501'; END IF;
  SELECT id INTO l FROM public.likes WHERE sender_profile_id = sender AND recipient_profile_id = p_target_profile_id;
  IF l IS NOT NULL THEN RETURN l; END IF;
  UPDATE private.like_wallets SET balance = balance - 1, updated_at = now()
    WHERE user_id = u AND balance >= 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_LIKES'; END IF;
  INSERT INTO public.likes(sender_profile_id,recipient_profile_id) VALUES(sender,p_target_profile_id) RETURNING id INTO l;
  INSERT INTO private.like_transactions(user_id,kind,delta,like_id) VALUES(u,'sent_like',-1,l);
  INSERT INTO private.notification_logs(like_id,recipient_id) VALUES(l,p_target_profile_id);
  IF EXISTS (SELECT 1 FROM public.likes WHERE sender_profile_id = p_target_profile_id AND recipient_profile_id = sender) THEN
    INSERT INTO public.matches(profile_low,profile_high) VALUES(lo,hi)
      ON CONFLICT (profile_low,profile_high) DO NOTHING RETURNING id INTO m;
    IF m IS NOT NULL THEN
      INSERT INTO private.match_decisions(match_id,profile_id) VALUES(m,lo),(m,hi);
      INSERT INTO private.notification_logs(match_id,recipient_id,notification_type)
        VALUES(m,lo,'MUTUAL_LIKE'),(m,hi,'MUTUAL_LIKE');
    END IF;
  END IF;
  RETURN l;
END $$;

-- No public payment credit API or storage path API in PHASE 3. Those are enabled
-- only when the validating server endpoints are implemented in later phases.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_profile_id(), public.list_active_coordinators(),
  public.review_dating_profile(uuid,text,text), public.get_my_like_balance(), public.send_like(uuid),
  public.link_reviewed_legacy_profile(uuid,uuid), public.is_current_account_active()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_dating_profile(uuid,text,text,integer,text,integer,text,text[],text[],text[],
  integer,integer,boolean,integer,integer,boolean,text[],text[],text[],text[],text[],text[],text,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_active_coordinators() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id(), public.review_dating_profile(uuid,text,text),
  public.get_my_like_balance(), public.send_like(uuid), public.link_reviewed_legacy_profile(uuid,uuid),
  public.is_current_account_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_dating_profile(uuid,text,text,integer,text,integer,text,text[],text[],text[],
  integer,integer,boolean,integer,integer,boolean,text[],text[],text[],text[],text[],text[],text,text,boolean)
  TO authenticated;

COMMIT;
