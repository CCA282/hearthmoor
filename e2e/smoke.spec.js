import { test, expect } from '@playwright/test'
import { startLocalGame } from './helpers.js'

test.describe('Smoke — app loads', () => {
  test('shows the lobby on first load', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Hearthmoor')).toBeVisible()
    await expect(page.getByText('Jouer en local')).toBeVisible()
  })

  test('starting a local game renders a WebGL canvas', async ({ page }) => {
    await startLocalGame(page)
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('no JS errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await startLocalGame(page)
    await page.waitForTimeout(500)
    expect(errors).toHaveLength(0)
  })
})
