import { test, expect } from '@playwright/test'

// Supabase Realtime (channels, presence, Phoenix wire protocol) is never actually reached in
// this suite — src/net/realtime.js checks window.__HEARTHMOOR_REALTIME_TEST_HOOK__ before
// touching supabase.channel(...); these hooks stash the module's internal `dispatch` on
// window.__dispatch so a test can later simulate more events (guest joins, input, host state),
// the same way one would drive a mock WebSocket's onmessage.

async function mockRealtimeHost(page, { serverCode = 'ABC123' } = {}) {
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

async function mockRealtimeGuest(page, { guestId = 'test-guest' } = {}) {
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

async function createRoomAsHost(page) {
  await page.goto('/')
  await page.getByText('Jouer en ligne').click()
  await page.getByText('Créer une room').click()
  await page.waitForSelector('.room-code', { timeout: 5_000 })
  await page.waitForFunction(() => !!window.__dispatch)
}

async function joinAsGuest(page, code = 'ABC123') {
  await page.goto('/')
  await page.getByText('Jouer en ligne').click()
  await page.getByText('Rejoindre une room').click()
  await page.locator('.code-input').fill(code)
  await page.getByRole('button', { name: 'Rejoindre' }).click()
  await page.waitForSelector('canvas', { timeout: 5_000 })
}

test.describe('Multiplayer — host side', () => {
  test('a guest joining appears as a new remote player', async ({ page }) => {
    await mockRealtimeHost(page)
    await createRoomAsHost(page)

    await page.evaluate(() => window.__dispatch('guest_joined', { guestId: 'guest-1', name: 'Bob' }))

    const player = await page.evaluate(() => {
      const p = window.__engine.scene.findPlayer('guest-1')
      return p ? { id: p.id } : null
    })
    expect(player?.id).toBe('guest-1')
  })

  test("a guest's input moves their player on the host", async ({ page }) => {
    await mockRealtimeHost(page)
    await createRoomAsHost(page)
    await page.evaluate(() => window.__dispatch('guest_joined', { guestId: 'guest-1', name: 'Bob' }))

    const before = await page.evaluate(() => ({ ...window.__engine.scene.findPlayer('guest-1').position }))
    await page.evaluate(() => window.__dispatch('input', { guestId: 'guest-1', input: { mx: 1, mz: 0, action: false } }))
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => ({ ...window.__engine.scene.findPlayer('guest-1').position }))

    expect(after.x).toBeGreaterThan(before.x)
  })

  test('a guest leaving removes their player', async ({ page }) => {
    await mockRealtimeHost(page)
    await createRoomAsHost(page)
    await page.evaluate(() => window.__dispatch('guest_joined', { guestId: 'guest-1', name: 'Bob' }))
    expect(await page.evaluate(() => !!window.__engine.scene.findPlayer('guest-1'))).toBe(true)

    await page.evaluate(() => window.__dispatch('guest_left', { guestId: 'guest-1' }))
    expect(await page.evaluate(() => !!window.__engine.scene.findPlayer('guest-1'))).toBe(false)
  })

})

test.describe('Multiplayer — guest side', () => {
  test('applies the initial state snapshot: position and inventory', async ({ page }) => {
    await mockRealtimeGuest(page)
    await joinAsGuest(page)
    await page.waitForFunction(() => !!window.__dispatch)

    await page.evaluate(() => {
      window.__dispatch('state', {
        players: [{ id: 'test-guest', x: 5, y: 0.9, z: -3, inventory: [{ itemId: 'stone', count: 2 }] }],
        nodes: [],
      })
    })

    const position = await page.evaluate(() => window.__engine.scene.localPlayer.position)
    expect(position).toEqual({ x: 5, y: 0.9, z: -3 })
    await expect(page.locator('.inventory .slot')).toContainText('Pierre × 2')
  })

  test('sets netState.mode to guest and myPlayerId to their own guestId', async ({ page }) => {
    await mockRealtimeGuest(page, { guestId: 'test-guest-42' })
    await joinAsGuest(page)

    const { mode, myPlayerId } = await page.evaluate(() => ({
      mode: window.__netState.mode,
      myPlayerId: window.__netState.myPlayerId,
    }))
    expect(mode).toBe('guest')
    expect(myPlayerId).toBe('test-guest-42')
  })

  test('a second snapshot updates positions again (no local simulation drift)', async ({ page }) => {
    await mockRealtimeGuest(page)
    await joinAsGuest(page)
    await page.waitForFunction(() => !!window.__dispatch)

    await page.evaluate(() => window.__dispatch('state', {
      players: [{ id: 'test-guest', x: 1, y: 0.9, z: 1, inventory: [] }],
      nodes: [],
    }))
    await page.waitForTimeout(100)
    await page.evaluate(() => window.__dispatch('state', {
      players: [{ id: 'test-guest', x: 8, y: 0.9, z: -6, inventory: [] }],
      nodes: [],
    }))

    const position = await page.evaluate(() => window.__engine.scene.localPlayer.position)
    expect(position).toEqual({ x: 8, y: 0.9, z: -6 })
  })
})
