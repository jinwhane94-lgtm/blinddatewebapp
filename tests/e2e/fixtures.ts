import { test as base, expect } from '@playwright/test'

// Deny every unmocked backend request, including the existing route smoke tests.
// Tests cannot create real Auth accounts/profiles or call real Edge Functions.
export const test = base.extend({
  page: async ({ page }, providePage) => {
    await page.route(/\/(auth|rest|storage)\/v1\/|\/functions\/v1\//, (route) => {
      if (route.request().url().includes('/rpc/list_active_coordinators')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Unmocked backend request blocked by E2E"}' })
    })
    await providePage(page)
  },
})
export { expect }
