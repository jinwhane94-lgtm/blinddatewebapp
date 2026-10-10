import type { DatingProfile } from '../types'

interface ProfileCardProps {
  profile: DatingProfile
  onApprove: (id: string) => void
  onReject: (id: string) => void
  actionLoading?: string | null
}

const statusBadge = {
  pending: <span className="badge-pending">승인 대기</span>,
  approved: <span className="badge-approved">승인</span>,
  rejected: <span className="badge-rejected">반려</span>,
}

function tags(arr: string[]) {
  return arr.filter(Boolean).join(' / ')
}

export function ProfileCard({ profile, onApprove, onReject, actionLoading }: ProfileCardProps) {
  const isLoading = actionLoading === profile.id

  return (
    <div className="section-card hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="break-words text-lg font-bold text-gray-800">{profile.nickname}</h3>
            {statusBadge[profile.status]}
          </div>
          <p className="text-sm text-gray-500">
            {profile.gender} · {profile.age}세 · {profile.height_cm}cm · {profile.mbti}
          </p>
          <p className="break-words text-sm text-gray-500">{profile.company}</p>
        </div>
        <div className="text-2xl">
          {profile.gender === '남' ? '👦' : '👩'}
        </div>
      </div>

      {/* 선호 이성상 */}
      <div className="space-y-1.5 mb-4 text-sm">
        <div className="flex gap-1">
          <span className="text-gray-400 shrink-0 w-20">나이 선호</span>
          <span className="text-gray-700 font-medium">
            {profile.preferred_age_any ? '상관없음' : `${profile.preferred_age_min ?? '?'}~${profile.preferred_age_max ?? '?'}세`}
          </span>
        </div>
        <div className="flex gap-1">
          <span className="text-gray-400 shrink-0 w-20">키 선호</span>
          <span className="text-gray-700 font-medium">
            {profile.preferred_height_any ? '상관없음' : `${profile.preferred_height_min ?? '?'}~${profile.preferred_height_max ?? '?'}cm`}
          </span>
        </div>
        {profile.preferred_skin_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">피부</span>
            <span className="text-gray-700">{tags(profile.preferred_skin_types)}</span>
          </div>
        )}
        {profile.preferred_animal_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">동물상</span>
            <span className="text-gray-700">{tags(profile.preferred_animal_types)}</span>
          </div>
        )}
        {profile.preferred_face_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">얼굴 이미지</span>
            <span className="min-w-0 break-words text-gray-700">{tags(profile.preferred_face_types)}</span>
          </div>
        )}
        {profile.preferred_body_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">체형</span>
            <span className="text-gray-700">{tags(profile.preferred_body_types)}</span>
          </div>
        )}
        {profile.preferred_traits.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">선호 성격</span>
            <span className="text-gray-700">{tags(profile.preferred_traits)}</span>
          </div>
        )}
      </div>

      {/* 나는 어떤 사람 */}
      <div className="border-t border-gray-100 pt-3 mb-4 space-y-1.5 text-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">나는 어떤 사람</p>
        {profile.self_animal_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">동물상</span>
            <span className="text-gray-700">{tags(profile.self_animal_types)}</span>
          </div>
        )}
        {profile.self_skin_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">피부</span>
            <span className="min-w-0 break-words text-gray-700">{tags(profile.self_skin_types)}</span>
          </div>
        )}
        {profile.self_face_types.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">얼굴 이미지</span>
            <span className="min-w-0 break-words text-gray-700">{tags(profile.self_face_types)}</span>
          </div>
        )}
        {profile.self_traits.length > 0 && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">성격</span>
            <span className="text-gray-700">{tags(profile.self_traits)}</span>
          </div>
        )}
        {profile.self_body_type && (
          <div className="flex gap-1">
            <span className="text-gray-400 shrink-0 w-20">체형</span>
            <span className="text-gray-700">{profile.self_body_type}</span>
          </div>
        )}
      </div>

      {/* 반려 사유 */}
      {profile.status === 'rejected' && profile.rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-600">
          <span className="font-semibold">반려 사유: </span>{profile.rejection_reason}
        </div>
      )}

      {/* 등록일 */}
      <p className="text-xs text-gray-400 mb-4">
        등록일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
      </p>

      {/* Actions */}
      {profile.status === 'pending' && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onApprove(profile.id)}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-all duration-150"
          >
            {isLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✓ 승인'}
          </button>
          <button
            type="button"
            onClick={() => onReject(profile.id)}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-all duration-150"
          >
            {isLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✕ 반려'}
          </button>
        </div>
      )}

      {profile.status === 'approved' && (
        <div className="text-center text-sm text-emerald-600 font-medium py-1">
          ✓ 승인 완료
        </div>
      )}

      {profile.status === 'rejected' && (
        <div className="flex gap-3">
          <div className="flex-1 text-center text-sm text-red-500 font-medium py-1">
            반려됨
          </div>
          <button
            type="button"
            onClick={() => onApprove(profile.id)}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-all duration-150 text-sm"
          >
            재승인
          </button>
        </div>
      )}
    </div>
  )
}
