import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getProfilesForCoordinator, approveProfile, rejectProfile } from '../services/profileService'
import type { DatingProfile, ProfileStatus } from '../types'
import { ProfileCard } from '../components/ProfileCard'
import { RejectModal } from '../components/RejectModal'
import { Toast, useToast } from '../components/Toast'

type FilterTab = 'all' | ProfileStatus

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
]

export default function ManagerDashboardPage() {
  const navigate = useNavigate()
  const { coordinator, loading: authLoading } = useAuth()
  const { toast, showToast, hideToast } = useToast()

  const [profiles, setProfiles] = useState<DatingProfile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !coordinator) {
      navigate('/manager/login', { replace: true })
    }
  }, [authLoading, coordinator, navigate])

  const fetchProfiles = useCallback(async () => {
    if (!coordinator) return
    setLoadingProfiles(true)
    try {
      const data = await getProfilesForCoordinator(coordinator.id)
      setProfiles(data)
    } catch {
      showToast('프로필 목록을 불러오지 못했습니다.', 'error')
    } finally {
      setLoadingProfiles(false)
    }
  }, [coordinator, showToast])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/manager/login', { replace: true })
  }

  const handleApprove = async (profileId: string) => {
    if (!coordinator) return
    setActionLoading(profileId)
    try {
      await approveProfile(profileId, coordinator.id)
      setProfiles((prev) =>
        prev.map((p) => p.id === profileId ? { ...p, status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: coordinator.id } : p)
      )
      showToast('프로필이 승인되었습니다.', 'success')
    } catch {
      showToast('승인 처리 중 오류가 발생했습니다.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectClick = (profileId: string) => {
    setRejectTarget(profileId)
  }

  const handleRejectConfirm = async (reason: string) => {
    if (!coordinator || !rejectTarget) return
    setRejectSubmitting(true)
    try {
      await rejectProfile(rejectTarget, coordinator.id, reason || null)
      setProfiles((prev) =>
        prev.map((p) => p.id === rejectTarget ? { ...p, status: 'rejected', rejection_reason: reason || null, reviewed_at: new Date().toISOString(), reviewed_by: coordinator.id } : p)
      )
      showToast('프로필이 반려되었습니다.', 'info')
      setRejectTarget(null)
    } catch {
      showToast('반려 처리 중 오류가 발생했습니다.', 'error')
    } finally {
      setRejectSubmitting(false)
    }
  }

  const filteredProfiles = activeTab === 'all' ? profiles : profiles.filter((p) => p.status === activeTab)

  const counts = {
    all: profiles.length,
    pending: profiles.filter((p) => p.status === 'pending').length,
    approved: profiles.filter((p) => p.status === 'approved').length,
    rejected: profiles.filter((p) => p.status === 'rejected').length,
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-brand-300 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!coordinator) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">{coordinator.name} 주선자</h1>
            <p className="text-xs text-gray-400">담당 프로필 관리</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            로그아웃
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-0">
          <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  activeTab === tab.key
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-brand-400 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-5">
        {loadingProfiles ? (
          <div className="flex justify-center py-16">
            <span className="w-8 h-8 border-4 border-brand-300 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 font-medium">프로필이 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'all' ? '아직 등록된 프로필이 없습니다.' : `${TABS.find(t => t.key === activeTab)?.label} 상태의 프로필이 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProfiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onApprove={handleApprove}
                onReject={handleRejectClick}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          isLoading={rejectSubmitting}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
