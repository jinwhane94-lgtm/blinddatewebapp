import type { DatingProfile } from '../types'

export type ListingProfile = Pick<DatingProfile,
  'id' | 'nickname' | 'gender' | 'age' | 'company' | 'height_cm' | 'mbti' |
  'self_skin_types' | 'self_animal_types' | 'self_face_types' | 'self_traits' | 'self_body_type' |
  'introduction' |
  'preferred_age_any' | 'preferred_age_min' | 'preferred_age_max' |
  'preferred_height_any' | 'preferred_height_min' | 'preferred_height_max' |
  'preferred_traits' | 'created_at' | 'status'
>

const statusLabels = { pending: '승인 대기', approved: '승인 완료', rejected: '반려' }

export function ListingCard({ profile }: { profile: ListingProfile }) {
  const traits = [...new Set([...profile.self_traits, ...profile.self_animal_types, ...profile.self_face_types])]
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className={`flex items-center justify-between px-5 py-4 ${profile.gender === '남' ? 'bg-indigo-50' : 'bg-brand-50'}`}>
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-xl font-bold text-gray-700">
          {profile.nickname.slice(0, 1)}
        </span>
        <span className={profile.status === 'approved' ? 'badge-approved' : profile.status === 'pending' ? 'badge-pending' : 'badge-rejected'}>
          {statusLabels[profile.status]}
        </span>
      </div>
      <div className="p-5">
        <h2 className="break-words text-xl font-bold text-gray-800">{profile.nickname}</h2>
        <p className="mt-1 text-sm text-gray-500">{profile.gender} · {profile.age}세 · {profile.height_cm}cm · {profile.mbti}</p>
        <p className="mt-2 break-words text-sm font-medium text-gray-600">{profile.company}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {traits.map((trait) => <span key={trait} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">{trait}</span>)}
          {traits.length === 0 && <span className="text-xs text-gray-400">나를 소개하는 키워드를 준비 중이에요.</span>}
        </div>
        <details className="group mt-5 border-t border-gray-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600 focus-visible:outline-brand-500">소개 자세히 보기</summary>
          <dl className="mt-3 space-y-3 text-sm">
            <div><dt className="text-xs text-gray-400">나의 외모와 체형</dt><dd className="mt-1 break-words text-gray-700">{[...profile.self_skin_types, ...profile.self_animal_types, ...profile.self_face_types, profile.self_body_type].filter(Boolean).join(' · ') || '등록된 정보가 없어요.'}</dd></div>
            <div><dt className="text-xs text-gray-400">만나고 싶은 나이</dt><dd className="mt-1 text-gray-700">{profile.preferred_age_any ? '상관없음' : `${profile.preferred_age_min ?? '?'}~${profile.preferred_age_max ?? '?'}세`}</dd></div>
            <div><dt className="text-xs text-gray-400">선호하는 키</dt><dd className="mt-1 text-gray-700">{profile.preferred_height_any ? '상관없음' : `${profile.preferred_height_min ?? '?'}~${profile.preferred_height_max ?? '?'}cm`}</dd></div>
            <div><dt className="text-xs text-gray-400">좋아하는 성격</dt><dd className="mt-1 break-words text-gray-700">{profile.preferred_traits.join(' · ') || '등록된 정보가 없어요.'}</dd></div>
            {profile.introduction && <div><dt className="text-xs text-gray-400">자기소개</dt><dd className="mt-1 whitespace-pre-wrap break-words text-gray-700">{profile.introduction}</dd></div>}
          </dl>
        </details>
      </div>
    </article>
  )
}
