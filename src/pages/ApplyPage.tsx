import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applyFormSchema, type ApplyFormData } from '../lib/schemas'
import { getActiveCoordinators } from '../services/coordinatorService'
import { createProfile } from '../services/profileService'
import type { CoordinatorPublic } from '../types'
import {
  MBTI_OPTIONS,
  SKIN_TYPES_WITH_ANY,
  ANIMAL_TYPES_WITH_ANY,
  FACE_TYPES_WITH_ANY,
  PERSONALITY_TRAITS_WITH_ANY,
  SKIN_TYPES,
  ANIMAL_TYPES,
  FACE_TYPES,
  PERSONALITY_TRAITS,
  BODY_TYPES_MALE,
  BODY_TYPES_FEMALE,
  SELF_BODY_TYPES_MALE,
  SELF_BODY_TYPES_FEMALE,
} from '../constants'
import { SectionCard } from '../components/SectionCard'
import { MultiSelect } from '../components/MultiSelect'
import { SingleSelect } from '../components/SingleSelect'
import { RangeInput } from '../components/RangeInput'
import { Toast, useToast } from '../components/Toast'

type SubmitState = 'idle' | 'submitting' | 'success'

export default function ApplyPage() {
  const [coordinators, setCoordinators] = useState<CoordinatorPublic[]>([])
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const { toast, showToast, hideToast } = useToast()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplyFormData>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      coordinator_id: '',
      nickname: '',
      gender: undefined,
      age: undefined,
      company: '',
      height_cm: undefined,
      mbti: '',
      preferred_skin_types: [],
      preferred_animal_types: [],
      preferred_face_types: [],
      preferred_age_any: false,
      preferred_age_min: null,
      preferred_age_max: null,
      preferred_height_any: false,
      preferred_height_min: null,
      preferred_height_max: null,
      preferred_body_types: [],
      preferred_traits: [],
      self_skin_types: [],
      self_animal_types: [],
      self_face_types: [],
      self_traits: [],
      self_body_type: '',
    },
  })

  const gender = watch('gender')

  // Load coordinators
  useEffect(() => {
    getActiveCoordinators()
      .then(setCoordinators)
      .catch(() => showToast('주선자 목록을 불러오지 못했습니다.', 'error'))
  }, [showToast])

  const onSubmit = async (data: ApplyFormData) => {
    setSubmitState('submitting')
    try {
      await createProfile({
        coordinator_id: data.coordinator_id,
        nickname: data.nickname,
        gender: data.gender,
        age: data.age,
        company: data.company,
        height_cm: data.height_cm,
        mbti: data.mbti,
        preferred_skin_types: data.preferred_skin_types,
        preferred_animal_types: data.preferred_animal_types,
        preferred_face_types: data.preferred_face_types,
        preferred_age_min: data.preferred_age_any ? null : (data.preferred_age_min ?? null),
        preferred_age_max: data.preferred_age_any ? null : (data.preferred_age_max ?? null),
        preferred_age_any: data.preferred_age_any,
        preferred_height_min: data.preferred_height_any ? null : (data.preferred_height_min ?? null),
        preferred_height_max: data.preferred_height_any ? null : (data.preferred_height_max ?? null),
        preferred_height_any: data.preferred_height_any,
        preferred_body_types: data.preferred_body_types,
        preferred_traits: data.preferred_traits,
        self_skin_types: data.self_skin_types,
        self_animal_types: data.self_animal_types,
        self_face_types: data.self_face_types,
        self_traits: data.self_traits,
        self_body_type: data.self_body_type,
      })
      setSubmitState('success')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      showToast(`등록 실패: ${msg}`, 'error')
      setSubmitState('idle')
    }
  }

  if (submitState === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="section-card max-w-sm w-full text-center animate-slide-up">
          <div className="text-5xl mb-4">💌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">등록 완료!</h2>
          <p className="text-gray-600 mb-2">소개팅 프로필이 정상적으로 등록되었습니다.</p>
          <p className="text-sm text-gray-500">주선자의 승인 후 소개팅 매물로 등록됩니다.</p>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">문의는 담당 주선자에게 연락해주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-accent-500 text-white px-5 pt-14 pb-12">
        <div className="max-w-lg mx-auto">
          <p className="text-brand-200 text-sm font-medium mb-2">💕 소개팅 매물 등록</p>
          <h1 className="text-3xl font-extrabold mb-3 leading-tight">
            나의 이상형을<br />찾아보세요
          </h1>
          <p className="text-brand-100 text-sm leading-relaxed">
            아래 정보를 입력해주시면 주선자가 검토 후 매칭을 진행해드립니다.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="max-w-lg mx-auto px-4 -mt-6 space-y-5">

          {/* 주선자 선택 */}
          <SectionCard title="담당 주선자" icon="👤">
            <label className="form-label">
              주선자 선택 <span className="required">*</span>
            </label>
            <select
              {...register('coordinator_id')}
              className="form-select"
              defaultValue=""
            >
              <option value="" disabled>주선자를 선택해주세요</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.coordinator_id && <p className="form-error">{errors.coordinator_id.message}</p>}
          </SectionCard>

          {/* 기본 정보 */}
          <SectionCard title="기본 정보" icon="📋">
            <div className="space-y-4">
              {/* 닉네임 */}
              <div>
                <label className="form-label">닉네임 <span className="required">*</span></label>
                <input {...register('nickname')} className="form-input" placeholder="예: 민수" />
                {errors.nickname && <p className="form-error">{errors.nickname.message}</p>}
              </div>

              {/* 성별 */}
              <div>
                <label className="form-label">성별 <span className="required">*</span></label>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <SingleSelect
                      options={['남', '여']}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      error={errors.gender?.message}
                    />
                  )}
                />
              </div>

              {/* 나이 */}
              <div>
                <label className="form-label">나이 <span className="required">*</span></label>
                <input
                  type="number"
                  {...register('age', { valueAsNumber: true })}
                  className="form-input"
                  placeholder="실제 나이를 정확하게 입력해주세요"
                />
                {errors.age && <p className="form-error">{errors.age.message}</p>}
              </div>

              {/* 회사명 */}
              <div>
                <label className="form-label">회사명 <span className="required">*</span></label>
                <input {...register('company')} className="form-input" placeholder="現 직장명" />
                {errors.company && <p className="form-error">{errors.company.message}</p>}
              </div>

              {/* 키 */}
              <div>
                <label className="form-label">키 (cm) <span className="required">*</span></label>
                <input
                  type="number"
                  {...register('height_cm', { valueAsNumber: true })}
                  className="form-input"
                  placeholder="실제 키를 정확하게 입력해주세요"
                />
                {errors.height_cm && <p className="form-error">{errors.height_cm.message}</p>}
              </div>

              {/* MBTI */}
              <div>
                <label className="form-label">MBTI <span className="required">*</span></label>
                <select {...register('mbti')} className="form-select" defaultValue="">
                  <option value="" disabled>MBTI를 선택해주세요</option>
                  {MBTI_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {errors.mbti && <p className="form-error">{errors.mbti.message}</p>}
              </div>
            </div>
          </SectionCard>

          {/* 선호하는 이성상 (외모) */}
          <SectionCard title="선호하는 이성상 (외모)" icon="✨" subtitle="다중 선택 가능">
            <div className="space-y-6">
              {/* 피부 */}
              <div>
                <label className="form-label">피부 특성 <span className="required">*</span></label>
                <Controller
                  name="preferred_skin_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={SKIN_TYPES_WITH_ANY} value={field.value} onChange={field.onChange} error={errors.preferred_skin_types?.message} />
                  )}
                />
              </div>

              {/* 동물상 */}
              <div>
                <label className="form-label">동물상 <span className="required">*</span></label>
                <Controller
                  name="preferred_animal_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={ANIMAL_TYPES_WITH_ANY} value={field.value} onChange={field.onChange} error={errors.preferred_animal_types?.message} />
                  )}
                />
              </div>

              {/* 얼굴 이미지 */}
              <div>
                <label className="form-label">얼굴 이미지 <span className="required">*</span></label>
                <Controller
                  name="preferred_face_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={FACE_TYPES_WITH_ANY} value={field.value} onChange={field.onChange} error={errors.preferred_face_types?.message} />
                  )}
                />
              </div>

              {/* 선호 나이 */}
              <div>
                <label className="form-label">선호 나이 <span className="required">*</span></label>
                <Controller
                  name="preferred_age_any"
                  control={control}
                  render={({ field: anyField }) => (
                    <Controller
                      name="preferred_age_min"
                      control={control}
                      render={({ field: minField }) => (
                        <Controller
                          name="preferred_age_max"
                          control={control}
                          render={({ field: maxField }) => (
                            <RangeInput
                              label="나이"
                              unit="세"
                              anyValue={anyField.value}
                              minValue={minField.value}
                              maxValue={maxField.value}
                              onAnyChange={(v) => {
                                anyField.onChange(v)
                                if (v) {
                                  setValue('preferred_age_min', null)
                                  setValue('preferred_age_max', null)
                                }
                              }}
                              onMinChange={minField.onChange}
                              onMaxChange={maxField.onChange}
                              minError={errors.preferred_age_min?.message}
                              maxError={errors.preferred_age_max?.message}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />
              </div>

              {/* 선호 키 */}
              <div>
                <label className="form-label">선호 키 <span className="required">*</span></label>
                <Controller
                  name="preferred_height_any"
                  control={control}
                  render={({ field: anyField }) => (
                    <Controller
                      name="preferred_height_min"
                      control={control}
                      render={({ field: minField }) => (
                        <Controller
                          name="preferred_height_max"
                          control={control}
                          render={({ field: maxField }) => (
                            <RangeInput
                              label="키"
                              unit="cm"
                              anyValue={anyField.value}
                              minValue={minField.value}
                              maxValue={maxField.value}
                              onAnyChange={(v) => {
                                anyField.onChange(v)
                                if (v) {
                                  setValue('preferred_height_min', null)
                                  setValue('preferred_height_max', null)
                                }
                              }}
                              onMinChange={minField.onChange}
                              onMaxChange={maxField.onChange}
                              minError={errors.preferred_height_min?.message}
                              maxError={errors.preferred_height_max?.message}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />
              </div>

              {/* 선호 체형 */}
              <div>
                <label className="form-label">선호 체형 <span className="required">*</span></label>
                <p className="text-xs text-gray-400 mb-2">
                  {gender === '남' ? '상대방이 여자일 경우 선택지' : gender === '여' ? '상대방이 남자일 경우 선택지' : '성별을 먼저 선택해주세요'}
                </p>
                <Controller
                  name="preferred_body_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect
                      options={gender === '남' ? BODY_TYPES_FEMALE : BODY_TYPES_MALE}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.preferred_body_types?.message}
                    />
                  )}
                />
              </div>
            </div>
          </SectionCard>

          {/* 선호하는 이성상 (성격) */}
          <SectionCard title="선호하는 이성상 (성격)" icon="💬" subtitle="다중 선택 가능">
            <Controller
              name="preferred_traits"
              control={control}
              render={({ field }) => (
                <MultiSelect options={PERSONALITY_TRAITS_WITH_ANY} value={field.value} onChange={field.onChange} error={errors.preferred_traits?.message} />
              )}
            />
          </SectionCard>

          {/* 나는 어떤 사람? */}
          <SectionCard title="나는 어떤 사람?" icon="🙋" subtitle="본인에 대해 선택해주세요 · 다중 선택 가능">
            <div className="space-y-6">
              {/* 나의 피부 */}
              <div>
                <label className="form-label">나의 피부 <span className="required">*</span></label>
                <Controller
                  name="self_skin_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={SKIN_TYPES} value={field.value} onChange={field.onChange} error={errors.self_skin_types?.message} />
                  )}
                />
              </div>

              {/* 나의 동물상 */}
              <div>
                <label className="form-label">나의 동물상 <span className="required">*</span></label>
                <Controller
                  name="self_animal_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={ANIMAL_TYPES} value={field.value} onChange={field.onChange} error={errors.self_animal_types?.message} />
                  )}
                />
              </div>

              {/* 나의 얼굴 이미지 */}
              <div>
                <label className="form-label">나의 얼굴 이미지 <span className="required">*</span></label>
                <Controller
                  name="self_face_types"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={FACE_TYPES} value={field.value} onChange={field.onChange} error={errors.self_face_types?.message} />
                  )}
                />
              </div>

              {/* 나의 특징 */}
              <div>
                <label className="form-label">나의 특징 <span className="required">*</span></label>
                <Controller
                  name="self_traits"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect options={PERSONALITY_TRAITS} value={field.value} onChange={field.onChange} error={errors.self_traits?.message} />
                  )}
                />
              </div>
            </div>
          </SectionCard>

          {/* 나의 체형 */}
          <SectionCard title="나의 체형" icon="💪">
            <p className="text-xs text-gray-400 mb-3">
              {gender === '남' ? '남성 기준' : gender === '여' ? '여성 기준' : '성별을 먼저 선택해주세요'}
            </p>
            <Controller
              name="self_body_type"
              control={control}
              render={({ field }) => (
                <SingleSelect
                  options={gender === '여' ? SELF_BODY_TYPES_FEMALE : SELF_BODY_TYPES_MALE}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.self_body_type?.message}
                />
              )}
            />
          </SectionCard>

          {/* 제출 버튼 */}
          <div className="pt-2 pb-4">
            <button
              type="submit"
              disabled={submitState === 'submitting'}
              className="btn-primary w-full text-base py-4"
            >
              {submitState === 'submitting' ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  등록 중...
                </>
              ) : '등록하기 💌'}
            </button>
            <p className="text-xs text-center text-gray-400 mt-3">
              등록 후 주선자 승인을 거쳐 매칭이 시작됩니다
            </p>
          </div>
        </div>
      </form>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
