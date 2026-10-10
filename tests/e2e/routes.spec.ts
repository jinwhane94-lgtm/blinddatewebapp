import { expect, test } from './fixtures'

test.describe('public and manager routes', () => {
  test('home page exposes both login links', async ({ page }) => {
    await page.goto('/#/')

    await expect(page.getByRole('link', { name: '일반 사용자 로그인' })).toHaveAttribute('href', '#/login')
    await expect(page.getByRole('link', { name: '주선자 로그인' })).toHaveAttribute('href', '#/manager/login')
    await expect(page.getByRole('link', { name: '주선자 회원가입' })).toHaveAttribute('href', '#/manager/login')
  })

  test('application form renders', async ({ page }) => {
    await page.goto('/#/apply')

    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('select[name="coordinator_id"]')).toBeVisible()
    await expect(page.locator('input[name="nickname"]')).toBeVisible()
    await expect(page.locator('input[name="phone_number"]')).toBeVisible()
    await expect(page.locator('input[name="kakao_notification_enabled"]')).toBeVisible()
    await expect(page.locator('textarea[name="introduction"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('like notification button target renders without exposing profile data', async ({ page }) => {
    await page.goto('/#/likes')

    await expect(page.getByRole('heading', { name: '새로운 호감이 도착했어요' })).toBeVisible()
    await expect(page.getByRole('link', { name: '서비스 홈으로 이동' })).toBeVisible()
  })

  test('manager login form renders', async ({ page }) => {
    await page.goto('/#/manager/login')

    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('unauthenticated dashboard access returns to login', async ({ page }) => {
    await page.goto('/#/manager/dashboard')

    await expect(page).toHaveURL(/#\/manager\/login$/)
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })

  test('unauthenticated request-list access returns to login', async ({ page }) => {
    await page.goto('/#/manager/requests')
    await expect(page).toHaveURL(/#\/manager\/login$/)
  })
})
