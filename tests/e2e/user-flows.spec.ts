import { type Page, type Route } from '@playwright/test'
import { expect, test } from './fixtures'

const coordinator = {
  id: '11111111-1111-4111-8111-111111111111',
  auth_user_id: '22222222-2222-4222-8222-222222222222',
  name: '테스트 주선자',
  email: 'manager@example.com',
  active: true,
  created_at: '2026-01-01T00:00:00.000Z',
}

const profiles = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    coordinator_id: coordinator.id,
    nickname: '모바일에서도 아주 긴 닉네임 테스트',
    gender: '남',
    age: 30,
    company: '아주 긴 회사 이름도 카드 바깥으로 넘치지 않는지 확인하는 회사',
    height_cm: 178,
    mbti: 'ENFP',
    preferred_skin_types: ['상관없음'],
    preferred_animal_types: ['강아지상'],
    preferred_face_types: ['두부상'],
    preferred_age_min: 27,
    preferred_age_max: 33,
    preferred_age_any: false,
    preferred_height_min: 160,
    preferred_height_max: 175,
    preferred_height_any: false,
    preferred_body_types: ['보통'],
    preferred_traits: ['대화가 잘 통하는', '배려심 있는'],
    self_skin_types: ['중간 피부'],
    self_animal_types: ['고양이상'],
    self_face_types: ['두부상'],
    self_traits: ['다정한'],
    self_body_type: '보통',
    introduction: '함께 즐거운 대화를 나누고 싶어요.',
    status: 'pending',
    rejection_reason: null,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    reviewed_at: null,
    reviewed_by: null,
  },
]

function json(route: Route, body: unknown, status = 200, contentType = 'application/json') {
  return route.fulfill({ status, contentType, body: JSON.stringify(body) })
}

async function mockPublicCoordinators(page: Page) {
  await page.route('**/rest/v1/rpc/list_active_coordinators*', (route) => json(route, [{ id: coordinator.id, name: coordinator.name }]))
}

