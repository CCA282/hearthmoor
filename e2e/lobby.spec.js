import { test, expect } from '@playwright/test'

// Supabase Realtime (channels, presence, Phoenix wire protocol) is never actually reached in
// this suite — src/net/realtime.js checks window.__HEARTHMOOR_REALTIME_TEST_HOOK__ before
// touching supabase.channel(...), and these helpers install a fake hook instead.

async function mockRealtimeHost(page, { serverCode = 'ABC123' } = {}) {
  await page.addInitScript(({ serverCode }) => {
    window.__HEARTHMOOR_REALTIME_TEST_HOOK__ = {
      createRoomAsHost() {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ code: serverCode, hostId: 'test-host' }), 80)
        })
      },
      leaveRoom() {},
    }
  }, { serverCode })
}

async function mockRealtimeGuest(page) {
  await page.addInitScript(() => {
    window.__HEARTHMOOR_REALTIME_TEST_HOOK__ = {
      joinRoomAsGuest(code, name) {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ guestId: 'test-guest' }), 80)
        })
      },
      leaveRoom() {},
    }
  })
}

async function navigateToOnline(page) {
  await page.goto('/')
  await page.getByText('Jouer en ligne').click()
}

test.describe('Lobby — online', () => {
  test('lobby shows the online option', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Jouer en ligne')).toBeVisible()
  })

  test('host: creates a room and shows the code from the server', async ({ page }) => {
    await mockRealtimeHost(page, { serverCode: 'ROOM42' })
    await navigateToOnline(page)
    await page.getByText('Créer une room').click()
    await expect(page.locator('.room-code')).toContainText('ROOM42', { timeout: 5_000 })
  })

  test('join room input is accessible from the online menu', async ({ page }) => {
    await navigateToOnline(page)
    await page.getByText('Rejoindre une room').click()
    await expect(page.locator('.code-input')).toBeVisible()
  })

  test('join room validates code length before contacting the server', async ({ page }) => {
    await navigateToOnline(page)
    await page.getByText('Rejoindre une room').click()
    await page.locator('.code-input').fill('AB')
    await page.getByRole('button', { name: 'Rejoindre' }).click()
    await expect(page.getByText('Code invalide')).toBeVisible()
  })

  test('guest: joining a valid room connects and starts the game', async ({ page }) => {
    await mockRealtimeGuest(page)
    await navigateToOnline(page)
    await page.getByText('Rejoindre une room').click()
    await page.locator('.code-input').fill('ABC123')
    await page.getByRole('button', { name: 'Rejoindre' }).click()
    await page.waitForSelector('canvas', { timeout: 5_000 })
    expect(await page.evaluate(() => window.__netState.mode)).toBe('guest')
  })
})
