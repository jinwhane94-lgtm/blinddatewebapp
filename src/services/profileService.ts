import { supabase } from '../lib/supabase'
import type { CreateProfilePayload, DatingProfile } from '../types'

/**
 * Insert a new dating profile (public, no auth required).
 * status defaults to 'pending' at DB level.
 */
export async function createProfile(payload: CreateProfilePayload): Promise<DatingProfile> {
  const { data, error } = await supabase
    .from('dating_profiles')
    .insert({ ...payload, status: 'pending' })
    .select()
    .single()

  if (error) throw error
  return data as DatingProfile
}

/**
 * Get all profiles for a specific coordinator (requires auth).
 */
export async function getProfilesForCoordinator(coordinatorId: string): Promise<DatingProfile[]> {
  const { data, error } = await supabase
    .from('dating_profiles')
    .select('*')
    .eq('coordinator_id', coordinatorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as DatingProfile[]
}

/**
 * Approve a profile.
 */
export async function approveProfile(profileId: string, reviewedByCoordinatorId: string): Promise<void> {
  const { error } = await supabase
    .from('dating_profiles')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedByCoordinatorId,
      rejection_reason: null,
    })
    .eq('id', profileId)

  if (error) throw error
}

/**
 * Reject a profile with optional reason.
 */
export async function rejectProfile(
  profileId: string,
  reviewedByCoordinatorId: string,
  reason: string | null
): Promise<void> {
  const { error } = await supabase
    .from('dating_profiles')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedByCoordinatorId,
      rejection_reason: reason ?? null,
    })
    .eq('id', profileId)

  if (error) throw error
}
