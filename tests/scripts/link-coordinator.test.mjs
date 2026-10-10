import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linkCoordinator } from '../../scripts/link-coordinator.mjs'

const authUserId = '10000000-0000-4000-8000-000000000001'
const email = 'manager@example.invalid'

function fixture({ accountEmail = email, active = true, existingLink = null, otherLink = false, changed = false } = {}) {
  const writes = []
  const client = {
    auth: { admin: { getUserById: async () => ({ data: { user: {
      id: authUserId, email: accountEmail, email_confirmed_at: '2026-01-01T00:00:00Z',
    } }, error: null }) } },
    from(table) {
      assert.equal(table, 'coordinators')
      const filters = []
      let update
      const query = {
        select() { return query },
        eq(column, value) { filters.push(['eq', column, value]); return query },
        is(column, value) { filters.push(['is', column, value]); return query },
        update(value) { update = value; return query },
        then(resolve, reject) {
          let data
          if (update) {
            writes.push({ update, filters })
            data = changed ? [] : [{ id: 'coordinator-id', auth_user_id: authUserId }]
          } else if (filters.some(([, column]) => column === 'auth_user_id')) {
            data = otherLink ? [{ id: 'another-coordinator' }] : []
          } else {
            data = [{ id: 'coordinator-id', auth_user_id: existingLink, active }]
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  return { client, writes }
}

test('inspection defaults to no writes', async () => {
  const { client, writes } = fixture()
  assert.equal((await linkCoordinator(client, { email, authUserId })).status, 'ready')
  assert.equal(writes.length, 0)
})

for (const [reason, options] of [
  ['wrong Auth email', { accountEmail: 'other@example.invalid' }],
  ['inactive coordinator', { active: false }],
  ['existing link to another account', { existingLink: 'another-auth-user' }],
  ['Auth account assigned elsewhere', { otherLink: true }],
]) {
  test(`apply refuses ${reason}`, async () => {
    const { client, writes } = fixture(options)
    await assert.rejects(linkCoordinator(client, { email, authUserId, apply: true }))
    assert.equal(writes.length, 0)
  })
}

test('apply changes only the verified null link with conditional filters', async () => {
  const { client, writes } = fixture()
  assert.equal((await linkCoordinator(client, { email, authUserId, apply: true })).status, 'linked')
  assert.deepEqual(writes, [{ update: { auth_user_id: authUserId }, filters: [
    ['eq', 'id', 'coordinator-id'], ['eq', 'email', email],
    ['eq', 'active', true], ['is', 'auth_user_id', null],
  ] }])
})

test('an existing correct link is left unchanged', async () => {
  const { client, writes } = fixture({ existingLink: authUserId })
  assert.equal((await linkCoordinator(client, { email, authUserId, apply: true })).status, 'already-linked')
  assert.equal(writes.length, 0)
})

test('a concurrent row change cannot be reported as a successful link', async () => {
  const { client } = fixture({ changed: true })
  await assert.rejects(linkCoordinator(client, { email, authUserId, apply: true }), /not confirmed/)
})
