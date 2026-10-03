import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getCoordinatorByAuthUser } from '../services/coordinatorService'
import type { Coordinator } from '../types'

interface AuthState {
  session: Session | null
  user: User | null
  coordinator: Coordinator | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        try {
          const coord = await getCoordinatorByAuthUser(session.user.id)
          setCoordinator(coord as Coordinator | null)
        } catch {
          setCoordinator(null)
        }
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        try {
          const coord = await getCoordinatorByAuthUser(session.user.id)
          setCoordinator(coord as Coordinator | null)
        } catch {
          setCoordinator(null)
        }
      } else {
        setCoordinator(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, user, coordinator, loading }
}
