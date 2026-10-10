import { expect, test } from './fixtures'

test('profile filters use direct age inputs and multi-select skin and body toggles', async ({ page }) => {
  const uid = '10000000-0000-4000-8000-000000000009'
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  let lastRequest: Record<string, unknown> | undefined

  await page.route('**/auth/v1/token?grant_type=password', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, aud: 'authenticated', role: 'authenticated', exp })}.test-signature`,
      refresh_token: 'test-profile-filter-session',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
      user: { id: uid, email: 'member@example.invalid', aud: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }),
  }))
  await page.route('**/rest/v1/rpc/browse_approved_profiles*', (route) => {
    lastRequest = route.request().postDataJSON()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], has_more: false }) })
  })

  await page.goto('/#/login')
  await page.getByLabel('이메일', { exact: true }).fill('member@example.invalid')
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-only')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/#\/apply$/)
  await page.goto('/#/profiles')

  await expect(page.getByLabel('최소 나이')).toHaveAttribute('type', 'number')
  await expect(page.getByLabel('최대 나이')).toHaveAttribute('type', 'number')
  await page.getByLabel('최소 나이').fill('25')
  await page.getByLabel('최대 나이').fill('35')

  await page.getByRole('button', { name: '피부', exact: true }).click()
  await page.getByRole('button', { name: '흰 피부', exact: true }).click()
  await page.getByRole('button', { name: '체형', exact: true }).click()
  await page.getByRole('button', { name: '보통', exact: true }).click()

  await expect.poll(() => lastRequest).toMatchObject({
    p_age_min: 25,
    p_age_max: 35,
    p_skin_types: ['흰 피부'],
    p_body_types: ['보통'],
  })
  await expect(page.locator('button[aria-controls]').filter({ hasText: '피부' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('button[aria-controls]').filter({ hasText: '체형' })).toHaveAttribute('aria-expanded', 'true')
})
