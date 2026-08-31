// Shared helpers for E2E tests

export async function startLocalGame(page) {
  await page.goto('/')
  await page.getByText('Jouer en local').click()
  await page.waitForFunction(() => !!window.__engine?.scene?.player)
}
