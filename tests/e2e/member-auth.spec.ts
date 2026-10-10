import { expect, test } from './fixtures'

test('signup validates password confirmation without calling Auth', async ({ page }) => {
  let calls = 0
  await page.route('**/auth/v1/signup', (route) => {
    calls += 1
    return route.fulfill({ status: 400, body: '{}' })
  })
  await page.goto('/#/signup')
  await page.getByLabel('이메일', { exact: true }).fill('member@example.invalid')
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-only')
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('different-password')
  await page.getByRole('button', { name: '회원가입', exact: true }).click()
  await expect(page.getByText('비밀번호가 일치하지 않습니다.')).toBeVisible()
  expect(calls).toBe(0)
})

test('signup sends credentials only to Supabase Auth and handles confirmation-required configuration', async ({ page }) => {
  let body: Record<string, unknown> | undefined
  await page.route('**/auth/v1/signup', (route) => {
    body = route.request().postDataJSON()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: '10000000-0000-4000-8000-000000000002', email: 'member@example.invalid',
      aud: 'authenticated', created_at: '2026-01-01T00:00:00Z',
    }) })
  })
  await page.goto('/#/signup')
  await page.getByLabel('이메일', { exact: true }).fill('member@example.invalid')
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-only')
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: '회원가입', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('이메일 확인이 필요한 경우')
  expect(body?.email).toBe('member@example.invalid')
  expect(body?.password).toBe('test-password-only')
  expect(body).not.toHaveProperty('passwordConfirmation')
  expect(body).not.toHaveProperty('owner_user_id')
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test-password-only')
})

test('member login uses password grant and displays credentials error', async ({ page }) => {
  await page.route('**/auth/v1/token?grant_type=password', (route) => route.fulfill({
    status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
  }))
  await page.goto('/#/login')
  await page.getByLabel('이메일', { exact: true }).fill('member@example.invalid')
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('이메일 또는 비밀번호가 올바르지 않습니다.')
})

for (const mode of ['signup','login']) {
  test(`${mode} accepts Supabase session and returns to profile registration`, async ({ page }) => {
    const uid = '10000000-0000-4000-8000-000000000002'
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const exp = Math.floor(Date.now() / 1000) + 3600
    const endpoint = mode === 'signup' ? '**/auth/v1/signup' : '**/auth/v1/token?grant_type=password'
    await page.route(endpoint, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, aud: 'authenticated', role: 'authenticated', exp })}.test-signature`,
      refresh_token: 'test-session-only', token_type: 'bearer', expires_in: 3600, expires_at: exp,
      user: { id: uid, email: 'member@example.invalid', aud: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }) }))
    await page.goto(`/#/${mode}`)
    await page.getByLabel('이메일', { exact: true }).fill('member@example.invalid')
    await page.getByLabel('비밀번호', { exact: true }).fill('test-password-only')
    if (mode === 'signup') await page.getByLabel('비밀번호 확인', { exact: true }).fill('test-password-only')
    await page.getByRole('button', { name: mode === 'signup' ? '회원가입' : '로그인', exact: true }).click()
    await expect(page).toHaveURL(/#\/apply$/)
    await expect(page.locator('form')).toBeVisible()
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test-password-only')
  })
}
