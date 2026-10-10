import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

// In-memory only; never reads .env, connects to a host, or sends messages.
// These Auth stubs model DB claims/account columns, not Supabase's Auth service.
const db = new PGlite({ extensions: { pgcrypto } })
const migration = await readFile(new URL('../../supabase/migrations/20261003140239_phase3_ownership_security.sql', import.meta.url), 'utf8')
const ids = {
  manager: '10000000-0000-4000-8000-000000000001',
  a: '10000000-0000-4000-8000-000000000002',
  b: '10000000-0000-4000-8000-000000000003',
  c: '10000000-0000-4000-8000-000000000004',
  d: '10000000-0000-4000-8000-000000000005',
  coordinator: '20000000-0000-4000-8000-000000000001',
}
let a, b, c
async function as(role, uid, sql, params = []) {
  assert.ok(['anon','authenticated','service_role'].includes(role))
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ''])
  await db.exec(`SET ROLE ${role}`)
  try { return await db.query(sql, params) } finally { await db.exec('RESET ROLE') }
}
const signupSql = `select public.submit_dating_profile(
  $1,'fixture',$2,30,'fixture company',170,'ENFP',ARRAY['any'],ARRAY['any'],ARRAY['any'],
  null,null,true,null,null,true,ARRAY['any'],ARRAY['any'],ARRAY['any'],ARRAY['any'],ARRAY['any'],ARRAY['any'],
  'normal','01000000000',false) as id`
const register = (uid, gender) => as('authenticated', uid, signupSql, [ids.coordinator, gender])

