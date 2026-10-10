import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

// Synthetic fixtures in memory only. No .env or hosted database access.
const db = new PGlite({ extensions: { pgcrypto } })
const ids = {
  female: '10000000-0000-4000-8000-000000000001',
  male: '10000000-0000-4000-8000-000000000002',
  noProfile: '10000000-0000-4000-8000-000000000003',
  anonymous: '10000000-0000-4000-8000-000000000004',
  banned: '10000000-0000-4000-8000-000000000005',
  registrant: '10000000-0000-4000-8000-000000000006',
  coordinator: '20000000-0000-4000-8000-000000000001',
  inactiveCoordinator: '20000000-0000-4000-8000-000000000002',
}
const defaultFilters = [null, null, [], [], [], [], [], [], 0]

async function as(role, userId, sql, params = []) {
  assert.ok(['anon', 'authenticated'].includes(role))
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [userId ?? ''])
  await db.exec(`SET ROLE ${role}`)
  try { return await db.query(sql, params) } finally { await db.exec('RESET ROLE') }
}

async function browse(params = defaultFilters, userId = ids.female) {
  return (await as('authenticated', userId,
    'SELECT public.browse_approved_profiles($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result', params)).rows[0].result
}

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
  for (const file of ['001_init.sql', '002_rls.sql', '003_like_notifications.sql', '20261003140239_phase3_ownership_security.sql', '20261010140855_approved_profile_browse.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  await db.exec(await readFile(new URL('../../supabase/migrations/20261010142958_approved_profile_multi_filters.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../../supabase/migrations/20261010144123_fix_profile_browse_volatility.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../../supabase/migrations/20261010173018_add_profile_intro_and_filters.sql', import.meta.url), 'utf8'))
  await db.query(`INSERT INTO auth.users(id,email,is_anonymous,banned_until) VALUES
    ($1,'female@example.invalid',false,null),($2,'male@example.invalid',false,null),
    ($3,'none@example.invalid',false,null),($4,'anon@example.invalid',true,null),
    ($5,'banned@example.invalid',false,now()+interval '1 day'),
    ($6,'registrant@example.invalid',false,null)`,
    [ids.female, ids.male, ids.noProfile, ids.anonymous, ids.banned, ids.registrant])
  await db.query(`INSERT INTO public.coordinators(id,name,email,active) VALUES
    ($1,'fixture','manager@example.invalid',true),($2,'inactive','inactive@example.invalid',false)`,
    [ids.coordinator, ids.inactiveCoordinator])

  const femaleProfile = (await db.query(`INSERT INTO public.dating_profiles
    (coordinator_id,nickname,gender,age,company,height_cm,mbti,status)
    VALUES($1,'female viewer','여',30,'fixture',165,'ISFJ','approved') RETURNING id`, [ids.coordinator])).rows[0].id
  const maleProfile = (await db.query(`INSERT INTO public.dating_profiles
    (coordinator_id,nickname,gender,age,company,height_cm,mbti,status)
    VALUES($1,'male viewer','남',30,'fixture',175,'ISTJ','approved') RETURNING id`, [ids.coordinator])).rows[0].id
  await db.query('INSERT INTO private.profile_owners(profile_id,user_id) VALUES($1,$2),($3,$4)',
    [femaleProfile, ids.female, maleProfile, ids.male])

  for (const gender of ['남', '여']) {
    await db.query(`INSERT INTO public.dating_profiles
      (coordinator_id,nickname,gender,age,company,height_cm,mbti,status,self_traits,self_face_types,self_animal_types,self_skin_types,self_body_type,created_at)
      SELECT $1,$2||i,$3,18+i,'fixture company',170,
        CASE WHEN i%2=0 THEN 'ENFP' ELSE 'ENTJ' END,'approved',
        CASE WHEN i%3=0 THEN ARRAY['다정한'] ELSE ARRAY['유머러스한'] END,
        CASE WHEN i%2=0 THEN ARRAY['두부상'] ELSE ARRAY['아랍상'] END,
        CASE WHEN i%4=0 THEN ARRAY['강아지상'] ELSE ARRAY['고양이상'] END,
        CASE WHEN i%5=0 THEN ARRAY['흰 피부'] ELSE ARRAY['중간 피부'] END,
        CASE WHEN i%2=0 THEN '보통' ELSE '슬림' END,
        '2026-01-01'::timestamptz+i*interval '1 minute'
      FROM generate_series(1,26) i`, [ids.coordinator, `${gender} fixture `, gender])
  }
  await db.query(`INSERT INTO public.dating_profiles
    (coordinator_id,nickname,gender,age,company,height_cm,mbti,status)
    VALUES($1,'pending male','남',30,'fixture',170,'ENFP','pending'),
          ($2,'inactive male','남',30,'fixture',170,'ENFP','approved')`,
    [ids.coordinator, ids.inactiveCoordinator])
})

