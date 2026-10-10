-- Approved and applied on 2026-10-10. Retained review copy; do not reapply.
-- Canonical migration: ../migrations/20261010140855_approved_profile_browse.sql
-- Does not change existing table grants, RLS policies, or profile data.
BEGIN;

-- Keep privileged projection logic out of the exposed public schema.
CREATE SCHEMA listing_api;
REVOKE ALL ON SCHEMA listing_api FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA listing_api TO authenticated;

CREATE FUNCTION listing_api.browse_approved_profiles(
  p_gender text DEFAULT NULL,
  p_age_min integer DEFAULT NULL,
  p_age_max integer DEFAULT NULL,
  p_search text DEFAULT '',
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; search_text text := lower(btrim(coalesce(p_search, '')));
BEGIN
  PERFORM private.require_member();
  IF (p_gender IS NOT NULL AND p_gender NOT IN ('남', '여'))
     OR (p_age_min IS NOT NULL AND p_age_min NOT BETWEEN 0 AND 120)
     OR (p_age_max IS NOT NULL AND p_age_max NOT BETWEEN 0 AND 120)
     OR (p_age_min IS NOT NULL AND p_age_max IS NOT NULL AND p_age_min > p_age_max)
     OR length(search_text) > 100
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'INVALID_BROWSE_FILTER' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT dp.id, dp.nickname, dp.gender, dp.age, dp.company, dp.height_cm, dp.mbti,
      dp.self_skin_types, dp.self_animal_types, dp.self_face_types, dp.self_traits,
      dp.self_body_type, dp.preferred_age_any, dp.preferred_age_min, dp.preferred_age_max,
      dp.preferred_height_any, dp.preferred_height_min, dp.preferred_height_max,
      dp.preferred_traits, dp.created_at, dp.status
    FROM public.dating_profiles AS dp
    JOIN public.coordinators AS co ON co.id = dp.coordinator_id AND co.active
    WHERE dp.status = 'approved'
      AND (p_gender IS NULL OR dp.gender = p_gender)
      AND (p_age_min IS NULL OR dp.age >= p_age_min)
      AND (p_age_max IS NULL OR dp.age <= p_age_max)
      AND (search_text = '' OR strpos(lower(concat_ws(' ', dp.nickname, dp.mbti,
        array_to_string(dp.self_traits, ' '), array_to_string(dp.self_animal_types, ' '),
        array_to_string(dp.self_face_types, ' '))), search_text) > 0)
    ORDER BY dp.created_at DESC, dp.id DESC
    LIMIT 25 OFFSET p_offset
  ), page AS (
    SELECT * FROM candidates ORDER BY created_at DESC, id DESC LIMIT 24
  )
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id DESC) FROM page), '[]'::jsonb),
    'has_more', (SELECT count(*) > 24 FROM candidates)
  ) INTO result;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION listing_api.browse_approved_profiles(text,integer,integer,text,integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listing_api.browse_approved_profiles(text,integer,integer,text,integer)
  TO authenticated;

-- The public entry point has no elevated privileges of its own.
CREATE FUNCTION public.browse_approved_profiles(
  p_gender text DEFAULT NULL,
  p_age_min integer DEFAULT NULL,
  p_age_max integer DEFAULT NULL,
  p_search text DEFAULT '',
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT listing_api.browse_approved_profiles(p_gender,p_age_min,p_age_max,p_search,p_offset);
$$;

REVOKE ALL ON FUNCTION public.browse_approved_profiles(text,integer,integer,text,integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.browse_approved_profiles(text,integer,integer,text,integer)
  TO authenticated;

COMMIT;
