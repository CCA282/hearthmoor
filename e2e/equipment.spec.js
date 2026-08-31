import { test, expect } from '@playwright/test'
import { startLocalGame, mockRealtimeHost, mockRealtimeGuest, createRoomAsHost, joinAsGuest } from './helpers.js'

// The workbench sits at (2, 0, -2) — see src/game/constants/crafting.js.
async function teleportToWorkbench(page) {
  await page.evaluate(() => {
    const scene = window.__engine.scene
    scene.localPlayer.position = { x: 2, y: 0.9, z: -2 }
    scene.localPlayer.mesh.position.set(2, 0.9, -2)
  })
}

async function giveWood(page, count = 20) {
  await page.evaluate((count) => {
    window.__engine.scene.localPlayer.inventory[0] = { itemId: 'wood', count }
  }, count)
}

async function teleportNearBoar(page) {
  await page.evaluate(() => {
    const scene = window.__engine.scene
    const spawn = scene.enemies[0].spawnPosition
    const pos = { x: spawn.x + 1, y: spawn.y, z: spawn.z }
    scene.localPlayer.position = pos
    scene.localPlayer.mesh.position.set(pos.x, pos.y, pos.z)
  })
}

async function press(page, code) {
  await page.keyboard.down(code)
  await page.waitForTimeout(60)
  await page.keyboard.up(code)
  await page.waitForTimeout(60)
}

test.describe('Crafting — solo', () => {
  test('crafting the axe near the workbench consumes wood and auto-equips it', async ({ page }) => {
    await startLocalGame(page)
    await teleportToWorkbench(page)
    await giveWood(page)

    await press(page, 'Space')

    const { inventory, equipment } = await page.evaluate(() => {
      const player = window.__engine.scene.localPlayer
      return { inventory: player.inventory, equipment: player.equipment }
    })
    const wood = inventory.find((s) => s?.itemId === 'wood')
    const axe = inventory.find((s) => s?.itemId === 'hache_bois')
    expect(wood?.count).toBe(5)
    expect(axe?.count).toBe(1)
    expect(equipment.weapon).toBe('hache_bois')
    await expect(page.locator('.equipped')).toContainText('Hache en bois')
  })

  test('does nothing without enough wood', async ({ page }) => {
    await startLocalGame(page)
    await teleportToWorkbench(page)

    await press(page, 'Space')

    const equipment = await page.evaluate(() => window.__engine.scene.localPlayer.equipment)
    expect(equipment.weapon).toBeNull()
    await expect(page.locator('.equipped')).toHaveCount(0)
  })
})

test.describe('Combat — equipped weapon deals more damage', () => {
  test('bare-handed hit', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearBoar(page)

    await press(page, 'KeyF')
    await page.waitForTimeout(500) // clear PLAYER_ATTACK_COOLDOWN

    const health = await page.evaluate(() => window.__engine.scene.enemies[0].health)
    expect(health).toBe(25) // 40 (ENEMY_MAX_HEALTH) - 15 (PLAYER_ATTACK_DAMAGE)
  })

  test('hit with the axe equipped deals extra damage', async ({ page }) => {
    await startLocalGame(page)
    await page.evaluate(() => {
      window.__engine.scene.localPlayer.equipment.weapon = 'hache_bois'
    })
    await teleportNearBoar(page)

    await press(page, 'KeyF')
    await page.waitForTimeout(500)

    const health = await page.evaluate(() => window.__engine.scene.enemies[0].health)
    expect(health).toBe(15) // 40 - (15 base + 10 axe bonus)
  })
})

test.describe('Crafting — multiplayer sync', () => {
  test('a guest crafting the axe is seen equipped on the host', async ({ page }) => {
    await mockRealtimeHost(page)
    await createRoomAsHost(page)
    await page.evaluate(() => window.__dispatch('guest_joined', { guestId: 'guest-1', name: 'Bob' }))

    await page.evaluate(() => {
      const scene = window.__engine.scene
      const guest = scene.findPlayer('guest-1')
      guest.position = { x: 2, y: 0.9, z: -2 } // on the workbench
      guest.mesh.position.set(2, 0.9, -2)
      guest.inventory[0] = { itemId: 'wood', count: 20 }
    })
    await page.evaluate(() => window.__dispatch('input', {
      guestId: 'guest-1', input: { mx: 0, mz: 0, action: true, attack: false },
    }))
    await page.waitForTimeout(100)

    const guestEquipment = await page.evaluate(() => window.__engine.scene.findPlayer('guest-1').equipment)
    expect(guestEquipment.weapon).toBe('hache_bois')

    const snapshotEquipment = await page.evaluate(() =>
      window.__engine.scene.serializeSnapshot().players.find((p) => p.id === 'guest-1').equipment)
    expect(snapshotEquipment.weapon).toBe('hache_bois')
  })

  test('a guest sees their own equipment reflected from a host snapshot', async ({ page }) => {
    await mockRealtimeGuest(page, { guestId: 'test-guest-eq' })
    await joinAsGuest(page)
    await page.waitForFunction(() => !!window.__dispatch)

    await page.evaluate(() => {
      window.__dispatch('state', {
        players: [{
          id: 'test-guest-eq', x: 0, y: 0.9, z: 0, inventory: [], equipment: { weapon: 'hache_bois' }, health: 100,
        }],
        nodes: [],
        enemies: [],
      })
    })

    expect(await page.evaluate(() => window.__game.equipment.weapon)).toBe('hache_bois')
    await expect(page.locator('.equipped')).toContainText('Hache en bois')
  })
})
