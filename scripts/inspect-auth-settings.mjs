import { config } from 'dotenv'
config({ quiet: true })

// Public settings GET only. No signup/login, token creation or settings changes.
// Never print configuration values, response bodies or raw network errors.
const url = process.env.VITE_SUPABASE_URL
const publicKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !publicKey) {
  console.error('Missing public Supabase configuration.')
  process.exitCode = 1
} else {
  try {
    const response = await fetch(new URL('/auth/v1/settings', url), {
      headers: { apikey: publicKey }, signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error('Settings unavailable')
    const settings = await response.json()
    console.log(JSON.stringify({
      emailEnabled: settings.external?.email,
      signupDisabled: settings.disable_signup,
      emailAutoconfirm: settings.mailer_autoconfirm,
      anonymousEnabled: settings.external?.anonymous_users,
    }, null, 2))
  } catch {
    console.error('Auth settings could not be read. Check the intended project in Dashboard.')
    process.exitCode = 1
  }
}
