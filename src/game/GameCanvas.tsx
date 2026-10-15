import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { createGameState, updateGameState } from './engine'
import type { EnemyType, GameplayConfig } from '../types/game'
import type { EnemyState, GameState } from './engine'
import playerShipTexture from '../assets/ship_1-HOE-34V8.png'

// Implementação da Seção 3 e Seção 4: telas do jogo, input, HUD e integração com PixiJS/arquitetura do canvas.
import chaserShipTexture from '../assets/ship_5-DsjvB4dj.png'
import shooterShipTexture from '../assets/ship_1-HOE-34V8.png'

type HudState = {
  score: number
  lives: number
  timeLeft: number
}

type GameCanvasProps = {
  config: GameplayConfig
  onGameOver: (score: number, reason: 'time' | 'defeat', duration: number) => void
  onHudChange: (hud: HudState) => void
}

const ARENA_WIDTH = 960
const ARENA_HEIGHT = 540

type TestSnapshot = Pick<GameState, 'score' | 'timeLeft' | 'running' | 'paused' | 'reason' | 'spawnCount'> & {
  player: Pick<GameState['player'], 'x' | 'y' | 'angle' | 'health' | 'fireCooldown' | 'secondaryFireCooldown'>
  enemies: Array<Pick<EnemyState, 'id' | 'kind' | 'x' | 'y' | 'angle' | 'health' | 'speed' | 'fireCooldown'>>
  bullets: Array<Pick<GameState['bullets'][number], 'id' | 'x' | 'y' | 'owner' | 'damage' | 'ttl'>>
}

type TestEnemyOptions = Partial<Pick<EnemyState, 'health' | 'speed' | 'fireCooldown' | 'angle'>>

type GameProfileSample = {
  elapsedSeconds: number
  score: number
  timeLeft: number
  running: boolean
  paused: boolean
  reason: GameState['reason']
  enemies: number
  bullets: number
  gameEntities: number
  pixiDisplayObjects: number
  canvasWidth: number
  canvasHeight: number
}

declare global {
  interface Window {
    __NAVAL_GAME_TEST__?: {
      advance: (milliseconds: number) => void
      inspect: () => TestSnapshot
      placeEnemy: (kind: EnemyType, x: number, y: number, options?: TestEnemyOptions) => string
      setPlayerPosition: (x: number, y: number, angle?: number) => void
      setPlayerHealth: (health: number) => void
      suppressSpawns: () => void
    }
    __NAVAL_GAME_PROFILE__?: {
      inspect: () => GameProfileSample
    }
  }
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function drawBullet(graphics: Graphics, x: number, y: number, radius: number, color: number): void {
  graphics.clear()
  graphics.circle(x, y, radius).fill({ color })
}

function drawOcean(graphics: Graphics): void {
  graphics.rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT).fill({ color: 0x17647a })

  for (let row = 0; row < 12; row += 1) {
    const y = 26 + row * 46
    for (let column = 0; column < 15; column += 1) {
      const x = 20 + column * 68 + (row % 2) * 25
      graphics
        .moveTo(x, y)
        .quadraticCurveTo(x + 14, y - 5, x + 28, y)
        .stroke({ color: 0x8bd5d2, alpha: 0.16, width: 1.5 })
      graphics
        .moveTo(x + 7, y + 8)
        .quadraticCurveTo(x + 17, y + 5, x + 25, y + 8)
        .stroke({ color: 0x062f49, alpha: 0.18, width: 1 })
    }
  }
}

