-- Replaces the approved-profile browse RPC without changing profile rows or table RLS.
BEGIN;

DROP FUNCTION public.browse_approved_profiles(text,integer,integer,text,integer);
DROP FUNCTION listing_api.browse_approved_profiles(text,integer,integer,text,integer);

CREATE FUNCTION listing_api.browse_approved_profiles(
  p_age_min integer DEFAULT NULL,
  p_age_max integer DEFAULT NULL,
  p_mbtis text[] DEFAULT '{}',
  p_traits text[] DEFAULT '{}',
  p_face_types text[] DEFAULT '{}',
  p_animal_types text[] DEFAULT '{}',
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
  viewer_profile uuid := private.my_profile();
  viewer_gender text;
  mbtis text[] := coalesce(p_mbtis, '{}'::text[]);
  traits text[] := coalesce(p_traits, '{}'::text[]);
  face_types text[] := coalesce(p_face_types, '{}'::text[]);
  animal_types text[] := coalesce(p_animal_types, '{}'::text[]);
BEGIN
  SELECT dp.gender INTO STRICT viewer_gender
  FROM public.dating_profiles AS dp
  WHERE dp.id = viewer_profile;

  IF (p_age_min IS NOT NULL AND p_age_min NOT BETWEEN 1 AND 120)
     OR (p_age_max IS NOT NULL AND p_age_max NOT BETWEEN 1 AND 120)
     OR (p_age_min IS NOT NULL AND p_age_max IS NOT NULL AND p_age_min > p_age_max)
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
     OR cardinality(mbtis) > 16 OR array_position(mbtis, NULL) IS NOT NULL
     OR cardinality(traits) > 19 OR array_position(traits, NULL) IS NOT NULL
     OR cardinality(face_types) > 2 OR array_position(face_types, NULL) IS NOT NULL
     OR cardinality(animal_types) > 9 OR array_position(animal_types, NULL) IS NOT NULL
     OR NOT mbtis <@ ARRAY['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP',
       'ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ']::text[]
     OR NOT traits <@ ARRAY['착한','다정한','배려심 있는','유머러스한','대화가 잘 통하는',
       '긍정적인','책임감 있는','성실한','자상한','활발한','차분한','리더십 있는',
       '감정 표현이 좋은','독립적인','가족적인','부유한','자기관리가 철저한',
       '취미가 잘 맞는','가치관이 비슷한']::text[]
     OR NOT face_types <@ ARRAY['두부상','아랍상']::text[]
     OR NOT animal_types <@ ARRAY['토끼상','강아지상','고양이상','여우상','사슴상',
       '곰상','공룡상','원숭이상','늑대상']::text[] THEN
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
      AND dp.id <> viewer_profile
      AND dp.gender <> viewer_gender
      AND (p_age_min IS NULL OR dp.age >= p_age_min)
      AND (p_age_max IS NULL OR dp.age <= p_age_max)
      AND (cardinality(mbtis) = 0 OR dp.mbti = ANY(mbtis))
      AND (cardinality(traits) = 0 OR dp.self_traits && traits)
      AND (cardinality(face_types) = 0 OR dp.self_face_types && face_types)
      AND (cardinality(animal_types) = 0 OR dp.self_animal_types && animal_types)
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

REVOKE ALL ON FUNCTION listing_api.browse_approved_profiles(integer,integer,text[],text[],text[],text[],integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listing_api.browse_approved_profiles(integer,integer,text[],text[],text[],text[],integer)
  TO authenticated;

CREATE FUNCTION public.browse_approved_profiles(
  p_age_min integer DEFAULT NULL,
  p_age_max integer DEFAULT NULL,
  p_mbtis text[] DEFAULT '{}',
  p_traits text[] DEFAULT '{}',
  p_face_types text[] DEFAULT '{}',
  p_animal_types text[] DEFAULT '{}',
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT listing_api.browse_approved_profiles(
    p_age_min, p_age_max, p_mbtis, p_traits, p_face_types, p_animal_types, p_offset
  );
$$;

REVOKE ALL ON FUNCTION public.browse_approved_profiles(integer,integer,text[],text[],text[],text[],integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.browse_approved_profiles(integer,integer,text[],text[],text[],text[],integer)
  TO authenticated;

COMMIT;
