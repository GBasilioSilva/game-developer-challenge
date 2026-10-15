import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_GAME_BALANCE } from '../config'
import type { EnemyState, InputState } from './engine'
import { createGameState, updateGameState } from './engine'

const neutralInput: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  leftShot: false,
  rightShot: false,
}

function createState(random?: () => number) {
  return createGameState({ ...DEFAULT_CONFIG }, DEFAULT_GAME_BALANCE, random)
}

function createEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'enemy-test',
    kind: 'chaser',
    x: 350,
    y: 270,
    radius: 18,
    angle: 0,
    speed: 0,
    health: 1,
    maxHealth: 1,
    fireCooldown: 10,
    secondaryFireCooldown: 0,
    invulnerable: 0,
    active: true,
    ...overrides,
  }
}

describe('game engine', () => {
  it('copies the match options and balance into a match snapshot', () => {
    const options = { ...DEFAULT_CONFIG }
    const balance = structuredClone(DEFAULT_GAME_BALANCE)
    const state = createGameState(options, balance)

    options.sessionTime = 180
    balance.player.movementSpeed = 1
    balance.arena.islands[0]!.x = 1

    expect(state.config.sessionTime).toBe(DEFAULT_CONFIG.sessionTime)
    expect(state.balance.player.movementSpeed).toBe(DEFAULT_GAME_BALANCE.player.movementSpeed)
    expect(state.islands[0]!.x).toBe(DEFAULT_GAME_BALANCE.arena.islands[0]!.x)
  })

  it('uses tuning values from the typed balance configuration', () => {
    const balance = structuredClone(DEFAULT_GAME_BALANCE)
    balance.player.movementSpeed = 100
    const state = createGameState({ ...DEFAULT_CONFIG }, balance)
    state.player.x = 200
    state.player.y = 270
    state.spawnCooldown = 100

    updateGameState(state, { ...neutralInput, up: true }, 0.1)

    expect(state.player.x).toBeCloseTo(210)
  })

  it('moves and rotates the player according to elapsed simulation time', () => {
    const state = createState()
    state.player.x = 120
    state.player.y = 270

    updateGameState(state, { ...neutralInput, up: true, right: true }, 0.25)

    expect(state.player.x).toBeGreaterThan(120)
    expect(state.player.angle).toBeCloseTo(DEFAULT_GAME_BALANCE.player.rotationSpeed * 0.25)
    expect(state.timeLeft).toBe(DEFAULT_CONFIG.sessionTime - 0.25)
  })

  it('keeps the player inside arena boundaries', () => {
    const state = createState()
    state.player.x = state.width - DEFAULT_GAME_BALANCE.arena.playerBoundaryPadding
    state.player.y = 270

    updateGameState(state, { ...neutralInput, up: true }, 1)

    expect(state.player.x).toBeLessThanOrEqual(state.width - DEFAULT_GAME_BALANCE.arena.playerBoundaryPadding)
    expect(state.player.x).toBeGreaterThanOrEqual(state.width - DEFAULT_GAME_BALANCE.arena.playerBoundaryPadding - 1)
  })

  it('prevents the player from passing through an island, including on a long tick', () => {
    const state = createState()
    state.player.x = 160
    state.player.y = 180
    state.islands = [{ x: 260, y: 180, radius: 64 }]

    updateGameState(state, { ...neutralInput, up: true }, 1)

    expect(Math.hypot(state.player.x - 260, state.player.y - 180))
      .toBeGreaterThanOrEqual(state.player.radius + 64)
  })

  it('prevents an enemy ship from passing through an island', () => {
    const state = createState()
    state.player.x = 800
    state.player.y = 450
    state.islands = [{ x: 260, y: 180, radius: 64 }]
    const chaser = createEnemy({ x: 160, y: 180, speed: 300 })
    state.enemies.push(chaser)

    updateGameState(state, neutralInput, 0.5)

    expect(Math.hypot(chaser.x - 260, chaser.y - 180))
      .toBeGreaterThanOrEqual(chaser.radius + 64)
  })

  it('does not advance the game for invalid or paused time steps', () => {
    const state = createState()
    const startX = state.player.x
    const startTime = state.timeLeft
    state.paused = true

    updateGameState(state, { ...neutralInput, up: true }, 1)
    state.paused = false
    updateGameState(state, { ...neutralInput, up: true }, Number.NaN)
    updateGameState(state, { ...neutralInput, up: true }, -1)

    expect(state.player.x).toBe(startX)
    expect(state.timeLeft).toBe(startTime)
  })

  it('ends the match at zero health before processing further game actions', () => {
    const state = createState()
    state.player.health = 0
    const startTime = state.timeLeft

    updateGameState(state, { ...neutralInput, up: true, shoot: true }, 0.1)

    expect(state.running).toBe(false)
    expect(state.reason).toBe('defeat')
    expect(state.player.x).toBe(130)
    expect(state.timeLeft).toBe(startTime)
    expect(state.bullets).toHaveLength(0)
    expect(state.score).toBe(0)
  })

  it('ends the match when the timer expires without moving or firing', () => {
    const state = createState()
    state.timeLeft = 0.1

    updateGameState(state, { ...neutralInput, up: true, shoot: true }, 0.2)

    expect(state.running).toBe(false)
    expect(state.reason).toBe('time')
    expect(state.player.x).toBe(130)
    expect(state.bullets).toHaveLength(0)
  })

  it('fires the frontal cannon and a separate three-shot parallel broadside', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.spawnCooldown = 100

    updateGameState(
      state,
      { ...neutralInput, shoot: true, leftShot: true },
      0.01,
    )

    expect(state.bullets).toHaveLength(4)
    const broadside = state.bullets.filter((bullet) => bullet.y < 260)
    expect(broadside).toHaveLength(3)
    expect(new Set(broadside.map((bullet) => bullet.vx)).size).toBe(1)
    expect(new Set(broadside.map((bullet) => bullet.vy)).size).toBe(1)
    expect(new Set(broadside.map((bullet) => bullet.x)).size).toBe(3)
    expect(state.player.fireCooldown).toBeGreaterThan(0)
    expect(state.player.secondaryFireCooldown).toBeGreaterThan(0)
  })

  it('keeps frontal and broadside firing cooldowns independent', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.spawnCooldown = 100

    updateGameState(state, { ...neutralInput, shoot: true, rightShot: true }, 0.01)
    const firstShotIds = new Set(state.bullets.map((bullet) => bullet.id))
    updateGameState(state, neutralInput, 0.01)
    updateGameState(state, { ...neutralInput, shoot: true, rightShot: true }, 0.22)

    expect(state.bullets.some((bullet) => bullet.id === 'bullet-4')).toBe(true)
    expect(state.bullets.some((bullet) => bullet.id === 'bullet-5')).toBe(false)
    expect(state.bullets.some((bullet) => firstShotIds.has(bullet.id))).toBe(true)
  })

  it('removes a projectile when its path crosses an island', () => {
    const state = createState()
    state.player.x = 150
    state.player.y = 180
    state.islands = [{ x: 260, y: 180, radius: 64 }]
    state.spawnCooldown = 100

    updateGameState(state, { ...neutralInput, shoot: true }, 0.2)

    expect(state.bullets).toHaveLength(0)
  })

  it('lets an island block an enemy projectile before it reaches the player', () => {
    const state = createState()
    state.player.x = 365
    state.player.y = 180
    state.bullets.push({
      id: 'blocked-shot',
      x: 150,
      y: 180,
      radius: 5,
      vx: 1000,
      vy: 0,
      damage: 1,
      ttl: 2,
      owner: 'enemy',
    })

    updateGameState(state, neutralInput, 0.3)

    expect(state.player.health).toBe(DEFAULT_CONFIG.playerLives)
    expect(state.bullets).toHaveLength(0)
  })

  it('awards a single point when simultaneous projectiles hit the same enemy', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.spawnCooldown = 100
    state.enemies.push(createEnemy({ x: 300, y: 270 }))
    state.bullets.push(
      { id: 'first', x: 228, y: 270, radius: 4, vx: 500, vy: 0, damage: 1, ttl: 2, owner: 'player' },
      { id: 'second', x: 228, y: 270, radius: 4, vx: 500, vy: 0, damage: 1, ttl: 2, owner: 'player' },
    )

    updateGameState(state, neutralInput, 0.2)

    expect(state.score).toBe(DEFAULT_GAME_BALANCE.scoring.pointsPerEnemy)
    expect(state.enemies).toHaveLength(0)
    expect(state.bullets).toHaveLength(1)
  })

  it('stops the simulation immediately when an enemy projectile defeats the player', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.player.health = 1
    state.enemies.push(createEnemy({ x: 300, y: 270 }))
    state.bullets.push(
      { id: 'lethal', x: 170, y: 270, radius: 5, vx: 100, vy: 0, damage: 1, ttl: 2, owner: 'enemy' },
      { id: 'after-death', x: 228, y: 270, radius: 4, vx: 500, vy: 0, damage: 1, ttl: 2, owner: 'player' },
    )

    updateGameState(state, neutralInput, 0.4)

    expect(state.running).toBe(false)
    expect(state.reason).toBe('defeat')
    expect(state.player.health).toBe(0)
    expect(state.score).toBe(0)
    expect(state.bullets).toHaveLength(0)
  })

  it('checks projectile hits up to the exact point where its lifetime expires', () => {
    const state = createState()
    state.player.x = 130
    state.player.y = 270
    state.enemies.push(createEnemy({ x: 200, y: 390 }))
    state.bullets.push({
      id: 'short-lived',
      x: 200,
      y: 400,
      radius: 4,
      vx: 0,
      vy: -100,
      damage: 1,
      ttl: 0.05,
      owner: 'player',
    })

    updateGameState(state, neutralInput, 0.2)

    expect(state.score).toBe(1)
    expect(state.enemies).toHaveLength(0)
    expect(state.bullets).toHaveLength(0)
  })

  it('damages the player on a chaser collision without awarding points', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.enemies.push(createEnemy({ x: 240, y: 270, angle: Math.PI, speed: 90 }))

    updateGameState(state, neutralInput, 0.2)

    expect(state.player.health).toBe(DEFAULT_CONFIG.playerLives - 1)
    expect(state.score).toBe(0)
    expect(state.enemies).toHaveLength(0)
  })

  it('fires a Shooter projectile when the player is within attack range', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.enemies.push(createEnemy({
      id: 'shooter-test',
      kind: 'shooter',
      x: 245,
      y: 270,
      radius: DEFAULT_GAME_BALANCE.enemies.shooter.radius,
      angle: Math.PI,
      speed: 0,
      fireCooldown: 0,
    }))

    updateGameState(state, neutralInput, 0.01)

    expect(state.player.health).toBe(DEFAULT_CONFIG.playerLives - 1)
    expect(state.enemies[0]!.fireCooldown).toBeGreaterThan(0)
  })

  it('keeps the player safe from additional projectile damage during invulnerability', () => {
    const state = createState()
    state.player.x = 200
    state.player.y = 270
    state.player.invulnerable = 0.5
    state.bullets.push({
      id: 'ignored-damage',
      x: 170,
      y: 270,
      radius: 5,
      vx: 100,
      vy: 0,
      damage: 1,
      ttl: 2,
      owner: 'enemy',
    })

    updateGameState(state, neutralInput, 0.4)

    expect(state.player.health).toBe(DEFAULT_CONFIG.playerLives)
    expect(state.bullets).toHaveLength(0)
    expect(state.player.invulnerable).toBeCloseTo(0.1)
  })

  it('has a Shooter approach outside its range and retreat when too close', () => {
    const approachingState = createState()
    approachingState.player.x = 130
    approachingState.player.y = 270
    approachingState.enemies.push(createEnemy({
      kind: 'shooter',
      x: 500,
      y: 270,
      radius: DEFAULT_GAME_BALANCE.enemies.shooter.radius,
      angle: Math.PI,
      speed: DEFAULT_GAME_BALANCE.enemies.shooter.speed,
    }))
    const approachingShooter = approachingState.enemies[0]!

    updateGameState(approachingState, neutralInput, 0.1)

    expect(approachingShooter.x).toBeLessThan(500)

    const retreatingState = createState()
    retreatingState.player.x = 130
    retreatingState.player.y = 270
    retreatingState.enemies.push(createEnemy({
      kind: 'shooter',
      x: 220,
      y: 270,
      radius: DEFAULT_GAME_BALANCE.enemies.shooter.radius,
      angle: Math.PI,
      speed: DEFAULT_GAME_BALANCE.enemies.shooter.speed,
    }))
    const retreatingShooter = retreatingState.enemies[0]!

    updateGameState(retreatingState, neutralInput, 0.1)

    expect(retreatingShooter.x).toBeGreaterThan(220)
  })

  it('spawns Chaser and Shooter ships at safe, unoccupied positions', () => {
    const values = [0.5, 0.5, 0.5, 0.75, 0.2, 0.8, 0.25, 0.8, 0.3]
    let randomCall = 0
    const state = createState(() => values[randomCall++ % values.length]!)

    state.spawnCooldown = 0
    updateGameState(state, neutralInput, 0.001)
    state.spawnCooldown = 0
    updateGameState(state, neutralInput, 0.001)

    expect(state.enemies.map((enemy) => enemy.kind)).toEqual(['chaser', 'shooter'])
    for (const enemy of state.enemies) {
      expect(Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y))
        .toBeGreaterThanOrEqual(
          DEFAULT_GAME_BALANCE.spawning.playerSafeDistance
          + state.player.radius
          + enemy.radius,
        )
      expect(state.islands.every((island) => (
        Math.hypot(enemy.x - island.x, enemy.y - island.y)
        >= enemy.radius + island.radius + DEFAULT_GAME_BALANCE.spawning.islandClearance
      ))).toBe(true)
    }
  })
})