function drawIsland(x: number, y: number, radius: number): Graphics {
  const island = new Graphics()

  island.circle(0, 0, radius).fill({ color: 0x173e42, alpha: 0.34 })
  island.ellipse(-2, -2, radius * 0.92, radius * 0.78).fill({ color: 0xc9a56a })
  island
    .ellipse(-3, -5, radius * 0.72, radius * 0.59)
    .fill({ color: 0x56844c })
  island
    .ellipse(radius * 0.08, -radius * 0.13, radius * 0.47, radius * 0.34)
    .fill({ color: 0x6d9954, alpha: 0.8 })
  island
    .ellipse(-radius * 0.36, radius * 0.25, radius * 0.14, radius * 0.09)
    .fill({ color: 0x3c7047, alpha: 0.8 })
  island
    .ellipse(radius * 0.35, radius * 0.2, radius * 0.12, radius * 0.08)
    .fill({ color: 0x3c7047, alpha: 0.8 })
  island.position.set(x, y)

  return island
}

function drawHealthBar(graphics: Graphics, x: number, y: number, current: number, max: number): void {
  graphics.clear()
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0

  graphics.roundRect(-22, -32, 44, 6, 3).fill({ color: 0x0d1a26 })
  graphics.roundRect(-22, -32, 44 * ratio, 6, 3).fill({ color: current > max * 0.5 ? 0x6fe6a8 : 0xf7b267 })
  graphics.x = x
  graphics.y = y
}

