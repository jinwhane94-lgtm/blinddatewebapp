-- ==========================================
-- Migration 003: Private contacts and like notifications
-- ==========================================

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- Contact data is deliberately separated from public profile rows.
CREATE TABLE private.profile_contacts (
  profile_id uuid PRIMARY KEY REFERENCES public.dating_profiles(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  kakao_notification_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_contacts_phone_number_format
    CHECK (phone_number ~ '^01[016789][0-9]{7,8}$')
);

ALTER TABLE private.profile_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.profile_contacts FROM PUBLIC, anon, authenticated;

-- This table is the server-side source of truth for a like event. There is no
-- browser grant or RLS policy yet because the current app has no end-user auth
-- or ownership model for profile holders.
CREATE TABLE public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile_id uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT likes_distinct_profiles CHECK (sender_profile_id <> recipient_profile_id),
  CONSTRAINT likes_sender_recipient_unique UNIQUE (sender_profile_id, recipient_profile_id)
);

CREATE INDEX likes_recipient_profile_id_created_at_idx
  ON public.likes (recipient_profile_id, created_at DESC);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.likes FROM PUBLIC, anon, authenticated;

CREATE TABLE private.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  like_id uuid NOT NULL REFERENCES public.likes(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.dating_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'kakao_alimtalk_like_received',
  status text NOT NULL DEFAULT 'pending',
  attempts smallint NOT NULL DEFAULT 0,
  provider text,
  provider_message_id text,
  error text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_logs_type_check
    CHECK (notification_type IN ('kakao_alimtalk_like_received')),
  CONSTRAINT notification_logs_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'delivery_unknown')),
  CONSTRAINT notification_logs_attempts_check CHECK (attempts >= 0),
  CONSTRAINT notification_logs_like_type_unique UNIQUE (like_id, notification_type)
);

CREATE INDEX notification_logs_recipient_id_created_at_idx
  ON private.notification_logs (recipient_id, created_at DESC);

CREATE INDEX notification_logs_retryable_idx
  ON private.notification_logs (created_at)
  WHERE status = 'failed';

ALTER TABLE private.notification_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.notification_logs FROM PUBLIC, anon, authenticated;

