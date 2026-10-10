import { supabase } from '../lib/supabase'
import type { CreateProfilePayload, DatingProfile } from '../types'

/**
 * Atomically insert a public profile and its private contact record.
 * The RPC exposes no contact data in its response.
 */
export async function createProfile(payload: CreateProfilePayload): Promise<void> {
  const { error } = await supabase
    .rpc('submit_dating_profile', {
      p_coordinator_id: payload.coordinator_id,
      p_nickname: payload.nickname,
      p_gender: payload.gender,
      p_age: payload.age,
      p_company: payload.company,
      p_height_cm: payload.height_cm,
      p_mbti: payload.mbti,
      p_phone_number: payload.phone_number,
      p_kakao_notification_enabled: payload.kakao_notification_enabled,
      p_preferred_skin_types: payload.preferred_skin_types,
      p_preferred_animal_types: payload.preferred_animal_types,
      p_preferred_face_types: payload.preferred_face_types,
      p_preferred_age_min: payload.preferred_age_min,
      p_preferred_age_max: payload.preferred_age_max,
      p_preferred_age_any: payload.preferred_age_any,
      p_preferred_height_min: payload.preferred_height_min,
      p_preferred_height_max: payload.preferred_height_max,
      p_preferred_height_any: payload.preferred_height_any,
      p_preferred_body_types: payload.preferred_body_types,
      p_preferred_traits: payload.preferred_traits,
      p_self_skin_types: payload.self_skin_types,
      p_self_animal_types: payload.self_animal_types,
      p_self_face_types: payload.self_face_types,
      p_self_traits: payload.self_traits,
      p_self_body_type: payload.self_body_type,
      p_introduction: payload.introduction,
    })

  if (error) {
    if (error.message.includes('PROFILE_ALREADY_EXISTS')) throw new Error('이미 등록한 프로필이 있습니다.')
    if (error.message.includes('AUTH_REQUIRED')) throw new Error('프로필 등록을 위해 다시 로그인해주세요.')
    throw new Error('프로필을 등록하지 못했습니다. 입력 내용과 서비스 연결 상태를 확인해주세요.')
  }
}

/**
 * Get all profiles for a specific coordinator (requires auth).
 */
export async function getProfilesForCoordinator(coordinatorId: string): Promise<DatingProfile[]> {
  const { data, error } = await supabase
    .from('dating_profiles')
    .select('*')
    .eq('coordinator_id', coordinatorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as DatingProfile[]
}

/**
 * Approve a profile.
 */
export async function approveProfile(profileId: string): Promise<void> {
  const { error } = await supabase
    .rpc('review_dating_profile', {
      p_profile_id: profileId,
      p_status: 'approved',
      p_reason: null,
    })

  if (error) throw error
}

/**
 * Reject a profile with optional reason.
 */
export async function rejectProfile(
  profileId: string,
  reason: string | null
): Promise<void> {
  const { error } = await supabase
    .rpc('review_dating_profile', {
      p_profile_id: profileId,
      p_status: 'rejected',
      p_reason: reason ?? null,
    })

  if (error) throw error
}