before(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, is_anonymous boolean DEFAULT false,
      banned_until timestamptz, deleted_at timestamptz, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
  `)
  for (const file of ['001_init.sql','002_rls.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  await assert.rejects(db.exec(migration), /PHASE3_PREREQUISITE/)
  await db.exec('ROLLBACK')
  await db.exec(await readFile(new URL('../../supabase/migrations/003_like_notifications.sql', import.meta.url), 'utf8'))
  await db.exec(migration)
  for (const [name,id] of Object.entries(ids).filter(([name]) => name !== 'coordinator')) {
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,`${name}@example.invalid`])
  }
  await db.query('INSERT INTO public.coordinators(id,auth_user_id,name,email) VALUES($1,$2,$3,$4)',
    [ids.coordinator,ids.manager,'fixture manager','manager@example.invalid'])
})
after(async () => { await db.close() })

test('registration requires Auth, creates one owner and a zero wallet without email confirmation', async () => {
  await assert.rejects(as('anon', null, signupSql,[ids.coordinator,'남']), /permission denied/)
  await assert.rejects(as('authenticated', null, signupSql,[ids.coordinator,'남']), /AUTH_REQUIRED/)
  a = (await register(ids.a,'남')).rows[0].id
  b = (await register(ids.b,'여')).rows[0].id
  c = (await register(ids.c,'여')).rows[0].id
  assert.equal((await as('authenticated',ids.a,'select public.get_my_profile_id() as id')).rows[0].id,a)
  assert.equal((await as('authenticated',ids.a,'select public.get_my_like_balance() as balance')).rows[0].balance,0)
  await assert.rejects(register(ids.a,'남'), /PROFILE_ALREADY_EXISTS/)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.dating_profiles')).rows[0].n,3)
})

test('private tables, internal functions, direct writes and coordinator identity are protected', async () => {
  for (const table of ['profile_contacts','profile_owners','profile_photos','payments','like_wallets','like_transactions','match_decisions','notification_logs','admin_members']) {
    await assert.rejects(as('authenticated',ids.a,`SELECT * FROM private.${table}`), /permission denied/)
    await assert.rejects(as('anon',null,`SELECT * FROM private.${table}`), /permission denied/)
  }
  await assert.rejects(as('authenticated',ids.a,'UPDATE private.like_wallets SET balance=999'), /permission denied/)
  await assert.rejects(as('authenticated',ids.a,'SELECT private.my_profile()'), /permission denied/)
  await assert.rejects(as('anon',null,'SELECT * FROM public.coordinators'), /permission denied/)
  assert.deepEqual((await as('authenticated',ids.a,'SELECT * FROM public.coordinators')).rows,[])
  const coords = (await as('anon',null,'SELECT * FROM public.list_active_coordinators()')).rows
  assert.deepEqual(Object.keys(coords[0]).sort(),['id','name'])
  await assert.rejects(as('authenticated',ids.a,'INSERT INTO public.likes(sender_profile_id,recipient_profile_id) VALUES($1,$2)',[a,b]), /permission denied/)
  await assert.rejects(as('authenticated',ids.a,'SELECT * FROM public.matches'), /permission denied/)
  assert.deepEqual((await as('authenticated',ids.a,'SELECT * FROM public.dating_profiles')).rows,[])
})

test('only assigned coordinator may review and direct arbitrary updates are denied', async () => {
  await assert.rejects(as('authenticated',ids.a,"SELECT public.review_dating_profile($1,'approved')",[a]), /PROFILE_NOT_AVAILABLE/)
  await assert.rejects(as('authenticated',ids.manager,"UPDATE public.dating_profiles SET company='changed' WHERE id=$1",[a]), /permission denied/)
  assert.equal((await as('authenticated',ids.manager,'SELECT * FROM public.dating_profiles')).rows.length,3)
  for (const p of [a,b,c]) await as('authenticated',ids.manager,"SELECT public.review_dating_profile($1,'approved')",[p])
  const row = (await db.query('SELECT reviewed_by, reviewed_at FROM public.dating_profiles WHERE id=$1',[a])).rows[0]
  assert.equal(row.reviewed_by,ids.coordinator)
  assert.ok(row.reviewed_at)
})

test('zero balance, self-like and same gender fail without partial writes', async () => {
  await assert.rejects(as('authenticated',ids.a,'SELECT public.send_like($1)',[b]), /INSUFFICIENT_LIKES/)
  await assert.rejects(as('authenticated',ids.a,'SELECT public.send_like($1)',[a]), /INVALID_TARGET/)
  await assert.rejects(as('authenticated',ids.b,'SELECT public.send_like($1)',[c]), /PROFILE_NOT_AVAILABLE/)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.likes')).rows[0].n,0)
})

test('Like debit, ledger and outbox are atomic; retries do not charge; reciprocal likes create one match', async () => {
  // Trusted fixture funding only; there is deliberately no exposed credit API.
  for (const u of [ids.a,ids.b]) {
    await db.query('UPDATE private.like_wallets SET balance=1 WHERE user_id=$1',[u])
    await db.query("INSERT INTO private.like_transactions(user_id,kind,delta,operation_id) VALUES($1,'admin_adjustment',1,gen_random_uuid())",[u])
  }
  const first = (await as('authenticated',ids.a,'SELECT public.send_like($1) AS id',[b])).rows[0].id
  assert.equal((await as('authenticated',ids.a,'SELECT public.send_like($1) AS id',[b])).rows[0].id,first)
  await assert.rejects(as('authenticated',ids.a,'SELECT public.send_like($1)',[c]), /INSUFFICIENT_LIKES/)
  await as('authenticated',ids.b,'SELECT public.send_like($1)',[a])
  await as('authenticated',ids.b,'SELECT public.send_like($1)',[a])
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.matches')).rows[0].n,1)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM private.notification_logs WHERE notification_type='MUTUAL_LIKE'")).rows[0].n,2)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM private.notification_logs WHERE notification_type='kakao_alimtalk_like_received'")).rows[0].n,2)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM private.match_decisions')).rows[0].n,2)
  assert.equal((await as('authenticated',ids.a,'SELECT public.get_my_like_balance() AS b')).rows[0].b,0)
  const totals = (await db.query(`SELECT w.balance, sum(t.delta)::int AS total FROM private.like_wallets w
    JOIN private.like_transactions t USING(user_id) GROUP BY w.user_id`)).rows
  assert.ok(totals.every(r => r.balance === r.total))
})

test('anonymous, suspended, deleted and inactive-owner accounts cannot use ownership RPCs', async () => {
  for (const change of ["is_anonymous=true", "banned_until=now()+interval '1 day'", 'deleted_at=now()']) {
    await db.query(`UPDATE auth.users SET ${change} WHERE id=$1`,[ids.d])
    await assert.rejects(as('authenticated',ids.d,'SELECT public.get_my_profile_id()'), /AUTH_REQUIRED/)
    await db.query('UPDATE auth.users SET is_anonymous=false,banned_until=null,deleted_at=null WHERE id=$1',[ids.d])
  }
  await db.query('UPDATE private.profile_owners SET active=false WHERE user_id=$1',[ids.a])
  await assert.rejects(as('authenticated',ids.a,'SELECT public.get_my_like_balance()'), /PROFILE_REQUIRED/)
  await db.query('UPDATE private.profile_owners SET active=true WHERE user_id=$1',[ids.a])
})

test('all new privileged public functions have an explicit browser allowlist', async () => {
  const rows = (await db.query(`SELECT p.proname, has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS member
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef`)).rows
  for (const r of rows) {
    assert.equal(r.anon,r.proname === 'list_active_coordinators',r.proname)
    assert.equal(r.member,!['claim_like_notification','finish_like_notification'].includes(r.proname),r.proname)
  }
})

test('a late outbox failure rolls back the like, debit and ledger together', async () => {
  await db.query('UPDATE private.like_wallets SET balance=1 WHERE user_id=$1',[ids.c])
  await db.query("INSERT INTO private.like_transactions(user_id,kind,delta,operation_id) VALUES($1,'admin_adjustment',1,gen_random_uuid())",[ids.c])
  await db.exec(`CREATE FUNCTION private.test_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'TEST_OUTBOX_FAILURE'; END $$;
    CREATE TRIGGER test_fail_outbox BEFORE INSERT ON private.notification_logs
      FOR EACH ROW EXECUTE FUNCTION private.test_fail_outbox();`)
  try {
    await assert.rejects(as('authenticated',ids.c,'SELECT public.send_like($1)',[a]), /TEST_OUTBOX_FAILURE/)
    assert.equal((await as('authenticated',ids.c,'SELECT public.get_my_like_balance() AS b')).rows[0].b,1)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.likes WHERE sender_profile_id=$1',[c])).rows[0].n,0)
    assert.equal((await db.query("SELECT count(*)::int AS n FROM private.like_transactions WHERE user_id=$1 AND kind='sent_like'",[ids.c])).rows[0].n,0)
  } finally {
    await db.exec('DROP TRIGGER test_fail_outbox ON private.notification_logs; DROP FUNCTION private.test_fail_outbox()')
  }
})

test('legacy ownership requires an explicit administrator and cannot be reassigned', async () => {
  const legacy = (await db.query(`INSERT INTO public.dating_profiles(coordinator_id,nickname,gender,age,company,height_cm,mbti)
    VALUES($1,'legacy','남',30,'fixture',170,'ENFP') RETURNING id`,[ids.coordinator])).rows[0].id
  for (const user of [ids.a,ids.manager]) {
    await assert.rejects(as('authenticated',user,'SELECT public.link_reviewed_legacy_profile($1,$2)',[legacy,ids.d]), /ADMIN_REQUIRED/)
  }
  await db.query('INSERT INTO private.admin_members(user_id) VALUES($1)',[ids.manager])
  await as('authenticated',ids.manager,'SELECT public.link_reviewed_legacy_profile($1,$2)',[legacy,ids.d])
  assert.equal((await as('authenticated',ids.d,'SELECT public.get_my_profile_id() AS id')).rows[0].id,legacy)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM private.admin_audit_logs WHERE profile_id=$1',[legacy])).rows[0].n,1)
  await assert.rejects(as('authenticated',ids.manager,'SELECT public.link_reviewed_legacy_profile($1,$2)',[legacy,ids.a]), /duplicate key/)
  await assert.rejects(db.query('UPDATE private.profile_owners SET user_id=$1 WHERE profile_id=$2',[ids.a,legacy]), /OWNERSHIP_TRANSFER_FORBIDDEN/)
})

test('payment product, ownership, provider identity and purchase ledger constraints reject invalid writes', async () => {
  const request = '30000000-0000-4000-8000-000000000001'
  const sql = `INSERT INTO private.payments(user_id,profile_id,environment,merchant_id,provider_payment_id,request_id)
    VALUES($1,$2,'test','fixture-merchant','fixture-transaction',$3) RETURNING id`
  const payment = (await db.query(sql,[ids.a,a,request])).rows[0].id
  await assert.rejects(db.query(sql,[ids.a,a,'30000000-0000-4000-8000-000000000002']), /duplicate key/)
  await assert.rejects(db.query('UPDATE private.payments SET amount=1 WHERE id=$1',[payment]), /check constraint/)
  await assert.rejects(db.query('UPDATE private.payments SET profile_id=$1 WHERE id=$2',[b,payment]), /foreign key constraint/)
  await db.query("INSERT INTO private.like_transactions(user_id,kind,delta,payment_id) VALUES($1,'purchase',10,$2)",[ids.a,payment])
  await assert.rejects(db.query("INSERT INTO private.like_transactions(user_id,kind,delta,payment_id) VALUES($1,'purchase',10,$2)",[ids.a,payment]), /duplicate key/)
  await assert.rejects(db.query('UPDATE private.like_transactions SET delta=20 WHERE payment_id=$1',[payment]), /LEDGER_APPEND_ONLY/)
})

test('a third profile cannot be attached to an existing match decision', async () => {
  const match = (await db.query('SELECT id FROM public.matches LIMIT 1')).rows[0].id
  await assert.rejects(db.query('INSERT INTO private.match_decisions(match_id,profile_id) VALUES($1,$2)',[match,c]), /MATCH_PARTICIPANT_REQUIRED/)
})
