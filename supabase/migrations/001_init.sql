-- ==========================================
-- Migration 001: Initial Schema
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- coordinators table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coordinators IS '주선자 정보 테이블';

-- ==========================================
-- dating_profiles table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.dating_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id uuid NOT NULL REFERENCES public.coordinators(id) ON DELETE RESTRICT,

  -- 기본 정보
  nickname text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('남', '여')),
  age integer NOT NULL CHECK (age > 0),
  company text NOT NULL,
  height_cm integer NOT NULL CHECK (height_cm > 0),
  mbti text NOT NULL,

  -- 선호 외모
  preferred_skin_types text[] NOT NULL DEFAULT '{}',
  preferred_animal_types text[] NOT NULL DEFAULT '{}',
  preferred_face_types text[] NOT NULL DEFAULT '{}',
  preferred_age_min integer CHECK (preferred_age_min IS NULL OR preferred_age_min > 0),
  preferred_age_max integer CHECK (preferred_age_max IS NULL OR preferred_age_max > 0),
  preferred_age_any boolean NOT NULL DEFAULT false,
  preferred_height_min integer CHECK (preferred_height_min IS NULL OR preferred_height_min > 0),
  preferred_height_max integer CHECK (preferred_height_max IS NULL OR preferred_height_max > 0),
  preferred_height_any boolean NOT NULL DEFAULT false,
  preferred_body_types text[] NOT NULL DEFAULT '{}',

  -- 선호 성격
  preferred_traits text[] NOT NULL DEFAULT '{}',

  -- 본인 외모
  self_skin_types text[] NOT NULL DEFAULT '{}',
  self_animal_types text[] NOT NULL DEFAULT '{}',
  self_face_types text[] NOT NULL DEFAULT '{}',

  -- 본인 특징
  self_traits text[] NOT NULL DEFAULT '{}',

  -- 본인 체형
  self_body_type text,

  -- 상태
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.coordinators(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.dating_profiles IS '소개팅 매물 프로필 테이블';

-- auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.dating_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
