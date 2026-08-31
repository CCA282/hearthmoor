import { test, expect } from '@playwright/test'
import { mockRealtimeHost, mockRealtimeGuest, createRoomAsHost, joinAsGuest } from './helpers.js'

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
