import { useEffect, useState } from 'react'
import { useSession } from './useSession'
import { getCoordinatorByAuthUser } from '../services/coordinatorService'
import type { Coordinator } from '../types'

// Manager authorization is separate from membership. Auth callbacks stay synchronous.
export function useAuth() {
  const { session, loading: sessionLoading } = useSession()
  const user = session?.user ?? null
  const userId = user?.id
  const [resolved, setResolved] = useState<{ userId: string; coordinator: Coordinator | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!userId) return
    let active = true
    void getCoordinatorByAuthUser(userId).then((coordinator) => {
      if (active) setResolved({ userId, coordinator: coordinator as Coordinator | null, failed: false })
    }).catch(() => {
      if (active) setResolved({ userId, coordinator: null, failed: true })
    })
    return () => { active = false }
  }, [userId])
  return {
    session,
    user,
    coordinator: userId && resolved?.userId === userId ? resolved.coordinator : null,
    lookupFailed: Boolean(userId && resolved?.userId === userId && resolved.failed),
    loading: sessionLoading || Boolean(userId && resolved?.userId !== userId),
  }
}
