import { expect, test } from '@playwright/test'

test.describe('public and manager routes', () => {
  test('application form renders', async ({ page }) => {
    await page.goto('/#/apply')

    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('select[name="coordinator_id"]')).toBeVisible()
    await expect(page.locator('input[name="nickname"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
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
})
