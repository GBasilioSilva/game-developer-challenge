import { expect, test, openMenu, startBattle } from './fixtures'

test.describe('ranking and match history', () => {
  test('shows loading, pages through both tabs, and handles empty data', async ({ page }) => {
    await openMenu(page, 'slow')
    await expect(page.getByText('Carregando…').first()).toBeVisible()
    await expect(page.getByText('Astra')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeEnabled()

    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(page.getByText('Página 2 de 2')).toBeVisible()
    await expect(page.getByText('Tidecaller')).toBeVisible()
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.getByRole('button', { name: 'Próxima página' })).toBeEnabled()
    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(page.getByText('Página 2 de 2')).toBeVisible()

    await openMenu(page, 'empty')
    await expect(page.getByText('Nenhum registro de ranking ainda.')).toBeVisible()
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.getByText('Nenhuma partida registrada ainda.')).toBeVisible()
  })

  test('shows independent ranking and history errors', async ({ page }) => {
    await openMenu(page, 'ranking-error')
    await expect(page.getByText('Ranking indisponível.')).toBeVisible()
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.locator('#history-panel')).toContainText('820')

    await openMenu(page, 'history-error')
    await expect(page.getByText('Astra')).toBeVisible()
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.getByText('Histórico indisponível.')).toBeVisible()
  })

  test('records a finished match and refreshes both ranking and history', async ({ page }) => {
    await openMenu(page)
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Session time in seconds').fill('60')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(60000))
    await expect(page.getByText('A partida foi registrada na API simulada')).toBeVisible()

    await page.getByRole('button', { name: 'Open main menu' }).click()
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.locator('#history-panel')).toContainText('0')
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(page.getByText('Captain Nox')).toBeVisible()
  })

  test('recovers a pending submission after refresh and a network recovery', async ({ page }) => {
    await openMenu(page, 'history-error')
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Session time in seconds').fill('60')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(60000))
    await expect(page.getByText('O envio está pendente e será tentado novamente caso a rede se restabeleça')).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('naval-shooter:pending-match')))
      .not.toBeNull()

    await page.reload()
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Mock network scenario').selectOption('normal')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await page.reload()

    await expect.poll(
      () => page.evaluate(() => localStorage.getItem('naval-shooter:pending-match')),
      { timeout: 15000 },
    ).toBeNull()
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.locator('#history-panel')).toContainText('0')
  })

  test('retries a commit-then-timeout without creating a duplicate record', async ({ page }) => {
    await openMenu(page, 'commit-timeout')
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Session time in seconds').fill('60')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(60000))

    await expect(page.getByText('O envio está pendente e será tentado novamente caso a rede se restabeleça'))
      .toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Tentar sincronizar novamente' }).click()
    await expect(page.getByText('A partida foi registrada na API simulada')).toBeVisible()

    const savedMatches = await page.evaluate(() => {
      const matches = JSON.parse(localStorage.getItem('naval-shooter:mock-history') ?? '[]') as Array<{ playerName: string }>
      return matches.filter((match) => match.playerName === 'Captain Nox').length
    })
    expect(savedMatches).toBe(1)
  })

  test('does not let a delayed pre-match response replace refreshed match data', async ({ page }) => {
    await openMenu(page, 'out-of-order')
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Session time in seconds').fill('60')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(60000))
    await expect(page.getByText('A partida foi registrada na API simulada')).toBeVisible()
    await page.getByRole('button', { name: 'Open main menu' }).click()

    await page.waitForTimeout(4000)
    await page.getByRole('tab', { name: 'Histórico de partidas' }).click()
    await expect(page.locator('#history-panel')).toContainText('0')
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await page.getByRole('button', { name: 'Próxima página' }).click()
    await expect(page.getByText('Captain Nox')).toBeVisible()
  })
})
