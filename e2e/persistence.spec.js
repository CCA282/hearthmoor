import { test, expect } from '@playwright/test'
import { startLocalGame, mockRealtimeGuest, joinAsGuest } from './helpers.js'

async function mutateLocalPlayer(page) {
  await page.evaluate(() => {
    const scene = window.__engine.scene
    scene.localPlayer.position = { x: 12, y: 0.9, z: -8 }
    scene.localPlayer.mesh.position.set(12, 0.9, -8)
    scene.localPlayer.inventory[0] = { itemId: 'wood', count: 9 }
    scene.localPlayer.equipment.weapon = 'hache_bois'
    scene.localPlayer.health = 42
  })
}

test.describe('Quitting a game', () => {
  test('returns to the lobby home', async ({ page }) => {
    await startLocalGame(page)
    await page.getByText('Quitter').click()
    await expect(page.getByText('Jouer en local')).toBeVisible()
  })

  test('quitting a guest session and starting a local game restores the default player', async ({ page }) => {
    // Regression test: joining as a guest removes the scene's default 'local'
    // player (see Lobby.vue's joinRoom()) — quitting back to the lobby and
    // starting a fresh local game must not leave that player missing.
    await mockRealtimeGuest(page)
    await joinAsGuest(page)
    await page.waitForFunction(() => !!window.__dispatch)
    expect(await page.evaluate(() => window.__engine.scene.findPlayer('local'))).toBeNull()

    await page.getByText('Quitter').click()
    await page.getByText('Jouer en local').click()
    await page.waitForFunction(() => !!window.__engine?.scene?.localPlayer)

    const localPlayer = await page.evaluate(() => window.__engine.scene.localPlayer)
    expect(localPlayer).toBeTruthy()
    expect(localPlayer.position).toEqual({ x: 3, y: 0.9, z: 3 })
  })
})

test.describe('Save / continue (solo)', () => {
  test('saving then reloading and continuing restores position/inventory/equipment/health', async ({ page }) => {
    await startLocalGame(page)
    await mutateLocalPlayer(page)

    await page.getByText('Sauvegarder').click()
    await expect(page.locator('.flash')).toContainText('Sauvegardé')

    await page.reload()
    await page.getByText('Jouer en local').click()
    await page.locator('.save-btn').first().click()
    await page.waitForFunction(() => !!window.__engine?.scene?.localPlayer)

    const state = await page.evaluate(() => {
      const p = window.__engine.scene.localPlayer
      return { position: p.position, wood: p.inventory[0], weapon: p.equipment.weapon, health: p.health }
    })
    expect(state.position).toEqual({ x: 12, y: 0.9, z: -8 })
    expect(state.wood).toEqual({ itemId: 'wood', count: 9 })
    expect(state.weapon).toBe('hache_bois')
    expect(state.health).toBe(42)
  })

  test('starting a new game ignores an existing save', async ({ page }) => {
    await startLocalGame(page)
    await mutateLocalPlayer(page)
    await page.getByText('Sauvegarder').click()
    await expect(page.locator('.flash')).toContainText('Sauvegardé')

    await page.reload()
    await page.getByText('Jouer en local').click()
    await page.getByText('Nouvelle partie').click()
    await page.waitForFunction(() => !!window.__engine?.scene?.localPlayer)

    const position = await page.evaluate(() => window.__engine.scene.localPlayer.position)
    expect(position).toEqual({ x: 3, y: 0.9, z: 3 }) // camp spawn point, not the saved position
  })

  test('deleting a save removes it from the list', async ({ page }) => {
    await startLocalGame(page)
    await page.getByText('Sauvegarder').click()
    await expect(page.locator('.flash')).toContainText('Sauvegardé')

    await page.reload()
    await page.getByText('Jouer en local').click()
    await expect(page.locator('.save-btn')).toHaveCount(1)

    await page.locator('.save-delete').click()
    await expect(page.locator('.save-btn')).toHaveCount(0)
  })
})
