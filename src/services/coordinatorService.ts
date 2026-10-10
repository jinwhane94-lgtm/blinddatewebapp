import { supabase } from '../lib/supabase'
import type { CoordinatorPublic } from '../types'

/**
 * Fetch active coordinators (id + name only) for the public dropdown.
 */
export async function getActiveCoordinators(): Promise<CoordinatorPublic[]> {
  const { data, error } = await supabase
    .rpc('list_active_coordinators')

  if (error) throw error
  return data ?? []
}

/**
 * Get full coordinator info for the currently logged-in user.
 */
export async function getCoordinatorByAuthUser(authUserId: string) {
  const { data, error } = await supabase
    .from('coordinators')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('active', true)
    .maybeSingle()

  if (error) throw error
  return data
}
