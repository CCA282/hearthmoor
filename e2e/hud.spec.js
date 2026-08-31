import { test, expect } from '@playwright/test'
import { startLocalGame } from './helpers.js'

async function teleportNearRock(page) {
  await page.evaluate(() => {
    const scene = window.__engine.scene
    scene.localPlayer.position = { x: 6, y: 0.9, z: -6 }
    scene.localPlayer.mesh.position.set(6, 0.9, -6)
  })
}

async function press(page, code) {
  await page.keyboard.down(code)
  await page.waitForTimeout(50)
  await page.keyboard.up(code)
  await page.waitForTimeout(50)
}

test.describe('HUD', () => {
  test('shows no inventory panel and no hint far from any node', async ({ page }) => {
    await startLocalGame(page)
    await expect(page.locator('.inventory')).toHaveCount(0)
    await expect(page.locator('.hint')).toHaveCount(0)
  })

  test('shows the harvest hint once a node is in range', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearRock(page)
    await page.waitForTimeout(100) // let the next update() tick set game.hint
    await expect(page.locator('.hint')).toBeVisible()
    await expect(page.locator('.hint')).toContainText('récolter')
  })

  test('inventory panel appears and updates after harvesting', async ({ page }) => {
    await startLocalGame(page)
    await teleportNearRock(page)

    await press(page, 'Space')

    await expect(page.locator('.chip[title="Pierre"] .chip-count')).toContainText('1')

    await press(page, 'Space')
    await expect(page.locator('.chip[title="Pierre"] .chip-count')).toContainText('2')
  })
})
