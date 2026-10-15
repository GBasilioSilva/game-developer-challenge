import { expect, test, openMenu, startBattle } from './fixtures'

test.describe('options and asset lifecycle', () => {
  test('navigates, validates, and persists gameplay options', async ({ page }) => {
    await openMenu(page)
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()

    const sessionTime = page.getByLabel('Session time in seconds')
    const spawnInterval = page.getByLabel('Enemy spawn interval in seconds')
    const playerLives = page.getByLabel('Player lives')
    await sessionTime.fill('0')
    await spawnInterval.fill('99')
    await playerLives.fill('0')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()

    await expect(page.getByRole('button', { name: 'Start a new battle' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await expect(sessionTime).toHaveValue('60')
    await expect(spawnInterval).toHaveValue('20')
    await expect(playerLives).toHaveValue('1')

    await page.reload()
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await expect(page.getByLabel('Session time in seconds')).toHaveValue('60')
    await expect(page.getByLabel('Enemy spawn interval in seconds')).toHaveValue('20')
    await expect(page.getByLabel('Player lives')).toHaveValue('1')
  })

  test('shows asset loading errors and retries successfully', async ({ page }) => {
    await openMenu(page)
    await page.goto('/?e2e=1&seed=173&assetFailure=once')
    await page.getByRole('button', { name: 'Start a new battle' }).first().click()
    await expect(page.getByRole('alert')).toContainText('Unable to load arena assets')

    await page.getByRole('button', { name: 'Retry loading assets' }).click()
    await expect(page.locator('[data-game-canvas-root="true"] canvas')).toBeVisible()
  })
})

test.describe('gameplay rules through real controls', () => {
  test('moves, rotates, respects arena bounds, and cannot cross islands', async ({ page }) => {
    await openMenu(page)
    await startBattle(page)
    const initial = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())

    await page.keyboard.down('w')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(500))
    await page.keyboard.up('w')
    const moved = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(moved?.player.x).toBeGreaterThan(initial?.player.x ?? 0)

    await page.keyboard.down('d')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(500))
    await page.keyboard.up('d')
    const rotated = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(rotated?.player.angle).toBeGreaterThan(0)

    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.setPlayerPosition(925, 270, 0))
    await page.keyboard.down('w')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(500))
    await page.keyboard.up('w')
    const atBoundary = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(atBoundary?.player.x).toBeLessThanOrEqual(934)

    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.setPlayerPosition(160, 180, 0))
    await page.keyboard.down('w')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(1000))
    await page.keyboard.up('w')
    const atIsland = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(atIsland?.player.x).toBeLessThanOrEqual(178)
  })

  test('fires frontal and lateral weapons with separate cooldowns', async ({ page }) => {
    await openMenu(page)
    await startBattle(page)

    await page.keyboard.down(' ')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(33))
    const firstShot = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(firstShot?.bullets.filter((bullet) => bullet.owner === 'player')).toHaveLength(1)

    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(150))
    const coolingDown = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(coolingDown?.bullets.filter((bullet) => bullet.owner === 'player')).toHaveLength(1)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(100))
    const frontalReady = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(frontalReady?.bullets.filter((bullet) => bullet.owner === 'player').length).toBeGreaterThan(1)
    await page.keyboard.up(' ')

    await openMenu(page)
    await startBattle(page)
    await page.keyboard.down('q')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(33))
    await page.keyboard.up('q')
    const afterBroadside = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(afterBroadside?.bullets.filter((bullet) => bullet.owner === 'player')).toHaveLength(3)
    await page.keyboard.down('q')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(100))
    await page.keyboard.up('q')
    expect((await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect()))
      ?.bullets.filter((bullet) => bullet.owner === 'player')).toHaveLength(3)
  })

  test('applies damage and awards exactly one point when an enemy is destroyed', async ({ page }) => {
    await openMenu(page)
    await startBattle(page)
    const enemyId = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.placeEnemy('shooter', 220, 270, {
      health: 2,
      speed: 0,
      fireCooldown: 999,
    }))
    const encounter = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(encounter?.enemies.some((enemy) => enemy.id === enemyId), JSON.stringify(encounter)).toBe(true)

    await page.keyboard.down(' ')
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(1000))
    await page.keyboard.up(' ')

    const state = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(state?.score, JSON.stringify(state)).toBe(1)
    expect(state?.enemies.some((enemy) => enemy.id.startsWith('e2e-shooter'))).toBe(false)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(1000))
    expect((await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect()))?.score).toBe(1)
    await expect(page.getByText('Pontuação: 1')).toBeVisible()
  })

  test('runs Chaser and Shooter behavior and spawns both types on schedule', async ({ page }) => {
    await openMenu(page)
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.placeEnemy('chaser', 500, 270))
    const chaserStart = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(1000))
    const chaserMoved = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(chaserMoved?.enemies.find((enemy) => enemy.id.startsWith('e2e-chaser'))?.angle)
      .toBeGreaterThan(chaserStart?.enemies.find((enemy) => enemy.id.startsWith('e2e-chaser'))?.angle ?? 0)

    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.placeEnemy('shooter', 350, 270, {
      speed: 0,
      fireCooldown: 0.1,
      angle: Math.PI,
    }))
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(900))
    const shooterState = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(shooterState?.player.health).toBeLessThan(3)

    await openMenu(page)
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(2100))
    const firstSpawn = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(firstSpawn?.enemies.some((enemy) => enemy.kind === 'chaser')).toBe(true)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(6100))
    const nextSpawn = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(nextSpawn?.enemies.some((enemy) => enemy.kind === 'shooter')).toBe(true)
  })
})

