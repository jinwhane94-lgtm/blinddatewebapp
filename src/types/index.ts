export type ProfileStatus = 'pending' | 'approved' | 'rejected'

export interface Coordinator {
  id: string
  auth_user_id: string | null
  name: string
  email: string
  active: boolean
  created_at: string
}

export interface CoordinatorPublic {
  id: string
  name: string
}

export interface DatingProfile {
  id: string
  coordinator_id: string
  nickname: string
  gender: '남' | '여'
  age: number
  company: string
  height_cm: number
  mbti: string

  // 선호 외모
  preferred_skin_types: string[]
  preferred_animal_types: string[]
  preferred_face_types: string[]
  preferred_age_min: number | null
  preferred_age_max: number | null
  preferred_age_any: boolean
  preferred_height_min: number | null
  preferred_height_max: number | null
  preferred_height_any: boolean
  preferred_body_types: string[]

  // 선호 성격
  preferred_traits: string[]

  // 본인 외모
  self_skin_types: string[]
  self_animal_types: string[]
  self_face_types: string[]

  // 본인 특징
  self_traits: string[]

  // 본인 체형
  self_body_type: string

  // 자기소개
  introduction: string | null

  // 상태
  status: ProfileStatus
  rejection_reason: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface CreateProfilePayload {
  coordinator_id: string
  nickname: string
  gender: '남' | '여'
  age: number
  company: string
  height_cm: number
  mbti: string
  phone_number: string
  kakao_notification_enabled: boolean
  preferred_skin_types: string[]
  preferred_animal_types: string[]
  preferred_face_types: string[]
  preferred_age_min: number | null
  preferred_age_max: number | null
  preferred_age_any: boolean
  preferred_height_min: number | null
  preferred_height_max: number | null
  preferred_height_any: boolean
  preferred_body_types: string[]
  preferred_traits: string[]
  self_skin_types: string[]
  self_animal_types: string[]
  self_face_types: string[]
  self_traits: string[]
  self_body_type: string
  introduction: string
}
