import { spawn } from 'node:child_process'
import { cpus, platform, release, totalmem } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = 'http://127.0.0.1:4180'
const matchDurationSeconds = 180
const spawnIntervalSeconds = 20
const playerLives = 5
const seed = 20261015
const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4180', '--strictPort'],
  { stdio: 'ignore', windowsHide: true },
)

let browser

async function waitForPreview() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      await delay(1000)
    }
  }
  throw new Error('Vite preview did not become available at port 4180.')
}

async function waitForProfileApi(page) {
  await page.waitForFunction(() => Boolean(window.__NAVAL_GAME_PROFILE__), null, { timeout: 15000 })
}

async function getProfileSample(page) {
  return page.evaluate(() => window.__NAVAL_GAME_PROFILE__?.inspect() ?? null)
}

function metric(metrics, name) {
  return metrics.find((entry) => entry.name === name)?.value ?? null
}

async function readMemoryMetrics(client, label) {
  const { metrics } = await client.send('Performance.getMetrics')
  return {
    label,
    heapUsedMB: metric(metrics, 'JSHeapUsedSize') / 1024 / 1024,
    heapTotalMB: metric(metrics, 'JSHeapTotalSize') / 1024 / 1024,
    domNodes: metric(metrics, 'Nodes'),
    eventListeners: metric(metrics, 'JSEventListeners'),
  }
}

async function collectMemorySample(client, label) {
  await client.send('HeapProfiler.collectGarbage')
  return readMemoryMetrics(client, label)
}

async function startBattle(page) {
  await page.bringToFront()
  await page.waitForFunction(() => document.visibilityState === 'visible')
  await page.getByRole('button', { name: 'Start a new battle' }).first().click()
  await waitForProfileApi(page)
  await page.locator('[data-game-canvas-root="true"]').locator('canvas').waitFor({ state: 'visible' })
}

async function exitBattle(page) {
  await page.getByRole('button', { name: 'Open main menu' }).click()
  await page.getByRole('tab', { name: 'Ranking' }).waitFor({ state: 'visible' })
  await page.locator('[data-game-canvas-root="true"]').waitFor({ state: 'detached' })
}