-- Replace the direct anonymous insert with one narrowly-scoped atomic RPC so
-- profile data and private contact data cannot become partially persisted.
DROP POLICY IF EXISTS "anon can insert profiles" ON public.dating_profiles;
REVOKE INSERT ON public.dating_profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_dating_profile(
  p_coordinator_id uuid,
  p_nickname text,
  p_gender text,
  p_age integer,
  p_company text,
  p_height_cm integer,
  p_mbti text,
  p_preferred_skin_types text[],
  p_preferred_animal_types text[],
  p_preferred_face_types text[],
  p_preferred_age_min integer,
  p_preferred_age_max integer,
  p_preferred_age_any boolean,
  p_preferred_height_min integer,
  p_preferred_height_max integer,
  p_preferred_height_any boolean,
  p_preferred_body_types text[],
  p_preferred_traits text[],
  p_self_skin_types text[],
  p_self_animal_types text[],
  p_self_face_types text[],
  p_self_traits text[],
  p_self_body_type text,
  p_phone_number text,
  p_kakao_notification_enabled boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_phone_number text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.coordinators
    WHERE id = p_coordinator_id
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Selected coordinator is not active';
  END IF;

  v_phone_number := regexp_replace(coalesce(p_phone_number, ''), '[^0-9]', '', 'g');

  IF v_phone_number !~ '^01[016789][0-9]{7,8}$' THEN
    RAISE EXCEPTION 'Invalid Korean mobile phone number';
  END IF;

  INSERT INTO public.dating_profiles (
    coordinator_id, nickname, gender, age, company, height_cm, mbti,
    preferred_skin_types, preferred_animal_types, preferred_face_types,
    preferred_age_min, preferred_age_max, preferred_age_any,
    preferred_height_min, preferred_height_max, preferred_height_any,
    preferred_body_types, preferred_traits, self_skin_types,
    self_animal_types, self_face_types, self_traits, self_body_type, status
  ) VALUES (
    p_coordinator_id, p_nickname, p_gender, p_age, p_company, p_height_cm, p_mbti,
    p_preferred_skin_types, p_preferred_animal_types, p_preferred_face_types,
    CASE WHEN p_preferred_age_any THEN NULL ELSE p_preferred_age_min END,
    CASE WHEN p_preferred_age_any THEN NULL ELSE p_preferred_age_max END,
    p_preferred_age_any,
    CASE WHEN p_preferred_height_any THEN NULL ELSE p_preferred_height_min END,
    CASE WHEN p_preferred_height_any THEN NULL ELSE p_preferred_height_max END,
    p_preferred_height_any,
    p_preferred_body_types, p_preferred_traits, p_self_skin_types,
    p_self_animal_types, p_self_face_types, p_self_traits, p_self_body_type, 'pending'
  )
  RETURNING id INTO v_profile_id;

  INSERT INTO private.profile_contacts (
    profile_id,
    phone_number,
    kakao_notification_enabled
  ) VALUES (
    v_profile_id,
    v_phone_number,
    p_kakao_notification_enabled
  );

  RETURN v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_dating_profile(
  uuid, text, text, integer, text, integer, text, text[], text[], text[],
  integer, integer, boolean, integer, integer, boolean, text[], text[],
  text[], text[], text[], text[], text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_dating_profile(
  uuid, text, text, integer, text, integer, text, text[], text[], text[],
  integer, integer, boolean, integer, integer, boolean, text[], text[],
  text[], text[], text[], text[], text, text, boolean
) TO anon, authenticated;

-- Atomically create/claim one delivery attempt. A row already in processing is
-- never reclaimed automatically: this favors duplicate prevention when a
-- provider accepted a request but the worker lost the response.
CREATE OR REPLACE FUNCTION public.claim_like_notification(p_like_id uuid)
RETURNS TABLE (
  log_id uuid,
  recipient_id uuid,
  phone_number text,
  should_send boolean,
  skip_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recipient_id uuid;
  v_log private.notification_logs%ROWTYPE;
  v_contact private.profile_contacts%ROWTYPE;
BEGIN
  SELECT recipient_profile_id
  INTO v_recipient_id
  FROM public.likes
  WHERE id = p_like_id;

  IF v_recipient_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO private.notification_logs (like_id, recipient_id)
  VALUES (p_like_id, v_recipient_id)
  ON CONFLICT (like_id, notification_type) DO NOTHING;

  SELECT *
  INTO v_log
  FROM private.notification_logs
  WHERE like_id = p_like_id
    AND notification_type = 'kakao_alimtalk_like_received'
  FOR UPDATE;

  IF v_log.status IN ('sent', 'skipped', 'processing', 'delivery_unknown') THEN
    RETURN QUERY SELECT v_log.id, v_recipient_id, NULL::text, false, v_log.status;
    RETURN;
  END IF;

  IF v_log.attempts >= 5 THEN
    UPDATE private.notification_logs
    SET status = 'failed', error = 'Maximum delivery attempts reached', updated_at = now()
    WHERE id = v_log.id;
    RETURN QUERY SELECT v_log.id, v_recipient_id, NULL::text, false, 'max_attempts';
    RETURN;
  END IF;

  SELECT *
  INTO v_contact
  FROM private.profile_contacts
  WHERE profile_id = v_recipient_id;

  IF NOT FOUND OR v_contact.phone_number IS NULL THEN
    UPDATE private.notification_logs
    SET status = 'skipped', error = 'Recipient phone number is missing', updated_at = now()
    WHERE id = v_log.id;
    RETURN QUERY SELECT v_log.id, v_recipient_id, NULL::text, false, 'missing_phone';
    RETURN;
  END IF;

  IF NOT v_contact.kakao_notification_enabled THEN
    UPDATE private.notification_logs
    SET status = 'skipped', error = 'Recipient did not opt in', updated_at = now()
    WHERE id = v_log.id;
    RETURN QUERY SELECT v_log.id, v_recipient_id, NULL::text, false, 'not_opted_in';
    RETURN;
  END IF;

  UPDATE private.notification_logs
  SET status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      provider = 'solapi',
      error = NULL,
      updated_at = now()
  WHERE id = v_log.id;

  RETURN QUERY SELECT v_log.id, v_recipient_id, v_contact.phone_number, true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_like_notification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_like_notification(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_like_notification(
  p_log_id uuid,
  p_status text,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'delivery_unknown') THEN
    RAISE EXCEPTION 'Invalid terminal notification status';
  END IF;

  UPDATE private.notification_logs
  SET status = p_status,
      provider_message_id = p_provider_message_id,
      error = left(p_error, 2000),
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
      updated_at = now()
  WHERE id = p_log_id
    AND status = 'processing';
END;
$$;

REVOKE ALL ON FUNCTION public.finish_like_notification(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_like_notification(uuid, text, text, text)
  TO service_role;

COMMENT ON TABLE private.profile_contacts IS
  'Private phone numbers and Kakao notification consent. Not exposed through the Data API.';
COMMENT ON TABLE private.notification_logs IS
  'Idempotent notification delivery ledger. Accessed only through service-role RPCs.';
COMMENT ON TABLE public.likes IS
  'Server-created like events. Client grants require a future authenticated profile ownership model.';
