import { expect, test as base, type Page } from '@playwright/test'

export type GameSnapshot = {
  score: number
  timeLeft: number
  running: boolean
  paused: boolean
  reason: 'time' | 'defeat' | null
  spawnCount: number
  player: {
    x: number
    y: number
    angle: number
    health: number
    fireCooldown: number
    secondaryFireCooldown: number
  }
  enemies: Array<{
    id: string
    kind: 'chaser' | 'shooter'
    x: number
    y: number
    angle: number
    health: number
    speed: number
    fireCooldown: number
  }>
  bullets: Array<{
    id: string
    x: number
    y: number
    owner: 'player' | 'enemy'
    damage: number
    ttl: number
  }>
}

type GameTestApi = {
  advance: (milliseconds: number) => void
  inspect: () => GameSnapshot
  placeEnemy: (
    kind: 'chaser' | 'shooter',
    x: number,
    y: number,
    options?: { health?: number; speed?: number; fireCooldown?: number; angle?: number },
  ) => string
  setPlayerPosition: (x: number, y: number, angle?: number) => void
}

type TestWindow = Window & {
  __NAVAL_GAME_TEST__?: GameTestApi
}

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('playwright-context-ready')) {
        localStorage.clear()
        sessionStorage.setItem('playwright-context-ready', 'true')
      }
    })
    await runPage(page)
  },
})

export { expect }

export async function openMenu(page: Page, scenario = 'normal'): Promise<void> {
  if (page.url().startsWith('http')) {
    await page.evaluate((mockScenario) => {
      localStorage.setItem('naval-shooter:mock-scenario', mockScenario)
    }, scenario)
  } else {
    await page.addInitScript((mockScenario) => {
      if (!sessionStorage.getItem('playwright-scenario-initialized')) {
        localStorage.setItem('naval-shooter:mock-scenario', mockScenario)
        sessionStorage.setItem('playwright-scenario-initialized', 'true')
      }
    }, scenario)
  }
  await page.goto('/?e2e=1&seed=173')
}

export async function startBattle(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start a new battle' }).first().click()
  const arena = page.locator('[data-game-canvas-root="true"]')
  await expect(arena.locator('canvas')).toBeVisible()
  await page.waitForFunction(() => Boolean((window as TestWindow).__NAVAL_GAME_TEST__))
  const bounds = await arena.boundingBox()
  if (!bounds) {
    throw new Error('Gameplay arena has no visible bounds.')
  }
  await arena.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } })
}

export async function advanceGame(page: Page, milliseconds: number): Promise<void> {
  await page.evaluate((elapsed) => {
    const api = (window as TestWindow).__NAVAL_GAME_TEST__
    if (!api) {
      throw new Error('The deterministic game clock is unavailable.')
    }
    api.advance(elapsed)
  }, milliseconds)
}

export async function inspectGame(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    const api = (window as TestWindow).__NAVAL_GAME_TEST__
    if (!api) {
      throw new Error('The deterministic game state is unavailable.')
    }
    return api.inspect()
  })
}

export async function placeEnemy(
  page: Page,
  kind: 'chaser' | 'shooter',
  x: number,
  y: number,
  options?: { health?: number; speed?: number; fireCooldown?: number; angle?: number },
): Promise<string> {
  return page.evaluate(({ enemyKind, xPosition, yPosition, enemyOptions }) => {
    const api = (window as TestWindow).__NAVAL_GAME_TEST__
    if (!api) {
      throw new Error('The deterministic game fixtures are unavailable.')
    }
    return api.placeEnemy(enemyKind, xPosition, yPosition, enemyOptions)
  }, { enemyKind: kind, xPosition: x, yPosition: y, enemyOptions: options })
}

export async function setPlayerPosition(page: Page, x: number, y: number, angle = 0): Promise<void> {
  await page.evaluate(({ xPosition, yPosition, rotation }) => {
    const api = (window as TestWindow).__NAVAL_GAME_TEST__
    if (!api) {
      throw new Error('The deterministic game fixtures are unavailable.')
    }
    api.setPlayerPosition(xPosition, yPosition, rotation)
  }, { xPosition: x, yPosition: y, rotation: angle })
}
