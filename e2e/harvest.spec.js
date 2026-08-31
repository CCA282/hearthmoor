import { test, expect } from '@playwright/test'
import { startLocalGame } from './helpers.js'

// rock-1 sits at (7, -6) — see src/game/constants/nodes.js. Teleporting the
// player there keeps this test focused on the harvest interaction itself,
// independent of movement (already covered by movement.spec.js).
async function teleportNearRock(page) {
  await page.evaluate(() => {
    const scene = window.__engine.scene
    scene.player.position = { x: 6, y: 0.9, z: -6 }
    scene.player.mesh.position.set(6, 0.9, -6)
  })
}

async function press(page, code) {
  await page.keyboard.down(code)
  await page.waitForTimeout(50)
  await page.keyboard.up(code)
  await page.waitForTimeout(50) // let endFrame() register the release before the next press
}

test.describe('Harvesting a resource node', () => {
  test('pressing action near a rock adds stone to the inventory', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearRock(page)

    await press(page, 'Space')

    const inventory = await page.evaluate(() => window.__engine.scene.inventory)
    const stoneSlot = inventory.find((s) => s?.itemId === 'stone')
    expect(stoneSlot?.count).toBe(1)
  })

  test('does nothing when no node is in range', async ({ page }) => {
    await startLocalGame(page)
    // Player spawns at (3, 0.9, 3) — far from every node.
    await press(page, 'Space')

    const inventory = await page.evaluate(() => window.__engine.scene.inventory)
    expect(inventory.every((s) => s === null)).toBe(true)
  })

  test('node depletes (mesh hidden) after enough hits, and stone stacks up', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearRock(page)

    for (let i = 0; i < 3; i++) await press(page, 'Space') // NODE_HP = 3

    const { count, depleted, visible } = await page.evaluate(() => {
      const scene = window.__engine.scene
      const rock = scene.nodes.find((n) => n.id === 'rock-1')
      const stoneSlot = scene.inventory.find((s) => s?.itemId === 'stone')
      return { count: stoneSlot?.count, depleted: rock.depleted, visible: rock.mesh.visible }
    })
    expect(count).toBe(3)
    expect(depleted).toBe(true)
    expect(visible).toBe(false)
  })

  test('a depleted node cannot be harvested again until it respawns', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearRock(page)

    for (let i = 0; i < 3; i++) await press(page, 'Space') // deplete it
    await press(page, 'Space') // one more press — should do nothing, node is gone from range

    const stoneSlot = await page.evaluate(() =>
      window.__engine.scene.inventory.find((s) => s?.itemId === 'stone'))
    expect(stoneSlot.count).toBe(3)
  })
})
