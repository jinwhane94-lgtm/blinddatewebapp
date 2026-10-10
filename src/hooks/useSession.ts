import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// UI state only. Ownership and authorization are checked again inside DB RPCs.
export function useSession() {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true })
  useEffect(() => {
    let active = true
    let eventReceived = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true
      if (active) setState({ session, loading: false })
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !eventReceived) setState({ session: error ? null : data.session, loading: false })
    }).catch(() => {
      if (active && !eventReceived) setState({ session: null, loading: false })
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return state
}
