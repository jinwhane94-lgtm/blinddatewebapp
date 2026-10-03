import { z } from 'zod'

export const applyFormSchema = z
  .object({
    coordinator_id: z.string().min(1, '주선자를 선택해주세요.'),
    nickname: z.string().min(1, '닉네임을 입력해주세요.').max(20),
    gender: z.enum(['남', '여']).refine((v) => v === '남' || v === '여', { message: '성별을 선택해주세요.' }),
    age: z
      .number({ message: '나이를 입력해주세요.' })
      .int()
      .positive('나이를 올바르게 입력해주세요.'),
    company: z.string().min(1, '회사명을 입력해주세요.'),
    height_cm: z
      .number({ message: '키를 입력해주세요.' })
      .int()
      .positive('키를 올바르게 입력해주세요.'),
    mbti: z.string().min(1, 'MBTI를 선택해주세요.'),

    // 선호 외모
    preferred_skin_types: z.array(z.string()).min(1, '피부 특성을 하나 이상 선택해주세요.'),
    preferred_animal_types: z.array(z.string()).min(1, '동물상을 하나 이상 선택해주세요.'),
    preferred_face_types: z.array(z.string()).min(1, '얼굴 이미지를 하나 이상 선택해주세요.'),
    preferred_age_any: z.boolean(),
    preferred_age_min: z.number().int().positive().nullable().optional(),
    preferred_age_max: z.number().int().positive().nullable().optional(),
    preferred_height_any: z.boolean(),
    preferred_height_min: z.number().int().positive().nullable().optional(),
    preferred_height_max: z.number().int().positive().nullable().optional(),
    preferred_body_types: z.array(z.string()).min(1, '선호 체형을 하나 이상 선택해주세요.'),

    // 선호 성격
    preferred_traits: z.array(z.string()).min(1, '선호 성격을 하나 이상 선택해주세요.'),

    // 본인
    self_skin_types: z.array(z.string()).min(1, '나의 피부 특성을 하나 이상 선택해주세요.'),
    self_animal_types: z.array(z.string()).min(1, '나의 동물상을 하나 이상 선택해주세요.'),
    self_face_types: z.array(z.string()).min(1, '나의 얼굴 이미지를 하나 이상 선택해주세요.'),
    self_traits: z.array(z.string()).min(1, '나의 특징을 하나 이상 선택해주세요.'),
    self_body_type: z.string().min(1, '나의 체형을 선택해주세요.'),
  })
  .superRefine((data, ctx) => {
    if (!data.preferred_age_any) {
      if (data.preferred_age_min == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '최소 나이를 입력해주세요.', path: ['preferred_age_min'] })
      }
      if (data.preferred_age_max == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '최대 나이를 입력해주세요.', path: ['preferred_age_max'] })
      }
      if (data.preferred_age_min != null && data.preferred_age_max != null && data.preferred_age_min > data.preferred_age_max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '최소 나이는 최대 나이보다 작아야 합니다.', path: ['preferred_age_min'] })
      }
    }
    if (!data.preferred_height_any) {
      if (data.preferred_height_min == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '최소 키를 입력해주세요.', path: ['preferred_height_min'] })
      }
      if (data.preferred_height_max == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '최대 키를 입력해주세요.', path: ['preferred_height_max'] })
      }
      if (data.preferred_height_min != null && data.preferred_height_max != null && data.preferred_height_min > data.preferred_height_max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '최소 키는 최대 키보다 작아야 합니다.', path: ['preferred_height_min'] })
      }
    }
  })

export type ApplyFormData = z.infer<typeof applyFormSchema>

export const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
})

export type LoginFormData = z.infer<typeof loginSchema>
