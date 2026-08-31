import { test, expect } from '@playwright/test'

test.describe('Smoke — app loads', () => {
  test('renders a WebGL canvas', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('no JS errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
  })
})