export function GameCanvas({ config, onGameOver, onHudChange }: GameCanvasProps) {
  const e2eParameters = new URLSearchParams(window.location.search)
  const e2eMode = import.meta.env.DEV && e2eParameters.has('e2e')
  const profileMode = e2eParameters.has('profile')
  const simulateAssetFailure = e2eMode && e2eParameters.has('assetFailure')
  const randomSeed = Number(e2eParameters.get('seed')) || 1
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [initialGameState] = useState(() => createGameState(
    config,
    undefined,
    e2eMode || profileMode ? createSeededRandom(randomSeed) : Math.random,
  ))
  const gameRef = useRef(initialGameState)
  const callbacksRef = useRef({ onGameOver, onHudChange })
  useLayoutEffect(() => {
    callbacksRef.current = { onGameOver, onHudChange }
  }, [onGameOver, onHudChange])
  const lastHudRef = useRef<HudState>({ score: -1, lives: -1, timeLeft: -1 })
  const manualAdvanceRef = useRef(false)
  const skipManualRenderRef = useRef(false)
  const texturesRef = useRef<{
    player: Texture
    chaser: Texture
    shooter: Texture
  } | null>(null)
  const sentGameOverRef = useRef(false)
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false,
    leftShot: false,
    rightShot: false,
  })
  const [isPaused, setIsPaused] = useState(false)
  const [assetProgress, setAssetProgress] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [assetLoadAttempt, setAssetLoadAttempt] = useState(0)

  const togglePause = () => {
    if (!gameRef.current.running) {
      return
    }

    setIsPaused((previous) => {
      const next = !previous
      gameRef.current.paused = next
      return next
    })
  }

  useEffect(() => {
    if (e2eMode) {
      delete window.__NAVAL_GAME_TEST__
    }
    if (profileMode) {
      delete window.__NAVAL_GAME_PROFILE__
    }

    let cancelled = false

    const preloadTextures = async () => {
      let completedCount = 0
      const sources = [
        playerShipTexture,
        chaserShipTexture,
        shooterShipTexture,
      ]

      try {
        if (simulateAssetFailure && assetLoadAttempt === 0) {
          throw new Error('Simulated arena asset load failure.')
        }

        const loadedTextures = await Promise.all(
          sources.map(async (source) => {
            const texture = await Assets.load<Texture>(source)
            completedCount += 1
            if (!cancelled) {
              setAssetProgress(Math.round((completedCount / sources.length) * 100))
            }
            return texture
          }),
        )

        if (!cancelled) {
          const [player, chaser, shooter] = loadedTextures
          if (!player || !chaser || !shooter) {
            throw new Error('One or more required arena textures could not be loaded.')
          }

          texturesRef.current = { player, chaser, shooter }
          setAssetError(null)
          setAssetsReady(true)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error)
          setAssetError(`Unable to load arena assets: ${message}`)
        }
      }
    }

    void preloadTextures()

    return () => {
      cancelled = true
    }
  }, [assetLoadAttempt, e2eMode, profileMode, simulateAssetFailure])

  useEffect(() => {
    if (!assetsReady) {
      return undefined
    }

    const host = containerRef.current
    if (!host) {
      return undefined
    }

    const textures = texturesRef.current
    if (!textures) {
      throw new Error('Arena textures must finish loading before PixiJS initialization.')
    }

    const keys = keysRef.current
    const currentGameState = gameRef.current

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'p' || key === 'escape') {
        event.preventDefault()
        togglePause()
        return
      }
      if (key === 'arrowup' || key === 'w') keys.up = true
      if (key === 'arrowdown' || key === 's') keys.down = true
      if (key === 'arrowleft' || key === 'a') keys.left = true
      if (key === 'arrowright' || key === 'd') keys.right = true
      if (key === ' ' || key === 'spacebar' || key === 'k') keys.shoot = true
      if (key === 'q') keys.leftShot = true
      if (key === 'e') keys.rightShot = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === 'arrowup' || key === 'w') keys.up = false
      if (key === 'arrowdown' || key === 's') keys.down = false
      if (key === 'arrowleft' || key === 'a') keys.left = false
      if (key === 'arrowright' || key === 'd') keys.right = false
      if (key === ' ' || key === 'spacebar' || key === 'k') keys.shoot = false
      if (key === 'q') keys.leftShot = false
      if (key === 'e') keys.rightShot = false
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && gameRef.current.running) {
        gameRef.current.paused = true
        setIsPaused(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    let disposed = false
    let initialized = false
    let testApi: Window['__NAVAL_GAME_TEST__'] | null = null
    let profileApi: Window['__NAVAL_GAME_PROFILE__'] | null = null

    const app = new Application()
    void app.init({
      width: 960,
      height: 540,
      background: '#071b2d',
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      initialized = true

      if (disposed) {
        app.destroy(true)
        return
      }

      const backgroundLayer = new Graphics()
      drawOcean(backgroundLayer)
      const islandLayer = new Container()
      const projectileLayer = new Container()
      const shipLayer = new Container()
      const healthLayer = new Container()
      const hudLayer = new Container()
      app.stage.addChild(backgroundLayer)
      app.stage.addChild(islandLayer)
      app.stage.addChild(projectileLayer)
      app.stage.addChild(shipLayer)
      app.stage.addChild(healthLayer)
      app.stage.addChild(hudLayer)

      const marker = new Text({
        text: 'Arena active',
        style: { fill: '#edf7ff', fontSize: 18, fontFamily: 'Segoe UI', fontWeight: '700' },
      })
      marker.x = 24
      marker.y = 26
      hudLayer.addChild(marker)

      const enemyHealthBars = new Map<string, Graphics>()
      const playerHealthBar = new Graphics()
      healthLayer.addChild(playerHealthBar)
      const bulletGraphics = new Map<string, Graphics>()
      const enemyTextures = {
        chaser: textures.chaser,
        shooter: textures.shooter,
      }
      const playerSprite = new Sprite(textures.player)
      const enemySprites = new Map<string, Sprite>()

      for (const island of gameRef.current.islands) {
        islandLayer.addChild(drawIsland(island.x, island.y, island.radius))
      }

      playerSprite.anchor.set(0.5)
      playerSprite.zIndex = 10
      shipLayer.addChild(playerSprite)

      const renderFrame = () => {
        const currentEnemyIds = new Set<string>()

        const player = gameRef.current.player
        playerSprite.x = player.x
        playerSprite.y = player.y
        playerSprite.rotation = player.angle + Math.PI / 2
        playerSprite.scale.set(0.72)

        drawHealthBar(playerHealthBar, player.x, player.y, player.health, player.maxHealth)

        for (const enemy of gameRef.current.enemies) {
          currentEnemyIds.add(enemy.id)
          let sprite = enemySprites.get(enemy.id)
          if (!sprite) {
            sprite = new Sprite(enemyTextures[enemy.kind])
            sprite.anchor.set(0.5)
            enemySprites.set(enemy.id, sprite)
            shipLayer.addChild(sprite)
          }

          sprite.texture = enemyTextures[enemy.kind]
          sprite.x = enemy.x
          sprite.y = enemy.y
          sprite.rotation = enemy.angle + Math.PI / 2
          sprite.scale.set(enemy.kind === 'chaser' ? 0.58 : 0.54)

          let bar = enemyHealthBars.get(enemy.id)
          if (!bar) {
            bar = new Graphics()
            enemyHealthBars.set(enemy.id, bar)
            healthLayer.addChild(bar)
          }
          drawHealthBar(bar, enemy.x, enemy.y, enemy.health, enemy.maxHealth)
        }

        for (const [enemyId, sprite] of [...enemySprites.entries()]) {
          if (!currentEnemyIds.has(enemyId)) {
            sprite.destroy()
            enemySprites.delete(enemyId)
          }
        }

        for (const [enemyId, bar] of [...enemyHealthBars.entries()]) {
          if (!currentEnemyIds.has(enemyId)) {
            bar.destroy()
            enemyHealthBars.delete(enemyId)
          }
        }

        const activeBulletIds = new Set<string>()
        for (const bullet of gameRef.current.bullets) {
          activeBulletIds.add(bullet.id)
          const bulletKey = bullet.id
          let graphic = bulletGraphics.get(bulletKey)
          if (!graphic) {
            graphic = new Graphics()
            bulletGraphics.set(bulletKey, graphic)
            projectileLayer.addChild(graphic)
          }
          drawBullet(graphic, bullet.x, bullet.y, bullet.radius, bullet.owner === 'player' ? 0x7ad8ff : 0xffcc66)
        }

        for (const bulletId of [...bulletGraphics.keys()]) {
          if (!activeBulletIds.has(bulletId)) {
            const graphic = bulletGraphics.get(bulletId)
            graphic?.destroy()
            bulletGraphics.delete(bulletId)
          }
        }

        const scoreText = `Score: ${gameRef.current.score}`
        const livesText = `Lives: ${gameRef.current.player.health}`
        const timeText = `Time: ${Math.ceil(gameRef.current.timeLeft)}s`
        const statusText = gameRef.current.paused ? 'PAUSED' : 'Arena active'
        const nextMarkerText = `${statusText} • ${scoreText} • ${livesText} • ${timeText}`
        if (marker.text !== nextMarkerText) {
          marker.text = nextMarkerText
        }

        if (e2eMode) {
          app.render()
        }
      }

      const handleTick = (ticker: { deltaMS: number }) => {
        if (e2eMode && !manualAdvanceRef.current) {
          return
        }

        const delta = Math.min(ticker.deltaMS / 1000, 0.033)
        updateGameState(gameRef.current, keys, delta)
        if (!skipManualRenderRef.current) {
          renderFrame()
        }

        const currentHud = {
          score: gameRef.current.score,
          lives: Math.max(0, gameRef.current.player.health),
          timeLeft: Math.ceil(gameRef.current.timeLeft),
        }
        const previousHud = lastHudRef.current
        if (
          currentHud.score !== previousHud.score
          || currentHud.lives !== previousHud.lives
          || currentHud.timeLeft !== previousHud.timeLeft
        ) {
          lastHudRef.current = currentHud
          callbacksRef.current.onHudChange(currentHud)
        }

        if (!gameRef.current.running && !sentGameOverRef.current) {
          sentGameOverRef.current = true
          callbacksRef.current.onGameOver(
            gameRef.current.score,
            gameRef.current.reason ?? 'time',
            gameRef.current.config.sessionTime - gameRef.current.timeLeft,
          )
        }
      }

      if (e2eMode) {
        app.stop()
      }

      if (profileMode) {
        profileApi = {
          inspect: () => {
            const state = gameRef.current
            let pixiDisplayObjects = 0
            const countDisplayObjects = (container: Container) => {
              for (const child of container.children) {
                pixiDisplayObjects += 1
                if (child instanceof Container) {
                  countDisplayObjects(child)
                }
              }
            }
            countDisplayObjects(app.stage)

            return {
              elapsedSeconds: state.config.sessionTime - state.timeLeft,
              score: state.score,
              timeLeft: state.timeLeft,
              running: state.running,
              paused: state.paused,
              reason: state.reason,
              enemies: state.enemies.filter((enemy) => enemy.active).length,
              bullets: state.bullets.length,
              gameEntities: 1 + state.enemies.filter((enemy) => enemy.active).length + state.bullets.length,
              pixiDisplayObjects,
              canvasWidth: app.canvas.width,
              canvasHeight: app.canvas.height,
            }
          },
        }
        window.__NAVAL_GAME_PROFILE__ = profileApi
      }

      app.canvas.style.width = '100%'
      app.canvas.style.height = '100%'
      host.appendChild(app.canvas)
      app.ticker.add(handleTick)
      renderFrame()

      if (e2eMode) {
        testApi = {
          advance: (milliseconds) => {
            let remaining = milliseconds
            manualAdvanceRef.current = true
            skipManualRenderRef.current = true
            try {
              while (remaining > 0) {
                const delta = Math.min(remaining, 33)
                handleTick({ deltaMS: delta })
                remaining -= delta
              }
            } finally {
              manualAdvanceRef.current = false
              skipManualRenderRef.current = false
            }
            renderFrame()
          },
          inspect: () => {
            const state = gameRef.current
            return {
              score: state.score,
              timeLeft: state.timeLeft,
              running: state.running,
              paused: state.paused,
              reason: state.reason,
              spawnCount: state.spawnCount,
              player: {
                x: state.player.x,
                y: state.player.y,
                angle: state.player.angle,
                health: state.player.health,
                fireCooldown: state.player.fireCooldown,
                secondaryFireCooldown: state.player.secondaryFireCooldown,
              },
              enemies: state.enemies.map(({ id, kind, x, y, angle, health, speed, fireCooldown }) => ({
                id,
                kind,
                x,
                y,
                angle,
                health,
                speed,
                fireCooldown,
              })),
              bullets: state.bullets.map(({ id, x, y, owner, damage, ttl }) => ({
                id,
                x,
                y,
                owner,
                damage,
                ttl,
              })),
            }
          },
          placeEnemy: (kind, x, y, options = {}) => {
            const balance = gameRef.current.balance.enemies[kind]
            const initialFireCooldown = kind === 'shooter'
              ? gameRef.current.balance.enemies.shooter.fireCooldown
              : 0
            const enemy: EnemyState = {
              id: `e2e-${kind}-${gameRef.current.nextEntityId++}`,
              kind,
              x,
              y,
              radius: balance.radius,
              angle: options.angle ?? 0,
              speed: options.speed ?? balance.speed,
              health: options.health ?? balance.health,
              maxHealth: options.health ?? balance.health,
              fireCooldown: options.fireCooldown ?? initialFireCooldown,
              secondaryFireCooldown: 0,
              invulnerable: 0,
              active: true,
            }
            gameRef.current.enemies.push(enemy)
            renderFrame()
            return enemy.id
          },
          setPlayerPosition: (x, y, angle = gameRef.current.player.angle) => {
            gameRef.current.player.x = x
            gameRef.current.player.y = y
            gameRef.current.player.angle = angle
            for (const key of Object.keys(keys) as Array<keyof typeof keys>) {
              keys[key] = false
            }
            renderFrame()
          },
          setPlayerHealth: (health) => {
            gameRef.current.player.health = Math.max(0, Math.min(gameRef.current.player.maxHealth, health))
            renderFrame()
          },
          suppressSpawns: () => {
            gameRef.current.spawnCooldown = gameRef.current.config.sessionTime + 1
          },
        }
        window.__NAVAL_GAME_TEST__ = testApi
      }
    })

    return () => {
      disposed = true
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (
        testApi
        && currentGameState.running
        && window.__NAVAL_GAME_TEST__ === testApi
      ) {
        delete window.__NAVAL_GAME_TEST__
      }
      if (profileApi && window.__NAVAL_GAME_PROFILE__ === profileApi) {
        delete window.__NAVAL_GAME_PROFILE__
      }

      if (initialized) {
        app.destroy(true)
      }

      const canvas = host.querySelector('canvas')
      if (canvas) {
        canvas.remove()
      }
    }
  }, [assetsReady, e2eMode, profileMode])

  const setKeyState = (key: 'up' | 'down' | 'left' | 'right' | 'shoot' | 'leftShot' | 'rightShot', value: boolean) => {
    keysRef.current[key] = value
  }

  if (!assetsReady) {
    return (
      <div className="game-area loading-area" aria-live="polite" aria-busy="true" aria-label="Loading arena assets">
        <div className="loading-overlay">
          {assetError ? (
            <>
              <p className="loading-label" role="alert">{assetError}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setAssetError(null)
                  setAssetProgress(0)
                  setAssetLoadAttempt((attempt) => attempt + 1)
                }}
              >
                Retry loading assets
              </button>
            </>
          ) : (
            <>
              <p className="loading-label">Loading arena assets</p>
              <div className="loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={assetProgress}>
                <span style={{ width: `${assetProgress}%` }} />
              </div>
              <strong>{assetProgress}%</strong>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="game-area" ref={containerRef} data-game-canvas-root="true" aria-label="Gameplay arena" style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={isPaused ? 'Resume the battle' : 'Pause the battle'}
        onClick={togglePause}
        style={{
          position: 'absolute',
          right: 16,
          top: 16,
          zIndex: 2,
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(12,32,47,0.8)',
          color: '#edf7ff',
          padding: '0.5rem 0.8rem',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>

      <div className="touch-controls" aria-label="Touch controls">
        <div className="touch-group">
          <button type="button" aria-label="Move forward" className="touch-button" onPointerDown={() => setKeyState('up', true)} onPointerUp={() => setKeyState('up', false)} onPointerLeave={() => setKeyState('up', false)}>▲</button>
          <button type="button" aria-label="Move backward" className="touch-button" onPointerDown={() => setKeyState('down', true)} onPointerUp={() => setKeyState('down', false)} onPointerLeave={() => setKeyState('down', false)}>▼</button>
        </div>
        <div className="touch-group">
          <button type="button" aria-label="Turn left" className="touch-button" onPointerDown={() => setKeyState('left', true)} onPointerUp={() => setKeyState('left', false)} onPointerLeave={() => setKeyState('left', false)}>◀</button>
          <button type="button" aria-label="Turn right" className="touch-button" onPointerDown={() => setKeyState('right', true)} onPointerUp={() => setKeyState('right', false)} onPointerLeave={() => setKeyState('right', false)}>▶</button>
        </div>
        <div className="touch-group">
          <button type="button" aria-label="Fire front cannon" className="touch-button" onPointerDown={() => setKeyState('shoot', true)} onPointerUp={() => setKeyState('shoot', false)} onPointerLeave={() => setKeyState('shoot', false)}>Fire</button>
          <button type="button" aria-label="Fire left burst" className="touch-button" onPointerDown={() => setKeyState('leftShot', true)} onPointerUp={() => setKeyState('leftShot', false)} onPointerLeave={() => setKeyState('leftShot', false)}>Q</button>
          <button type="button" aria-label="Fire right burst" className="touch-button" onPointerDown={() => setKeyState('rightShot', true)} onPointerUp={() => setKeyState('rightShot', false)} onPointerLeave={() => setKeyState('rightShot', false)}>E</button>
        </div>
      </div>

      {isPaused ? (
        <div
          aria-live="polite"
          aria-label="Game paused"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(4, 15, 26, 0.42)',
            color: '#edf7ff',
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            zIndex: 1,
          }}
        >
          Paused
        </div>
      ) : null}
    </div>
  )
}
