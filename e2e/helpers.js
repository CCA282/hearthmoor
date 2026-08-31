// Shared helpers for E2E tests

export async function startLocalGame(page) {
  await page.goto('/')
  await page.getByText('Jouer en local').click()
  await page.waitForFunction(() => !!window.__engine?.scene?.localPlayer)
}

// Supabase Realtime (channels, presence, Phoenix wire protocol) is never actually reached in
// these suites — src/net/realtime.js checks window.__HEARTHMOOR_REALTIME_TEST_HOOK__ before
// touching supabase.channel(...); these hooks stash the module's internal `dispatch` on
// window.__dispatch so a test can later simulate more events (guest joins, input, host state),
// the same way one would drive a mock WebSocket's onmessage.

export async function mockRealtimeHost(page, { serverCode = 'ABC123' } = {}) {
  await page.addInitScript(({ serverCode }) => {
    window.__dispatch = null
    window.__HEARTHMOOR_REALTIME_TEST_HOOK__ = {
      createRoomAsHost(dispatch) {
        window.__dispatch = dispatch
        return new Promise((resolve) => {
          setTimeout(() => resolve({ code: serverCode, hostId: 'test-host' }), 50)
        })
      },
      leaveRoom() {},
    }
  }, { serverCode })
}

export async function mockRealtimeGuest(page, { guestId = 'test-guest' } = {}) {
  await page.addInitScript(({ guestId }) => {
    window.__dispatch = null
    window.__HEARTHMOOR_REALTIME_TEST_HOOK__ = {
      joinRoomAsGuest(code, name, dispatch) {
        window.__dispatch = dispatch
        return new Promise((resolve) => {
          setTimeout(() => resolve({ guestId }), 50)
        })
      },
      leaveRoom() {},
    }
  }, { guestId })
}

export async function createRoomAsHost(page) {
  await page.goto('/')
  await page.getByText('Jouer en ligne').click()
  await page.getByText('Créer une room').click()
  await page.waitForSelector('.room-code', { timeout: 5_000 })
  await page.waitForFunction(() => !!window.__dispatch)
}

export async function joinAsGuest(page, code = 'ABC123') {
  await page.goto('/')
  await page.getByText('Jouer en ligne').click()
  await page.getByText('Rejoindre une room').click()
  await page.locator('.code-input').fill(code)
  await page.getByRole('button', { name: 'Rejoindre' }).click()
  await page.waitForSelector('canvas', { timeout: 5_000 })
}
