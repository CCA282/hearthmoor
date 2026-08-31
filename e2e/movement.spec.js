import { test, expect } from '@playwright/test'

async function playerPos(page) {
  return page.evaluate(() => ({ ...window.__engine.scene.player.position }))
}

test.describe('Player movement — keyboard', () => {
  test('moving right (D) increases x', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => !!window.__engine?.scene?.player)
    const before = await playerPos(page)

    await page.keyboard.down('KeyD')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyD')

    const after = await playerPos(page)
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.z).toBeCloseTo(before.z, 1)
  })

  test('moving forward (W) decreases z', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => !!window.__engine?.scene?.player)
    const before = await playerPos(page)

    await page.keyboard.down('KeyW')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyW')

    const after = await playerPos(page)
    expect(after.z).toBeLessThan(before.z)
  })

  test('the camera follows the player', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => !!window.__engine?.scene?.player)

    await page.keyboard.down('KeyD')
    await page.waitForTimeout(300)
    await page.keyboard.up('KeyD')

    const { playerX, cameraX } = await page.evaluate(() => ({
      playerX: window.__engine.scene.player.position.x,
      cameraX: window.__engine.scene.camera.position.x,
    }))
    // camera.x = player.x + fixed offset (12) — see game/constants/camera.js
    expect(cameraX).toBeCloseTo(playerX + 12, 0)
  })

  test('releasing all keys stops the player', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => !!window.__engine?.scene?.player)

    await page.keyboard.down('KeyD')
    await page.waitForTimeout(200)
    await page.keyboard.up('KeyD')
    await page.waitForTimeout(150)
    const stopped = await playerPos(page)
    await page.waitForTimeout(200)
    const after = await playerPos(page)

    expect(after.x).toBeCloseTo(stopped.x, 1)
  })
})
