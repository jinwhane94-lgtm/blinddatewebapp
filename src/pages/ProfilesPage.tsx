import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListingCard, type ListingProfile } from '../components/ListingCard'
import { FilterToggleGroup } from '../components/FilterToggleGroup'
import { useSession } from '../hooks/useSession'
import { getApprovedListings, ProfileRequiredError, type ListingFilters } from '../services/listingService'
import { ANIMAL_TYPES, FACE_TYPES, LISTING_BODY_TYPES, MBTI_OPTIONS, PERSONALITY_TRAITS, SKIN_TYPES } from '../constants/options'
const initialFilters: ListingFilters = {
  ageMin: null,
  ageMax: null,
  mbtis: [],
  traits: [],
  faceTypes: [],
  animalTypes: [],
  skinTypes: [],
  bodyTypes: [],
  page: 0,
}

export default function ProfilesPage() {
  const [year] = useState(() => new Date().getFullYear())
  const { session, loading: sessionLoading } = useSession()
  const userId = session && !session.user.is_anonymous ? session.user.id : null
  const [filters, setFilters] = useState(initialFilters)
  const [result, setResult] = useState<{ key: string; items: ListingProfile[]; hasMore: boolean; error: 'generic' | 'profile-required' | null } | null>(null)
  const [retry, setRetry] = useState(0)
  const key = JSON.stringify([userId, filters, retry])
  const ageError = filters.ageMin !== null && (filters.ageMin < 18 || filters.ageMin > 120)
    ? '최소 나이는 18세부터 120세까지 입력해주세요.'
    : filters.ageMax !== null && (filters.ageMax < 18 || filters.ageMax > 120)
      ? '최대 나이는 18세부터 120세까지 입력해주세요.'
      : filters.ageMin !== null && filters.ageMax !== null && filters.ageMin > filters.ageMax
        ? '최소 나이는 최대 나이보다 작아야 합니다.'
        : null
  useEffect(() => {
    if (!userId || ageError) return
    const controller = new AbortController()
    void getApprovedListings(filters, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, items: data.items, hasMore: data.has_more, error: null })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, items: [], hasMore: false, error: error instanceof ProfileRequiredError ? 'profile-required' : 'generic' })
    })
    return () => controller.abort()
  }, [userId, filters, key, ageError])
  const current = result?.key === key ? result : null
  const loading = Boolean(userId && !current && !ageError)
  const hasActiveFilters = Boolean(filters.ageMin || filters.ageMax || filters.mbtis.length || filters.traits.length || filters.faceTypes.length || filters.animalTypes.length || filters.skinTypes.length || filters.bodyTypes.length)
  const resetFilters = () => setFilters(initialFilters)
  const updateFilters = (changes: Partial<ListingFilters>) => setFilters((currentFilters) => ({ ...currentFilters, ...changes, page: 0 }))
  const setAgeMin = (value: string) => {
    const ageMin = value ? Number(value) : null
    updateFilters({ ageMin })
  }
  const setAgeMax = (value: string) => {
    const ageMax = value ? Number(value) : null
    updateFilters({ ageMax })
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-100 bg-white/90">
        <nav aria-label="매물 목록 메뉴" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="text-sm font-bold text-brand-600">💕 소개팅 매칭</Link>
          <Link to="/apply" className="text-sm font-semibold text-gray-600 hover:text-brand-600">직접 소개팅 매물 등록하기</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <div className="mb-8">
          <p className="mb-3 text-xs font-bold tracking-widest text-brand-500">새로운 인연의 시작</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-800 sm:text-4xl">소개팅 매물 둘러보기</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">주선자가 승인한 소개팅 매물을 만나보세요.<br className="sm:hidden" /> 나와 잘 맞는 사람을 찾아보세요.</p>
        </div>

        {sessionLoading ? <p role="status" className="py-16 text-center text-gray-500">로그인 상태를 확인하고 있어요.</p> : !userId ? (
          <section className="section-card py-14 text-center">
            <span aria-hidden="true" className="text-4xl">💌</span>
            <h2 className="mt-4 text-xl font-bold">로그인하고 새로운 인연을 만나보세요</h2>
            <p className="mt-2 text-sm text-gray-500">승인된 매물은 로그인한 회원에게 보여드려요.</p>
            <Link to="/login" state={{ returnTo: '/profiles' }} className="btn-primary mt-6">일반 사용자<span aria-hidden="true" className="text-xs">❤️</span> 로그인</Link>
          </section>
        ) : <>
          <section aria-label="매물 필터" className="section-card mb-7 !p-4 sm:!p-5">
            <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">내 프로필 성별을 기준으로 이성 매물만 보여드려요.</p>
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold text-gray-800">나이</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <label htmlFor="listing-age-min" className="sr-only">최소 나이</label>
                  <input id="listing-age-min" type="number" inputMode="numeric" min="18" max="120" placeholder="최소 나이" value={filters.ageMin ?? ''} onChange={(event) => setAgeMin(event.target.value)} className="form-input !py-2.5 !text-sm" aria-invalid={Boolean(ageError)} />
                </div>
                <span aria-hidden="true" className="text-gray-400">~</span>
                <div>
                  <label htmlFor="listing-age-max" className="sr-only">최대 나이</label>
                  <input id="listing-age-max" type="number" inputMode="numeric" min="18" max="120" placeholder="최대 나이" value={filters.ageMax ?? ''} onChange={(event) => setAgeMax(event.target.value)} className="form-input !py-2.5 !text-sm" aria-invalid={Boolean(ageError)} />
                </div>
              </div>
              {ageError && <p role="alert" className="form-error">{ageError}</p>}
            </div>
            <div className="mt-4 border-t border-gray-100">
              <FilterToggleGroup label="MBTI" options={MBTI_OPTIONS} selected={filters.mbtis} onChange={(mbtis) => updateFilters({ mbtis })} />
              <FilterToggleGroup label="성격" options={PERSONALITY_TRAITS} selected={filters.traits} onChange={(traits) => updateFilters({ traits })} />
              <FilterToggleGroup label="얼굴형" options={FACE_TYPES} selected={filters.faceTypes} onChange={(faceTypes) => updateFilters({ faceTypes })} />
              <FilterToggleGroup label="동물상" options={ANIMAL_TYPES} selected={filters.animalTypes} onChange={(animalTypes) => updateFilters({ animalTypes })} />
              <FilterToggleGroup label="피부" options={SKIN_TYPES} selected={filters.skinTypes} onChange={(skinTypes) => updateFilters({ skinTypes })} />
              <FilterToggleGroup label="체형" options={LISTING_BODY_TYPES} selected={filters.bodyTypes} onChange={(bodyTypes) => updateFilters({ bodyTypes })} />
            </div>
            {hasActiveFilters && <div className="mt-3 flex justify-end"><button type="button" onClick={resetFilters} className="min-h-11 px-2 text-sm font-medium text-gray-400 hover:text-gray-600">필터 초기화</button></div>}
          </section>

          {loading ? <div role="status" className="py-16 text-center text-gray-500"><span aria-hidden="true" className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />매물을 불러오고 있어요.</div> : current?.error === 'profile-required' ? (
            <section role="alert" className="section-card py-12 text-center">
              <h2 className="text-lg font-bold">먼저 내 매물을 등록해주세요</h2>
              <p className="mt-2 text-sm text-gray-500">내 프로필 성별을 확인한 뒤 이성 매물을 보여드릴 수 있어요.</p>
              <Link to="/apply" className="btn-primary mt-5">직접 소개팅 매물 등록하기</Link>
            </section>
          ) : current?.error === 'generic' ? (
            <section role="alert" className="section-card py-12 text-center">
              <h2 className="text-lg font-bold">매물 목록을 불러오지 못했어요</h2>
              <p className="mt-2 text-sm text-gray-500">잠시 후 다시 시도해주세요. 문제가 계속되면 관리자에게 문의해주세요.</p>
              <button type="button" onClick={() => setRetry(retry + 1)} className="btn-secondary mt-5">다시 시도</button>
            </section>
          ) : current?.items.length === 0 ? (
            <section className="section-card py-14 text-center">
              <span aria-hidden="true" className="text-4xl">🌷</span>
              <h2 className="mt-4 text-lg font-bold">{hasActiveFilters ? '조건에 맞는 매물이 없어요' : '새로운 인연을 준비하고 있어요'}</h2>
              <p className="mt-2 text-sm text-gray-500">{hasActiveFilters ? '다른 조건으로 찾아보세요.' : '승인된 매물이 등록되면 이곳에서 만날 수 있어요.'}</p>
              {hasActiveFilters ? <button type="button" onClick={resetFilters} className="btn-secondary mt-5">전체 매물 보기</button> : <Link to="/apply" className="btn-secondary mt-5">직접 소개팅 매물 등록하기</Link>}
            </section>
          ) : <>
            <p role="status" className="mb-4 text-sm text-gray-500">{filters.page + 1}페이지 · {current?.items.length ?? 0}개의 인연</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{current?.items.map((profile) => <ListingCard key={profile.id} profile={profile} />)}</div>
          </>}
          {!loading && !current?.error && (filters.page > 0 || current?.hasMore) && <nav aria-label="매물 페이지 이동" className="mt-8 flex items-center justify-center gap-4">
            <button type="button" disabled={filters.page === 0} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="btn-secondary">이전</button>
            <span className="text-sm text-gray-500">{filters.page + 1}페이지</span>
            <button type="button" disabled={!current?.hasMore} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="btn-secondary">다음</button>
          </nav>}
        </>}
      </main>
      <footer className="px-5 py-8 text-center text-xs text-gray-400">© {year} 소개팅 매칭 서비스</footer>
    </div>
  )
}
