import { expect, test, openMenu, startBattle } from './fixtures'

test('keeps menu, arena, and results within their visual baselines', async ({ page }) => {
  await openMenu(page)
  await expect(page.getByText('Astra')).toBeVisible()
  await expect(page.locator('.menu-layout')).toHaveScreenshot('naval-menu.png')

  await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
  await page.getByLabel('Session time in seconds').fill('60')
  await page.getByRole('button', { name: 'Salvar Alterações' }).click()
  await startBattle(page)
  const arena = page.locator('[data-game-canvas-root="true"]')
  await expect(arena).toHaveScreenshot('naval-arena.png')

  await page.evaluate(() => window.__NAVAL_GAME_TEST__?.suppressSpawns())
  await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(60000))
  await expect(page.getByText('A partida foi registrada na API simulada')).toBeVisible()
  const result = page.locator('.results-layout')
  await expect(result).toBeVisible()
  await expect(result).toHaveScreenshot('naval-results.png', {
    mask: [result.locator('p').filter({ hasText: 'Último salvamento:' })],
  })
})