function createAccessToken() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  return {
    accessToken: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: coordinator.auth_user_id,
      aud: 'authenticated',
      role: 'authenticated',
      exp: expiresAt,
    })}.test-signature`,
    expiresAt,
  }
}

async function mockSuccessfulManagerSession(page: Page) {
  const { accessToken, expiresAt } = createAccessToken()

  await page.route('**/auth/v1/token?grant_type=password', (route) => json(route, {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: 'test-refresh-token',
    user: {
      id: coordinator.auth_user_id,
      aud: 'authenticated',
      role: 'authenticated',
      email: coordinator.email,
      app_metadata: {},
      user_metadata: {},
      created_at: coordinator.created_at,
    },
  }))

  await page.route('**/rest/v1/coordinators*', (route) =>
    {
      expect(new URL(route.request().url()).searchParams.get('auth_user_id')).toBe(`eq.${coordinator.auth_user_id}`)
      return json(route, coordinator, 200, 'application/vnd.pgrst.object+json')
    },
  )
  await page.route('**/rest/v1/dating_profiles*', (route) => {
    if (route.request().method() !== 'GET') {
      return json(route, { message: 'Mutation blocked by E2E mock' }, 405)
    }
    expect(new URL(route.request().url()).searchParams.get('coordinator_id')).toBe(`eq.${coordinator.id}`)
    return json(route, profiles)
  })
}

async function loginToMockedDashboard(page: Page) {
  await mockSuccessfulManagerSession(page)
  await page.goto('/#/manager/login')
  await page.getByLabel('이메일').fill(coordinator.email)
  await page.getByLabel('비밀번호').fill('not-a-real-password')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/#\/manager\/dashboard$/)
  await expect(page.getByRole('heading', { name: `${coordinator.name} 주선자` })).toBeVisible()
}

async function openRegistrationRequests(page: Page) {
  await page.getByRole('link', { name: '소개팅 매물 승인하기' }).click()
  await expect(page).toHaveURL(/#\/manager\/requests$/)
  await expect(page.getByRole('heading', { name: '소개팅 매물 등록 요청' })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport)
}

test.describe('application form behavior', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicCoordinators(page)
    await page.goto('/#/apply')
  })

  test('shows all core inputs and prevents invalid submission', async ({ page }) => {
    let submitProfileRequests = 0
    await page.route('**/rest/v1/rpc/submit_dating_profile*', (route) => {
      submitProfileRequests += 1
      return json(route, { message: 'Mutation blocked by E2E mock' }, 405)
    })

    await expect(page.getByLabel('주선자 선택')).toContainText(coordinator.name)
    await expect(page.getByLabel('닉네임')).toBeVisible()
    await expect(page.getByLabel(/나이 \*/)).toBeVisible()
    await expect(page.getByLabel('회사명')).toBeVisible()
    await expect(page.getByLabel('키 (cm)')).toBeVisible()
    await expect(page.getByLabel('MBTI')).toContainText('ENTJ')

    await page.getByRole('button', { name: '등록하기 💌' }).click()

    await expect(page.getByText('주선자를 선택해주세요.')).toBeVisible()
    await expect(page.getByText('닉네임을 입력해주세요.')).toBeVisible()
    await expect(page.getByText('성별을 선택해주세요.')).toBeVisible()
    await expect(page.getByText('휴대폰 번호를 올바르게 입력해주세요.')).toBeVisible()

    await page.getByLabel('주선자 선택').selectOption(coordinator.id)
    await page.getByLabel('닉네임').fill('테스트 사용자')
    await page.getByRole('button', { name: '남', exact: true }).click()
    await page.getByLabel(/나이 \*/).fill('30')
    await page.getByLabel('회사명').fill('테스트 회사')
    await page.getByLabel('키 (cm)').fill('175')
    await page.getByLabel('MBTI').selectOption('ENFP')
    await page.getByRole('button', { name: '흰 피부' }).first().click()
    await page.getByRole('button', { name: '토끼상' }).first().click()
    await page.getByRole('button', { name: '두부상' }).first().click()
    await page.getByRole('button', { name: '보통' }).first().click()
    await page.getByRole('button', { name: '착한' }).first().click()
    await page.getByRole('button', { name: '흰 피부' }).last().click()
    await page.getByRole('button', { name: '토끼상' }).last().click()
    await page.getByRole('button', { name: '두부상' }).last().click()
    await page.getByRole('button', { name: '착한' }).last().click()
    await page.getByRole('button', { name: '보통' }).last().click()
    await page.getByRole('button', { name: '등록하기 💌' }).click()

    await expect(page.getByText('최소 나이를 입력해주세요.')).toBeVisible()
    await expect(page.getByText('최소 키를 입력해주세요.')).toBeVisible()
    expect(submitProfileRequests).toBe(0)
  })

  test('keeps 상관없음 mutually exclusive in multi-selects', async ({ page }) => {
    const whiteSkin = page.getByRole('button', { name: '흰 피부' }).first()
    const any = page.getByRole('button', { name: '상관없음' }).first()
    const mediumSkin = page.getByRole('button', { name: '중간 피부' }).first()

    await whiteSkin.click()
    await any.click()
    await expect(whiteSkin).toHaveAttribute('aria-pressed', 'false')
    await expect(any).toHaveAttribute('aria-pressed', 'true')

    await mediumSkin.click()
    await expect(any).toHaveAttribute('aria-pressed', 'false')
    await expect(mediumSkin).toHaveAttribute('aria-pressed', 'true')
  })

  test('resets gender-specific body choices and supports keyboard range toggles', async ({ page }) => {
    await page.getByRole('button', { name: '남', exact: true }).click()
    await page.getByRole('button', { name: '건장' }).first().click()
    await page.getByRole('button', { name: '건장' }).last().click()

    await page.getByRole('button', { name: '여', exact: true }).click()
    await expect(page.getByRole('button', { name: '건장' })).toHaveCount(0)

    await page.getByRole('button', { name: '남', exact: true }).click()
    const sturdyButtons = page.getByRole('button', { name: '건장' })
    await expect(sturdyButtons.first()).toHaveAttribute('aria-pressed', 'false')
    await expect(sturdyButtons.last()).toHaveAttribute('aria-pressed', 'false')

    const ageAny = page.getByRole('switch', { name: '나이 범위 상관없음' })
    await ageAny.focus()
    await page.keyboard.press('Space')
    await expect(ageAny).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByPlaceholder('최소 나이')).toHaveCount(0)
  })
})

test.describe('manager login and dashboard', () => {
  for (const lookupFails of [false, true]) {
    test(`explains manager access failure after successful login: lookupFails=${lookupFails}`, async ({ page }) => {
      await mockSuccessfulManagerSession(page)
      await page.route('**/rest/v1/coordinators*', (route) =>
        lookupFails ? json(route, { message: 'Permission denied' }, 403) : json(route, null),
      )
      await page.goto('/#/manager/login')
      await page.getByLabel('이메일').fill(coordinator.email)
      await page.getByLabel('비밀번호').fill('not-a-real-password')
      await page.getByRole('button', { name: '로그인', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText(lookupFails ? '권한을 조회하지 못했습니다' : '활성 주선자 등록을 확인할 수 없습니다')
      await expect(page).toHaveURL(/#\/manager\/login$/)
      await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeEnabled()
      await page.goto('/#/manager/dashboard')
      await expect(page).toHaveURL(/#\/manager\/login$/)
      await expect(page.getByRole('alert')).toContainText(lookupFails ? '권한을 조회하지 못했습니다' : '활성 주선자 등록을 확인할 수 없습니다')
    })
  }

  test('validates login and shows a friendly invalid-credentials error', async ({ page }) => {
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      return json(route, { code: 'invalid_credentials', message: 'Invalid login credentials' }, 400)
    })

    await page.goto('/#/manager/login')
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page.getByText('유효한 이메일을 입력해주세요.')).toBeVisible()
    await expect(page.getByText('비밀번호를 입력해주세요.')).toBeVisible()

    await page.getByLabel('이메일').fill('wrong@example.com')
    await page.getByLabel('비밀번호').fill('wrong-password')
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page.getByRole('button', { name: '로그인 중...' })).toBeDisabled()
    await expect(page.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeVisible()
  })

  test('renders coordinator, filters, profile details, and rejection modal with mocked data', async ({ page }) => {
    await loginToMockedDashboard(page)
    await expect(page.getByText(profiles[0].nickname)).toHaveCount(0)
    await openRegistrationRequests(page)

    await expect(page.getByRole('button', { name: /^전체1$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^승인 대기1$/ })).toBeVisible()
    await expect(page.getByText(profiles[0].nickname)).toBeVisible()
    await expect(page.getByText('얼굴 이미지').first()).toBeVisible()

    await page.getByRole('button', { name: /^승인0$/ }).click()
    await expect(page.getByText('승인 상태의 프로필이 없습니다.')).toBeVisible()
    await page.getByRole('button', { name: /^승인 대기1$/ }).click()

    await page.getByRole('button', { name: '✕ 반려' }).click()
    await expect(page.getByRole('dialog', { name: '반려 사유 입력' })).toBeVisible()
    await page.getByRole('button', { name: '취소' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  for (const status of ['approved', 'rejected'] as const) {
    test(`reviews a request through the RPC: ${status}`, async ({ page }) => {
      let reviews = 0
      await page.route('**/rest/v1/rpc/review_dating_profile', (route) => {
        reviews += 1
        expect(route.request().postDataJSON()).toEqual({
          p_profile_id: profiles[0].id,
          p_status: status,
          p_reason: status === 'rejected' ? '테스트 반려 사유' : null,
        })
        return route.fulfill({ status: 204 })
      })
      await loginToMockedDashboard(page)
      await openRegistrationRequests(page)
      if (status === 'approved') {
        await page.getByRole('button', { name: '✓ 승인', exact: true }).click()
      } else {
        await page.getByRole('button', { name: '✕ 반려' }).click()
        await page.getByRole('dialog').getByRole('textbox').fill('테스트 반려 사유')
        await page.getByRole('button', { name: '반려하기', exact: true }).click()
      }
      await expect(page.getByText('승인 대기 상태의 프로필이 없습니다.')).toBeVisible()
      await page.getByRole('button', { name: status === 'approved' ? /^승인1$/ : /^반려1$/ }).click()
      await expect(page.getByText(profiles[0].nickname)).toBeVisible()
      if (status === 'rejected') await expect(page.getByText('테스트 반려 사유')).toBeVisible()
      expect(reviews).toBe(1)
    })
  }

  test('keeps the request pending when review is denied', async ({ page }) => {
    await page.route('**/rest/v1/rpc/review_dating_profile', (route) => json(route, { message: 'PROFILE_NOT_AVAILABLE' }, 403))
    await loginToMockedDashboard(page)
    await openRegistrationRequests(page)
    await page.getByRole('button', { name: '✓ 승인', exact: true }).click()
    await expect(page.getByText('승인 처리 중 오류가 발생했습니다.')).toBeVisible()
    await expect(page.getByText(profiles[0].nickname)).toBeVisible()
    await expect(page.getByRole('button', { name: /^승인 대기1$/ })).toBeVisible()
  })
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`has no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await mockPublicCoordinators(page)

    await page.goto('/#/apply')
    await expectNoHorizontalOverflow(page)

    await page.goto('/#/manager/login')
    await expectNoHorizontalOverflow(page)

    await loginToMockedDashboard(page)
    await expectNoHorizontalOverflow(page)
    await openRegistrationRequests(page)
    await expectNoHorizontalOverflow(page)

    if (viewport.width === 390) {
      await page.getByRole('button', { name: '✕ 반려' }).click()
      await expect(page.getByRole('dialog')).toBeInViewport()
      await expectNoHorizontalOverflow(page)
    }
  })
}
