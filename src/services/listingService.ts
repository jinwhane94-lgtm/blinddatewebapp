import { supabase } from '../lib/supabase'
import type { ListingProfile } from '../components/ListingCard'

export const LISTING_PAGE_SIZE = 24

export interface ListingFilters {
  ageMin: number | null
  ageMax: number | null
  mbtis: string[]
  traits: string[]
  faceTypes: string[]
  animalTypes: string[]
  skinTypes: string[]
  bodyTypes: string[]
  page: number
}

export async function getApprovedListings(filters: ListingFilters, signal: AbortSignal): Promise<{ items: ListingProfile[]; has_more: boolean }> {
  const { data, error } = await supabase.rpc('browse_approved_profiles', {
    p_age_min: filters.ageMin,
    p_age_max: filters.ageMax,
    p_mbtis: filters.mbtis,
    p_traits: filters.traits,
    p_face_types: filters.faceTypes,
    p_animal_types: filters.animalTypes,
    p_skin_types: filters.skinTypes,
    p_body_types: filters.bodyTypes,
    p_offset: filters.page * LISTING_PAGE_SIZE,
  }).abortSignal(signal)
  if (error) {
    if (error.message.includes('PROFILE_REQUIRED')) throw new ProfileRequiredError()
    throw error
  }
  if (!data || !Array.isArray(data.items) || typeof data.has_more !== 'boolean') throw new Error('Invalid listing response')
  // Keep the approved-only contract even when testing or changing the backend.
  return { items: data.items.filter((item: ListingProfile) => item.status === 'approved'), has_more: data.has_more }
}

export class ProfileRequiredError extends Error {
  constructor() {
    super('PROFILE_REQUIRED')
    this.name = 'ProfileRequiredError'
  }
}