async function main() {
  await waitForPreview()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const client = await context.newCDPSession(page)
  await client.send('Performance.enable')
  await page.addInitScript(({ sessionTime, spawnInterval, lives }) => {
    localStorage.setItem('naval-shooter-config', JSON.stringify({
      sessionTime,
      spawnInterval,
      playerLives: lives,
    }))
    localStorage.setItem('naval-shooter:mock-scenario', 'normal')
    const intervals = new Float64Array(20000)
    let intervalCount = 0
    let lastFrame = 0
    let started = false
    const sampleFrame = (timestamp) => {
      if (started && lastFrame > 0 && intervalCount < intervals.length) {
        intervals[intervalCount] = timestamp - lastFrame
        intervalCount += 1
      }
      lastFrame = timestamp
      requestAnimationFrame(sampleFrame)
    }
    requestAnimationFrame(sampleFrame)
    window.__NAVAL_FRAME_PROFILE__ = {
      start: () => {
        intervals.fill(0)
        intervalCount = 0
        lastFrame = 0
        started = true
      },
      stop: () => {
        started = false
        return Array.from(intervals.subarray(0, intervalCount))
      },
    }
  }, { sessionTime: matchDurationSeconds, spawnInterval: spawnIntervalSeconds, lives: playerLives })
  await page.goto(`${baseUrl}/?profile=1&seed=${seed}`)
  await page.getByRole('tab', { name: 'Ranking' }).waitFor({ state: 'visible' })
  const renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      renderer: info ? gl?.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'Not exposed',
      vendor: info ? gl?.getParameter(info.UNMASKED_VENDOR_WEBGL) : 'Not exposed',
    }
  })
  const initialMemory = await collectMemorySample(client, 'Before lifecycle cycles')
  const lifecycleSamples = []

  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await startBattle(page)
    await page.keyboard.down('ArrowUp')
    await page.keyboard.down('ArrowRight')
    await page.keyboard.down(' ')
    await delay(6000)
    await page.keyboard.up(' ')
    await page.keyboard.up('ArrowRight')
    await page.keyboard.up('ArrowUp')
    const during = await getProfileSample(page)
    await exitBattle(page)
    lifecycleSamples.push(await collectMemorySample(client, `After lifecycle ${cycle}`))
    lifecycleSamples[lifecycleSamples.length - 1].entitiesAtExit = during?.gameEntities ?? null
  }

  await page.getByRole('button', { name: 'Open gameplay options' }).first().click()
  await page.getByLabel('Player lives').fill(String(playerLives))
  await page.getByLabel('Enemy spawn interval in seconds').fill(String(spawnIntervalSeconds))
  await page.getByLabel('Session time in seconds').fill(String(matchDurationSeconds))
  await page.getByRole('button', { name: 'Salvar Alterações' }).click()
  await startBattle(page)

  await page.evaluate(() => window.__NAVAL_FRAME_PROFILE__?.start())
  await page.keyboard.down('ArrowUp')
  await page.keyboard.down('ArrowRight')
  await page.keyboard.down(' ')
  const entitySamples = []
  const memoryDuringMatch = []
  const matchStartedAt = Date.now()
  let pauseRecoveries = 0
  let lastMatchSample = null

  while (Date.now() - matchStartedAt < matchDurationSeconds * 3000) {
    await delay(5000)
    if (await page.evaluate(() => document.visibilityState === 'hidden')) {
      await page.bringToFront()
      await page.waitForFunction(() => document.visibilityState === 'visible')
    }
    const sample = await getProfileSample(page)
    if (!sample) {
      const pageState = await page.evaluate(() => ({
        visibilityState: document.visibilityState,
        text: document.body.innerText.slice(-1200),
        gameConfig: localStorage.getItem('naval-shooter-config'),
      }))
      throw new Error(
        `The production game profile API disappeared during the performance run. `
        + `Last sample: ${JSON.stringify(lastMatchSample)}. Page: ${JSON.stringify(pageState)}`,
      )
    }
    if (sample.paused) {
      pauseRecoveries += 1
      await page.getByRole('button', { name: 'Resume the battle' }).click()
      await page.waitForFunction(() => window.__NAVAL_GAME_PROFILE__?.inspect().paused === false)
    }
    lastMatchSample = sample
    entitySamples.push(sample)
    if (entitySamples.length % 6 === 0) {
      memoryDuringMatch.push(await readMemoryMetrics(client, `Match sample ${entitySamples.length / 6}`))
    }
    if (!sample.running || sample.elapsedSeconds >= matchDurationSeconds) {
      break
    }
  }

  await page.keyboard.up(' ')
  await page.keyboard.up('ArrowRight')
  await page.keyboard.up('ArrowUp')
  const frameIntervals = await page.evaluate(() => window.__NAVAL_FRAME_PROFILE__?.stop() ?? [])
  await page.waitForTimeout(1000)
  const finalProfile = await getProfileSample(page) ?? lastMatchSample
  const endMatchMemory = await collectMemorySample(client, 'After three-minute match')
  const wallDurationSeconds = (Date.now() - matchStartedAt) / 1000
  if (
    !finalProfile
    || finalProfile.reason !== 'time'
    || finalProfile.elapsedSeconds < matchDurationSeconds - 1
  ) {
    throw new Error(
      `Profiling run did not complete the intended three-minute match: ${JSON.stringify(finalProfile)} `
      + `after ${wallDurationSeconds.toFixed(2)}s of wall time.`,
    )
  }
  const elapsedSeconds = frameIntervals.reduce((sum, interval) => sum + interval, 0) / 1000
  const sortedIntervals = [...frameIntervals].sort((a, b) => a - b)
  const p95FrameMs = sortedIntervals.length
    ? sortedIntervals[Math.ceil(sortedIntervals.length * 0.95) - 1]
    : null
  const averageFps = elapsedSeconds > 0 ? frameIntervals.length / elapsedSeconds : null
  const entityValues = entitySamples.map((sample) => sample.gameEntities)
  const maxEntities = entityValues.length ? Math.max(...entityValues) : 0
  const averageEntities = entityValues.length
    ? entityValues.reduce((sum, value) => sum + value, 0) / entityValues.length
    : 0
  const maxEnemies = entitySamples.length ? Math.max(...entitySamples.map((sample) => sample.enemies)) : 0
  const maxBullets = entitySamples.length ? Math.max(...entitySamples.map((sample) => sample.bullets)) : 0
  const lastLifecycleMemory = lifecycleSamples.at(-1)
  const memoryDeltaMB = lastLifecycleMemory.heapUsedMB - initialMemory.heapUsedMB
  const report = [
    'RELATORIO DE PROFILING DE PERFORMANCE - PIRATE BATTLE',
    '=====================================================',
    '',
    `Data/hora: ${new Date().toISOString()}`,
    'Build: build de producao Vite (npm run build) servido por npm run preview.',
    `Sistema operacional: ${platform()} ${release()}`,
    `CPU: ${cpus()[0]?.model ?? 'Nao identificada'} (${cpus().length} nucleos logicos)`,
    `Memoria fisica instalada: ${(totalmem() / 1024 ** 3).toFixed(1)} GiB`,
    `Navegador: Chromium ${browser.version()}`,
    `User agent: ${renderer.userAgent}`,
    `Renderizador WebGL reportado: ${renderer.renderer} / ${renderer.vendor}`,
    `Viewport: 1280x720 CSS px; devicePixelRatio ${renderer.devicePixelRatio}.`,
    'Arena logica: 960x540 (16:9).',
    '',
    'CENARIO DE COMBATE',
    '------------------',
    `Configuracao: duracao ${matchDurationSeconds}s; intervalo de spawn ${spawnIntervalSeconds}s; ${playerLives} vidas.`,
    `Seed de spawn: ${seed}. Entradas durante a medicao: manter avancar, rotacionar e disparo frontal.`,
    `Tempo medido entre o inicio e o fim da coleta de frames: ${elapsedSeconds.toFixed(2)}s.`,
    `Tempo simulado completado: ${finalProfile.elapsedSeconds.toFixed(2)}s.`,
    `Tempo real da partida: ${wallDurationSeconds.toFixed(2)}s.`,
    `Recuperacoes de pausa feitas pelo profiler: ${pauseRecoveries}.`,
    'Partida completa por tempo: sim.',
    `Estado ao final: ${finalProfile ? JSON.stringify(finalProfile) : 'indisponivel'}.`,
    `Frames coletados: ${frameIntervals.length}.`,
    `FPS medio observado: ${averageFps?.toFixed(2) ?? 'indisponivel'} (alvo: 60 FPS).`,
    `Intervalo entre frames p95: ${p95FrameMs?.toFixed(2) ?? 'indisponivel'} ms (referencia de 60 FPS: 16.67 ms).`,
    `Frames acima de 16.67 ms: ${frameIntervals.filter((interval) => interval > 1000 / 60).length}.`,
    `Frames acima de 33.33 ms: ${frameIntervals.filter((interval) => interval > 1000 / 30).length}.`,
    `Entidades de gameplay (jogador + inimigos ativos + projeteis): media ${averageEntities.toFixed(1)}, pico ${maxEntities}.`,
    `Pico de inimigos ativos: ${maxEnemies}; pico de projeteis: ${maxBullets}.`,
    `Pico de objetos de exibicao PixiJS observado: ${entitySamples.length ? Math.max(...entitySamples.map((sample) => sample.pixiDisplayObjects)) : 0}.`,
    '',
    'MEMORIA E CICLO DE VIDA',
    '-----------------------',
    'Cada amostra de memoria foi coletada via Chrome DevTools Protocol apos HeapProfiler.collectGarbage.',
    `Referencia inicial: ${initialMemory.heapUsedMB.toFixed(2)} MiB heap usado; ${initialMemory.domNodes} nos DOM; ${initialMemory.eventListeners} listeners.`,
    ...lifecycleSamples.map((sample) =>
      `${sample.label}: ${sample.heapUsedMB.toFixed(2)} MiB heap usado; ${sample.domNodes} nos DOM; ${sample.eventListeners} listeners; ${sample.entitiesAtExit} entidades antes de sair.`,
    ),
    `Diferenca de heap apos cinco ciclos vs. referencia: ${memoryDeltaMB >= 0 ? '+' : ''}${memoryDeltaMB.toFixed(2)} MiB.`,
    ...memoryDuringMatch.map((sample) =>
      `${sample.label}: ${sample.heapUsedMB.toFixed(2)} MiB heap usado; ${sample.domNodes} nos DOM; ${sample.eventListeners} listeners.`,
    ),
    `Apos a partida: ${endMatchMemory.heapUsedMB.toFixed(2)} MiB heap usado; ${endMatchMemory.domNodes} nos DOM; ${endMatchMemory.eventListeners} listeners.`,
    '',
    'LIMITACOES',
    '----------',
    '- Execucao automatizada em Chromium headless; o renderizador pode ser SwiftShader/software e nao representa necessariamente uma GPU fisica.',
    '- O FPS e o p95 sao amostras de requestAnimationFrame do navegador, nao uma medicao independente de apresentacao/scanout do monitor.',
    '- A medicao de memoria cobre heap JavaScript, nos DOM e listeners reportados pelo Chromium; nao mede diretamente memoria GPU, RSS do processo ou todos os recursos nativos do PixiJS.',
    '- Os cinco ciclos consistem em iniciar, jogar por seis segundos com controles ativos e sair; a comparacao usa heap apos coleta forcada de lixo.',
    '- A partida termina por tempo ou morte. Se acabar por morte antes de 180 segundos, a duracao real fica indicada acima e nao se deve interpretar como tres minutos completos.',
    '- Resultado obtido neste ambiente de referencia local; repetir em hardware e navegador de destino antes de assumir como garantia de desempenho.',
    '',
  ].join('\n')

  await writeFile('PERFORMANCE-REPORT.txt', report, 'utf8')
  console.log(report)
  await context.close()
}

try {
  await main()
} finally {
  await browser?.close()
  preview.kill()
}
