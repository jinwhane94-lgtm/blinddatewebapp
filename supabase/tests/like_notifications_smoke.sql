-- Run only against a local or explicitly selected test project after migration 003.
-- The transaction is always rolled back and does not call the external provider.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

SELECT lives_ok($test$
DO $$
DECLARE
  v_coordinator_id uuid := gen_random_uuid();
  v_sender_id uuid := gen_random_uuid();
  v_opted_in_id uuid := gen_random_uuid();
  v_opted_out_id uuid := gen_random_uuid();
  v_missing_contact_id uuid := gen_random_uuid();
  v_opted_in_like_id uuid := gen_random_uuid();
  v_opted_out_like_id uuid := gen_random_uuid();
  v_missing_contact_like_id uuid := gen_random_uuid();
  v_claim record;
BEGIN
  IF pg_catalog.has_table_privilege('anon', 'private.profile_contacts', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'private.profile_contacts', 'SELECT') THEN
    RAISE EXCEPTION 'profile_contacts must not be readable by browser roles';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'private.notification_logs', 'SELECT')
     OR pg_catalog.has_table_privilege('authenticated', 'private.notification_logs', 'SELECT') THEN
    RAISE EXCEPTION 'notification_logs must not be readable by browser roles';
  END IF;

  INSERT INTO public.coordinators (id, name, email)
  VALUES (v_coordinator_id, 'notification-test', concat(v_coordinator_id, '@example.invalid'));

  INSERT INTO public.dating_profiles (id, coordinator_id, nickname, gender, age, company, height_cm, mbti)
  VALUES
    (v_sender_id, v_coordinator_id, 'sender', '남', 30, 'test', 175, 'ENFP'),
    (v_opted_in_id, v_coordinator_id, 'opted-in', '여', 30, 'test', 165, 'ENFP'),
    (v_opted_out_id, v_coordinator_id, 'opted-out', '여', 30, 'test', 165, 'ENFP'),
    (v_missing_contact_id, v_coordinator_id, 'missing-contact', '여', 30, 'test', 165, 'ENFP');

  INSERT INTO private.profile_contacts (profile_id, phone_number, kakao_notification_enabled)
  VALUES
    (v_opted_in_id, '01012345678', true),
    (v_opted_out_id, '01087654321', false);

  INSERT INTO public.likes (id, sender_profile_id, recipient_profile_id)
  VALUES
    (v_opted_in_like_id, v_sender_id, v_opted_in_id),
    (v_opted_out_like_id, v_sender_id, v_opted_out_id),
    (v_missing_contact_like_id, v_sender_id, v_missing_contact_id);

  SELECT * INTO v_claim FROM public.claim_like_notification(v_opted_out_like_id);
  IF v_claim.should_send OR v_claim.skip_reason <> 'not_opted_in' THEN
    RAISE EXCEPTION 'opted-out recipient was not skipped';
  END IF;

  SELECT * INTO v_claim FROM public.claim_like_notification(v_missing_contact_like_id);
  IF v_claim.should_send OR v_claim.skip_reason <> 'missing_phone' THEN
    RAISE EXCEPTION 'recipient without a phone number was not skipped';
  END IF;

  SELECT * INTO v_claim FROM public.claim_like_notification(v_opted_in_like_id);
  IF NOT v_claim.should_send OR v_claim.phone_number <> '01012345678' THEN
    RAISE EXCEPTION 'opted-in recipient was not claimed';
  END IF;

  PERFORM public.finish_like_notification(v_claim.log_id, 'failed', NULL, 'simulated provider rejection');

  SELECT * INTO v_claim FROM public.claim_like_notification(v_opted_in_like_id);
  IF NOT v_claim.should_send THEN
    RAISE EXCEPTION 'a definite provider rejection should be manually retryable';
  END IF;

  -- A processing claim cannot be claimed again, preventing webhook retries from
  -- producing another send while provider delivery is uncertain.
  SELECT * INTO v_claim FROM public.claim_like_notification(v_opted_in_like_id);
  IF v_claim.should_send OR v_claim.skip_reason <> 'processing' THEN
    RAISE EXCEPTION 'duplicate claim was not blocked';
  END IF;

  BEGIN
    INSERT INTO public.likes (sender_profile_id, recipient_profile_id)
    VALUES (v_sender_id, v_opted_in_id);
    RAISE EXCEPTION 'duplicate like was unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.likes WHERE id = v_opted_in_like_id) THEN
    RAISE EXCEPTION 'like disappeared after simulated notification failure';
  END IF;
END;
$$;
$test$, 'like notification privacy, consent, idempotency, and failure isolation');

SELECT * FROM finish();

ROLLBACK;