test.describe('match lifecycle and pause', () => {
  test('ends on time, stops the simulation, and starts a clean rematch', async ({ page }) => {
    await openMenu(page)
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Session time in seconds').fill('60')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.suppressSpawns())
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(60000))

    await expect(page.getByText('Resultado')).toBeVisible()
    await expect(page.getByText('Tempo esgotado')).toBeVisible()
    const ended = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(ended?.reason).toBe('time')
    expect(ended?.running).toBe(false)
    expect(ended?.timeLeft).toBe(0)

    await page.getByRole('button', { name: 'Jogar novamente' }).click()
    const rematch = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect())
    expect(rematch?.score).toBe(0)
    expect(rematch?.player.health).toBe(3)
    expect(rematch?.enemies).toHaveLength(0)
    expect(rematch?.timeLeft).toBe(60)
  })

  test('ends on death, displays a persisted result after refresh', async ({ page }) => {
    await openMenu(page)
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByLabel('Player lives').fill('1')
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()
    await startBattle(page)
    await page.evaluate(() => {
      const api = window.__NAVAL_GAME_TEST__
      const state = api?.inspect()
      if (api && state) {
        api.suppressSpawns()
        api.setPlayerPosition(state.player.x, state.player.y)
        api.setPlayerHealth(1)
        api.placeEnemy('chaser', state.player.x, state.player.y, { speed: 0 })
        api.advance(33)
      }
    })

    expect(await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().reason)).toBe('defeat')
    await expect(page.getByText('Resultado')).toBeVisible()
    await expect(page.getByText('Derrota', { exact: false })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'View previous battle result' }).click()
    await expect(page.getByText('Pontuação final: 0')).toBeVisible()
    await expect(page.getByText('Motivo:').locator('..')).toContainText('Derrota')
  })

  test('pauses on button and lost visibility without advancing time', async ({ page }) => {
    await openMenu(page)
    await startBattle(page)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(1000))
    await page.getByRole('button', { name: 'Pause the battle' }).click()
    const pausedAt = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().timeLeft)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(5000))
    expect(await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().timeLeft)).toBe(pausedAt)

    await page.getByRole('button', { name: 'Resume the battle' }).click()
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(page.getByLabel('Game paused')).toBeVisible()
    const hiddenAt = await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().timeLeft)
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(5000))
    expect(await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().timeLeft)).toBe(hiddenAt)

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.getByRole('button', { name: 'Resume the battle' }).click()
    await page.evaluate(() => window.__NAVAL_GAME_TEST__?.advance(1000))
    expect(await page.evaluate(() => window.__NAVAL_GAME_TEST__?.inspect().timeLeft)).toBeLessThan(hiddenAt ?? 0)
  })

  test('abandons without recording and tolerates repeated navigation', async ({ page }) => {
    let posts = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/history')) {
        posts += 1
      }
    })
    await openMenu(page)
    await startBattle(page)
    await page.keyboard.down('w')
    await page.getByRole('button', { name: 'Open main menu' }).click()
    await expect(page.locator('[data-game-canvas-root="true"]')).toHaveCount(0)
    await page.keyboard.up('w')
    await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await page.getByRole('button', { name: 'Start a new battle' }).first().click()
    await expect(page.locator('[data-game-canvas-root="true"] canvas')).toBeVisible()
    expect(posts).toBe(0)
  })
})
