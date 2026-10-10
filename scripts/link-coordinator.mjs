import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

// Local administrator tool only. Never import this module into the frontend.
// Default: inspect. --apply requires explicit approval to change live data.
export async function linkCoordinator(client, { email, authUserId, apply = false }) {
  if (!email || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId ?? '')) {
    throw new Error('Provide --email and a valid --auth-user-id.')
  }
  email = email.trim()
  const { data: account, error: accountError } = await client.auth.admin.getUserById(authUserId)
  if (accountError || !account.user || account.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error('Auth account could not be verified for this email. No changes made.')
  }
  if (!account.user.email_confirmed_at || account.user.is_anonymous ||
      (account.user.banned_until && Date.parse(account.user.banned_until) > Date.now())) {
    throw new Error('Auth account must be confirmed and enabled. No changes made.')
  }

  const { data: rows, error } = await client.from('coordinators')
    .select('id,auth_user_id,active').eq('email', email)
  if (error || rows?.length !== 1 || !rows[0].active) {
    throw new Error('Expected exactly one existing active coordinator. No changes made.')
  }
  const coordinator = rows[0]
  if (coordinator.auth_user_id && coordinator.auth_user_id !== authUserId) {
    throw new Error('Coordinator is linked to another Auth account. No changes made.')
  }
  const { data: linked, error: linkedError } = await client.from('coordinators')
    .select('id').eq('auth_user_id', authUserId)
  if (linkedError || !linked || linked.some((row) => row.id !== coordinator.id)) {
    throw new Error('Could not exclude another coordinator linked to this Auth account. No changes made.')
  }
  if (coordinator.auth_user_id === authUserId) return { status: 'already-linked' }
  if (!apply) return { status: 'ready', changes: ['coordinators.auth_user_id: null -> verified Auth user ID'] }

  // Compare-and-set: never overwrite a link or activation/email change made
  // after inspection. Update only this coordinator; preserve all other fields.
  const { data: updated, error: updateError } = await client.from('coordinators')
    .update({ auth_user_id: authUserId })
    .eq('id', coordinator.id).eq('email', email).eq('active', true)
    .is('auth_user_id', null).select('id,auth_user_id')
  if (updateError || updated?.length !== 1 || updated[0].auth_user_id !== authUserId) {
    throw new Error('Link update was not confirmed. Inspect the account before retrying.')
  }
  return { status: 'linked' }
}

async function main() {
  const args = process.argv.slice(2)
  const value = (flag) => args[args.indexOf(flag) + 1]
  if (!args.includes('--email') || !args.includes('--auth-user-id')) {
    throw new Error('Usage: node scripts/link-coordinator.mjs --email EMAIL --auth-user-id UUID [--apply]')
  }
  const env = loadEnv('development', process.cwd(), '')
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing local Supabase URL or server credential.')
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }) },
  })
  const result = await linkCoordinator(client, {
    email: value('--email'), authUserId: value('--auth-user-id'), apply: args.includes('--apply'),
  })
  console.log(JSON.stringify(result))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Never print SDK errors, response bodies, keys or account details.
    console.error('Coordinator link operation failed. Check arguments, local configuration and account linkage.')
    process.exitCode = 1
  })
}
