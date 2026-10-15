import { expect, test, openMenu, startBattle } from './fixtures'

test('keeps the 16:9 arena and touch controls usable on mobile', async ({ page }) => {
  await openMenu(page)
  await startBattle(page)

  const arena = page.locator('[data-game-canvas-root="true"]')
  const canvas = arena.locator('canvas')
  const arenaBounds = await arena.boundingBox()
  const canvasBounds = await canvas.boundingBox()
  expect(arenaBounds).not.toBeNull()
  expect(canvasBounds).not.toBeNull()
  expect((arenaBounds?.width ?? 0) / (arenaBounds?.height ?? 1)).toBeCloseTo(16 / 9, 1)

  const forward = page.getByRole('button', { name: 'Move forward' })
  const controlsBefore = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().player.x)
  await forward.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' })
  await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(500))
  await forward.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' })
  const controlsAfter = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().player.x)
  expect(controlsAfter).toBeGreaterThan(controlsBefore ?? 0)

  const controlBounds = await page.locator('.touch-controls').boundingBox()
  expect(controlBounds).not.toBeNull()
  expect(controlBounds?.x).toBeGreaterThanOrEqual(arenaBounds?.x ?? 0)
  expect((controlBounds?.x ?? 0) + (controlBounds?.width ?? 0))
    .toBeLessThanOrEqual((arenaBounds?.x ?? 0) + (arenaBounds?.width ?? 0))
})
