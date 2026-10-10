// Live GET-only checks. No signup/login, mutations, profile rows or response-body logs.
import { loadEnv } from 'vite'
import { writeFile } from 'node:fs/promises'
const ref = 'icwptulzrxvasfwzuasl'
const env = loadEnv('production', process.cwd(), 'VITE_')
const url = new URL(process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL)
const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
if (url.origin !== `https://${ref}.supabase.co` || !key) throw new Error('Unexpected target or missing public key')
let legacyAnon = false
if (!key.startsWith('sb_publishable_')) {
  try { legacyAnon = JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role === 'anon' } catch {}
  if (!legacyAnon) throw new Error('Only a publishable or anon key is permitted')
}
const headers = { apikey:key, ...(legacyAnon ? {Authorization:`Bearer ${key}`} : {}) }
const results = []
async function check(id, path, extraHeaders, expected) {
  try {
    const response = await fetch(new URL(path,url), { method:'GET',headers:{...headers,...extraHeaders},signal:AbortSignal.timeout(15000) })
    const body = await response.json()
    const code = typeof body?.code === 'string' && /^[A-Z0-9_]+$/.test(body.code) ? body.code : null
    const pass = expected === 'empty' ? response.ok && Array.isArray(body) && body.length === 0
      : expected === 'schemaDenied' ? response.status === 406 && code === 'PGRST106'
      : expected === 'missing' ? response.status === 404 && ['PGRST205','42P01'].includes(code)
      : expected === 'permissionDenied' ? [401,403].includes(response.status) && code === '42501'
      : response.status === 401
    results.push({id,status:response.status,code,pass})
    if (!pass) throw new Error('Unexpected access result')
  } catch {
    if (results.at(-1)?.id !== id) results.push({id,pass:false,transportFailure:true})
    throw new Error(`Stopped at ${id}; no response body logged`)
  }
}
let authSettings
try {
  for (const table of ['profile_contacts','profile_photos','notification_logs','payments','like_wallets','profile_owners','like_transactions']) {
    await check(`private.${table}`,`/rest/v1/${table}?select=*&limit=0`,{'Accept-Profile':'private'},'schemaDenied')
    await check(`public-alias.${table}`,`/rest/v1/${table}?select=*&limit=0`,{},'missing')
  }
  for (const table of ['coordinators','likes','matches']) await check(`anon.${table}`,`/rest/v1/${table}?select=*&limit=0`,{},'permissionDenied')
  await check('anon.profiles-zero-rows','/rest/v1/dating_profiles?select=id&limit=0',{},'empty')
  await check('anon.coordinator-list-zero-rows','/rest/v1/rpc/list_active_coordinators?limit=0',{},'empty')
  for (const name of ['get_my_profile_id','get_my_like_balance','is_current_account_active']) {
    await check(`anon.rpc.${name}`,`/rest/v1/rpc/${name}`,{},'permissionDenied')
  }
  await check('invalid-jwt','/rest/v1/rpc/get_my_profile_id',{Authorization:'Bearer invalid-test-token'},'invalidJwt')
  const response = await fetch(new URL('/auth/v1/settings',url), {headers,signal:AbortSignal.timeout(15000)})
  if (!response.ok) throw new Error('Auth settings unavailable')
  const settings = await response.json()
  authSettings = {emailEnabled:settings.external?.email,signupDisabled:settings.disable_signup,
    emailAutoconfirm:settings.mailer_autoconfirm,anonymousEnabled:settings.external?.anonymous_users}
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Stopped at ') ? error.message : 'Read-only verification stopped; sensitive output suppressed')
  process.exitCode = 1
} finally {
  const report = {projectRef:ref,checkedAt:new Date().toISOString(),method:'GET only; table/RPC list requests use limit=0',results,authSettings,
    pass:!process.exitCode && results.every(x=>x.pass),limitations:'No real authenticated session, writes, user/profile rows, payment or notification requests.'}
  await writeFile(new URL('../docs/phase3-6-api-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
}
