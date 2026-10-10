// Offline expected-schema comparison. No .env, network, live users or fixture rows.
import { readFile, writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const root = new URL('../', import.meta.url)
const db = new PGlite({ extensions: { pgcrypto } })
const files = ['001_init.sql','002_rls.sql','003_like_notifications.sql','20261003140239_phase3_ownership_security.sql']
const hashes = {}
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, is_anonymous boolean DEFAULT false,
      banned_until timestamptz, deleted_at timestamptz, email_confirmed_at timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`)
  for (const file of files) {
    const sql = await readFile(new URL(`supabase/migrations/${file}`,root),'utf8')
    hashes[file] = createHash('sha256').update(sql).digest('hex')
    await db.exec(sql)
  }
  const query = await readFile(new URL('supabase/inspection/phase3_6_catalog.sql',root),'utf8')
  const expected = (await db.query(query)).rows[0].metadata
  const actual = JSON.parse(await readFile(new URL('docs/phase3-6-final-catalog.json',root),'utf8')).metadata
  // PG18 catalogs NOT NULL constraints separately; PG17 stores them on columns.
  // Compare nullability in the columns section and retain all other constraints.
  const expectedNotNullConstraints = expected.constraints.filter(x=>x.definition.startsWith('NOT NULL ')).length
  const actualNotNullConstraints = actual.constraints.filter(x=>x.definition.startsWith('NOT NULL ')).length
  expected.constraints = expected.constraints.filter(x=>!x.definition.startsWith('NOT NULL '))
  actual.constraints = actual.constraints.filter(x=>!x.definition.startsWith('NOT NULL '))
  const comparisons = Object.keys(expected).map(section => ({
    section, expectedCount: expected[section]?.length ?? 0, actualCount: actual[section]?.length ?? 0,
    equal: isDeepStrictEqual(expected[section],actual[section]),
    differences: (expected[section] ?? []).flatMap((row,index) =>
      isDeepStrictEqual(row,actual[section]?.[index]) ? [] : [{index,expected:row,actual:actual[section]?.[index]}]),
  }))
  const result = { localPostgresVersion:(await db.query('SHOW server_version')).rows[0].server_version,
    normalization:{expectedNotNullConstraints,actualNotNullConstraints,nullabilityComparedIn:'columns'},
    migrationSha256:hashes, comparisons, pass:comparisons.every(x=>x.equal) }
  await writeFile(new URL('docs/phase3-6-schema-comparison.json',root),JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify({pass:result.pass,comparisons:comparisons.map(({differences,...item})=>item)},null,2))
  if (!result.pass) process.exitCode = 1
} finally { await db.close() }