after(async () => db.close())

test('only active authenticated members with an owned profile can browse', async () => {
  await assert.rejects(as('anon', null, 'SELECT public.browse_approved_profiles()'), /permission denied/)
  await assert.rejects(browse(defaultFilters, null), /AUTH_REQUIRED/)
  await assert.rejects(browse(defaultFilters, ids.anonymous), /AUTH_REQUIRED/)
  await assert.rejects(browse(defaultFilters, ids.banned), /AUTH_REQUIRED/)
  await assert.rejects(browse(defaultFilters, ids.noProfile), /PROFILE_REQUIRED/)
})

test('female members receive only approved male profiles from active coordinators', async () => {
  const result = await browse()
  assert.equal(result.items.length, 24)
  assert.equal(result.has_more, true)
  for (const row of result.items) {
    assert.equal(row.gender, '남')
    assert.equal(row.status, 'approved')
    assert.notEqual(row.nickname, 'inactive male')
    for (const field of ['phone_number','owner_user_id','coordinator_id','rejection_reason','reviewed_by','email','auth_user_id']) {
      assert.ok(!Object.hasOwn(row, field), field)
    }
  }
})

test('male members receive only female profiles', async () => {
  const result = await browse(defaultFilters, ids.male)
  assert.equal(result.items.length, 24)
  assert.ok(result.items.every((row) => row.gender === '여'))
})

test('pages are disjoint and indicate the last page', async () => {
  const first = await browse()
  const second = await browse([null, null, [], [], [], [], [], [], 24])
  assert.equal(second.items.length, 3)
  assert.equal(second.has_more, false)
  assert.ok(second.items.every((row) => !first.items.some((previous) => previous.id === row.id)))
})

test('age and multi-select groups combine with OR inside each group and AND across groups', async () => {
  const result = await browse([30, 40, ['ENFP','INTJ'], ['다정한'], ['두부상','아랍상'], ['강아지상'], ['중간 피부'], ['보통'], 0])
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].nickname, '남 fixture 12')
  assert.equal((await browse([null, null, ['ENFP','ENTJ'], [], [], [], ['흰 피부','중간 피부'], ['슬림','보통'], 0])).items.length, 24)
})

test('new registrations require and store a trimmed introduction', async () => {
  const sql = `SELECT public.submit_dating_profile(
    $1,'new profile','남',30,'fixture',175,'ENFP',ARRAY['상관없음'],ARRAY['상관없음'],
    ARRAY['상관없음'],null,null,true,null,null,true,ARRAY['상관없음'],ARRAY['상관없음'],
    ARRAY['중간 피부'],ARRAY['강아지상'],ARRAY['두부상'],ARRAY['다정한'],'보통',
    '01000000000',false,$2) AS id`
  await assert.rejects(as('authenticated', ids.registrant, sql, [ids.coordinator, '   ']), /INVALID_PROFILE/)
  const id = (await as('authenticated', ids.registrant, sql, [ids.coordinator, '  반갑습니다. 좋은 인연을 만나고 싶어요.  '])).rows[0].id
  assert.equal((await db.query('SELECT introduction FROM public.dating_profiles WHERE id=$1', [id])).rows[0].introduction,
    '반갑습니다. 좋은 인연을 만나고 싶어요.')
})

test('invalid filters are rejected', async () => {
  const invalid = [
    [40,20,[],[],[],[],[],[],0],
    [null,null,['INVALID'],[],[],[],[],[],0],
    [null,null,[],['INVALID'],[],[],[],[],0],
    [null,null,[],[],['INVALID'],[],[],[],0],
    [null,null,[],[],[],['INVALID'],[],[],0],
    [null,null,[],[],[],[],['INVALID'],[],0],
    [null,null,[],[],[],[],[],['INVALID'],0],
    [null,null,[],[],[],[],[],[],-1],
  ]
  for (const params of invalid) await assert.rejects(browse(params), /INVALID_BROWSE_FILTER/)
})

test('direct tables stay protected and the public wrapper has no definer privileges', async () => {
  assert.deepEqual((await as('authenticated', ids.female, 'SELECT * FROM public.dating_profiles')).rows, [])
  await assert.rejects(as('authenticated', ids.female, 'SELECT * FROM private.profile_contacts'), /permission denied/)
  const result = await db.query("SELECT prosecdef FROM pg_proc WHERE oid='public.browse_approved_profiles(integer,integer,text[],text[],text[],text[],text[],text[],integer)'::regprocedure")
  assert.equal(result.rows[0].prosecdef, false)
})
