import { test, expect } from '@playwright/test'

test.describe('Smoke — app loads', () => {
  test('shows the placeholder screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Hearthmoor')).toBeVisible()
  })

  test('no JS errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.waitForTimeout(300)
    expect(errors).toHaveLength(0)
  })
})
