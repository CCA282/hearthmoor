import { test, expect } from '@playwright/test'
import { startLocalGame, mockRealtimeHost, mockRealtimeGuest, createRoomAsHost, joinAsGuest } from './helpers.js'

// boar-1 sits at (-2, -12) — see src/game/constants/enemies.js.
async function teleportNearBoar(page) {
  await page.evaluate(() => {
    const scene = window.__engine.scene
    const spawn = scene.enemies[0].spawnPosition
    const pos = { x: spawn.x + 1, y: spawn.y, z: spawn.z }
    scene.localPlayer.position = pos
    scene.localPlayer.mesh.position.set(pos.x, pos.y, pos.z)
  })
}

async function attackOnce(page) {
  await page.keyboard.down('KeyF')
  await page.waitForTimeout(60)
  await page.keyboard.up('KeyF')
  await page.waitForTimeout(600) // clear PLAYER_ATTACK_COOLDOWN (500ms)
}

test.describe('Combat — solo', () => {
  test('attacking a boar deals damage', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearBoar(page)

    await attackOnce(page)

    const health = await page.evaluate(() => window.__engine.scene.enemies[0].health)
    expect(health).toBeLessThan(40) // ENEMY_MAX_HEALTH
  })

  test('killing a boar hides its mesh and drops meat', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearBoar(page)

    for (let i = 0; i < 3; i++) await attackOnce(page) // 3×15 dmg > 40 max health

    const { health, visible } = await page.evaluate(() => {
      const boar = window.__engine.scene.enemies[0]
      return { health: boar.health, visible: boar.mesh.visible }
    })
    expect(health).toBe(0)
    expect(visible).toBe(false)
    await expect(page.locator('.chip[title="Viande"] .chip-count')).toContainText('1')
  })

  test('does not attack when out of range', async ({ page }) => {
    await startLocalGame(page)
    // Player spawns far from every enemy.
    await attackOnce(page)
    const health = await page.evaluate(() => window.__engine.scene.enemies[0].health)
    expect(health).toBe(40)
  })

  test('HUD health bar reflects the player health', async ({ page }) => {
    await startLocalGame(page)
    await page.evaluate(() => { window.__engine.scene.localPlayer.health = 55; window.__game.health = 55 })
    await expect(page.locator('.health-label')).toContainText('55 / 100')
  })

  test('a boar attacking a near-dead player kills and respawns them at full health', async ({ page }) => {
    await startLocalGame(page)
    await page.evaluate(() => {
      window.__engine.scene.localPlayer.health = 5
      window.__game.health = 5
    })
    await teleportNearBoar(page) // within ENEMY_ATTACK_RANGE — aggro/windup/hit lands quickly

    await page.waitForFunction(() => window.__game.health === 100, { timeout: 5_000 })

    const position = await page.evaluate(() => ({ ...window.__engine.scene.localPlayer.position }))
    expect(position).toEqual({ x: 3, y: 0.9, z: 3 }) // camp spawn point
  })
})

test.describe('Combat — multiplayer sync', () => {
  test('host killing an enemy via real keyboard input is reflected in its own snapshot', async ({ page }) => {
    await mockRealtimeHost(page)
    await createRoomAsHost(page)
    await teleportNearBoar(page)

    for (let i = 0; i < 3; i++) await attackOnce(page)

    const enemy = await page.evaluate(() =>
      window.__engine.scene.serializeSnapshot().enemies.find((e) => e.id === 'boar-1'))
    expect(enemy.health).toBe(0)
  })

  test('guest input with attack:true damages an enemy on the host', async ({ page }) => {
    await mockRealtimeHost(page)
    await createRoomAsHost(page)
    await page.evaluate(() => window.__dispatch('guest_joined', { guestId: 'guest-1', name: 'Bob' }))

    // Place the remote (guest) player right next to boar-1 and simulate their attack input.
    await page.evaluate(() => {
      const scene = window.__engine.scene
      const spawn = scene.enemies[0].spawnPosition
      const guest = scene.findPlayer('guest-1')
      guest.position = { x: spawn.x + 1, y: spawn.y, z: spawn.z }
      guest.mesh.position.set(guest.position.x, guest.position.y, guest.position.z)
    })
    await page.evaluate(() => window.__dispatch('input', {
      guestId: 'guest-1', input: { mx: 0, mz: 0, action: false, attack: true },
    }))
    await page.waitForTimeout(100)

    const health = await page.evaluate(() => window.__engine.scene.enemies[0].health)
    expect(health).toBeLessThan(40)
  })

  test('guest sees enemy health from the host snapshot', async ({ page }) => {
    await mockRealtimeGuest(page)
    await joinAsGuest(page)
    await page.waitForFunction(() => !!window.__dispatch)

    await page.evaluate(() => {
      window.__dispatch('state', {
        players: [{ id: 'test-guest', x: 0, y: 0.9, z: 0, inventory: [], health: 100 }],
        nodes: [],
        enemies: [{ id: 'boar-1', x: -2, y: 0.3, z: -12, health: 0 }],
      })
    })

    const boar = await page.evaluate(() => window.__engine.scene.enemies.find((e) => e.id === 'boar-1'))
    expect(boar.health).toBe(0)
    expect(boar.mesh.visible).toBe(false)
  })

  test('guest sees their own health from the host snapshot', async ({ page }) => {
    await mockRealtimeGuest(page, { guestId: 'test-guest-hp' })
    await joinAsGuest(page)
    await page.waitForFunction(() => !!window.__dispatch)

    await page.evaluate(() => {
      window.__dispatch('state', {
        players: [{ id: 'test-guest-hp', x: 0, y: 0.9, z: 0, inventory: [], health: 37 }],
        nodes: [],
        enemies: [],
      })
    })

    expect(await page.evaluate(() => window.__game.health)).toBe(37)
    await expect(page.locator('.health-label')).toContainText('37 / 100')
  })
})
