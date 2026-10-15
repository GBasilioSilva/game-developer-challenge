import { DEFAULT_GAME_BALANCE } from '../config'
import type { EnemyType, GameBalanceConfig, GameplayConfig, IslandConfig, MatchReason, ProjectileConfig } from '../types/game'

// Implementação da Seção 2: gameplay, movimentação, inimigos, projéteis, colisões e condições de vitória/derrota.
export type InputState = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  shoot: boolean
  leftShot: boolean
  rightShot: boolean
}

export type EnemyKind = EnemyType

export type ShipState = {
  x: number
  y: number
  radius: number
  angle: number
  speed: number
  health: number
  maxHealth: number
  fireCooldown: number
  secondaryFireCooldown: number
  invulnerable: number
}

export type EnemyState = ShipState & {
  id: string
  kind: EnemyKind
  active: boolean
}

export type BulletState = {
  id: string
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  damage: number
  ttl: number
  owner: 'player' | 'enemy'
}

export type IslandState = IslandConfig

export type GameState = {
  width: number
  height: number
  player: ShipState
  enemies: EnemyState[]
  bullets: BulletState[]
  islands: IslandState[]
  score: number
  timeLeft: number
  running: boolean
  paused: boolean
  reason: MatchReason | null
  spawnCooldown: number
  spawnCount: number
  nextEntityId: number
  balance: GameBalanceConfig
  config: GameplayConfig
  random: () => number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function distanceBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

function createBullet(
  id: string,
  x: number,
  y: number,
  angle: number,
  config: ProjectileConfig,
  owner: 'player' | 'enemy',
): BulletState {
  return {
    id,
    x,
    y,
    radius: config.radius,
    vx: Math.cos(angle) * config.speed,
    vy: Math.sin(angle) * config.speed,
    damage: config.damage,
    ttl: config.lifetime,
    owner,
  }
}

function createEnemy(state: GameState, kind: EnemyKind, spawn: { x: number; y: number }): EnemyState {
  const balance = state.balance.enemies[kind]
  const common = {
    id: `${kind}-${state.nextEntityId++}`,
    kind,
    x: spawn.x,
    y: spawn.y,
    radius: balance.radius,
    angle: 0,
    speed: balance.speed,
    health: balance.health,
    maxHealth: balance.health,
    fireCooldown: kind === 'shooter' ? state.balance.enemies.shooter.fireCooldown : 0,
    secondaryFireCooldown: 0,
    invulnerable: 0,
    active: true,
  }

  return common
}

function overlapsIsland(
  x: number,
  y: number,
  radius: number,
  islands: readonly IslandState[],
  clearance = 0,
): boolean {
  return islands.some((island) => (
    distanceBetween(x, y, island.x, island.y) < radius + island.radius + clearance
  ))
}

function moveShip(
  entity: ShipState,
  deltaX: number,
  deltaY: number,
  state: GameState,
  boundaryPadding: number,
): void {
  const distance = Math.hypot(deltaX, deltaY)
  const maxStep = Math.max(entity.radius / 2, 1)
  const steps = Math.max(1, Math.ceil(distance / maxStep))
  const stepX = deltaX / steps
  const stepY = deltaY / steps

  for (let step = 0; step < steps; step += 1) {
    const nextX = clamp(entity.x + stepX, boundaryPadding, state.width - boundaryPadding)
    if (!overlapsIsland(nextX, entity.y, entity.radius, state.islands)) {
      entity.x = nextX
    }

    const nextY = clamp(entity.y + stepY, boundaryPadding, state.height - boundaryPadding)
    if (!overlapsIsland(entity.x, nextY, entity.radius, state.islands)) {
      entity.y = nextY
    }
  }
}

function rotateTowards(currentAngle: number, targetAngle: number, maxRotation: number): number {
  const difference = Math.atan2(
    Math.sin(targetAngle - currentAngle),
    Math.cos(targetAngle - currentAngle),
  )
  return currentAngle + clamp(difference, -maxRotation, maxRotation)
}

function segmentCircleEntryTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  circleX: number,
  circleY: number,
  radius: number,
): number | null {
  const segmentX = endX - startX
  const segmentY = endY - startY
  const offsetX = startX - circleX
  const offsetY = startY - circleY
  const a = segmentX * segmentX + segmentY * segmentY
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius

  if (c <= 0) {
    return 0
  }
  if (a === 0) {
    return null
  }

  const b = 2 * (offsetX * segmentX + offsetY * segmentY)
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) {
    return null
  }

  const entryTime = (-b - Math.sqrt(discriminant)) / (2 * a)
  return entryTime >= 0 && entryTime <= 1 ? entryTime : null
}

function segmentIntersectsCircle(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  circleX: number,
  circleY: number,
  radius: number,
): boolean {
  return segmentCircleEntryTime(
    startX,
    startY,
    endX,
    endY,
    circleX,
    circleY,
    radius,
  ) !== null
}

function firstIslandIntersectionTime(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  bulletRadius: number,
  islands: readonly IslandState[],
): number | null {
  let firstHit: number | null = null
  for (const island of islands) {
    const entryTime = segmentCircleEntryTime(
      startX,
      startY,
      endX,
      endY,
      island.x,
      island.y,
      island.radius + bulletRadius,
    )
    if (entryTime !== null && (firstHit === null || entryTime < firstHit)) {
      firstHit = entryTime
    }
  }
  return firstHit
}

function cloneBalance(balance: GameBalanceConfig): GameBalanceConfig {
  return {
    ...balance,
    arena: {
      ...balance.arena,
      islands: balance.arena.islands.map((island) => ({ ...island })),
    },
    player: { ...balance.player },
    weapons: {
      frontal: { ...balance.weapons.frontal },
      broadside: { ...balance.weapons.broadside },
    },
    enemies: {
      chaser: { ...balance.enemies.chaser },
      shooter: {
        ...balance.enemies.shooter,
        projectile: { ...balance.enemies.shooter.projectile },
      },
    },
    spawning: {
      ...balance.spawning,
      enemySpawnSequence: [
        balance.spawning.enemySpawnSequence[0],
        balance.spawning.enemySpawnSequence[1],
      ],
    },
    scoring: { ...balance.scoring },
  }
}

export function createGameState(
  config: GameplayConfig,
  balance: GameBalanceConfig = DEFAULT_GAME_BALANCE,
  random: () => number = Math.random,
): GameState {
  const balanceSnapshot = cloneBalance(balance)
  const configSnapshot = { ...config }

  return {
    width: balanceSnapshot.arena.width,
    height: balanceSnapshot.arena.height,
    config: configSnapshot,
    balance: balanceSnapshot,
    random,
    player: {
      x: 130,
      y: balanceSnapshot.arena.height / 2,
      radius: balanceSnapshot.player.radius,
      angle: 0,
      speed: balanceSnapshot.player.movementSpeed,
      health: configSnapshot.playerLives,
      maxHealth: configSnapshot.playerLives,
      fireCooldown: 0,
      secondaryFireCooldown: 0,
      invulnerable: 0,
    },
    enemies: [],
    bullets: [],
    islands: balanceSnapshot.arena.islands,
    score: 0,
    timeLeft: configSnapshot.sessionTime,
    running: true,
    paused: false,
    reason: null,
    spawnCooldown: balanceSnapshot.spawning.initialDelay,
    spawnCount: 0,
    nextEntityId: 0,
  }
}

export function updateGameState(state: GameState, input: InputState, dt: number): GameState {
  if (!state.running || state.paused || !Number.isFinite(dt) || dt <= 0) {
    return state
  }

  if (state.player.health <= 0) {
    state.player.health = 0
    state.running = false
    state.reason = 'defeat'
    return state
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt)
  if (state.timeLeft <= 0) {
    state.running = false
    state.reason = 'time'
    return state
  }

  const player = state.player
  const balance = state.balance
  const playerBalance = balance.player
  player.angle += (Number(input.right) - Number(input.left)) * playerBalance.rotationSpeed * dt
  state.enemies = state.enemies.filter((enemy) => enemy.active && enemy.health > 0)

  if (player.invulnerable > 0) {
    player.invulnerable = Math.max(0, player.invulnerable - dt)
  }

  const moveDirection = Number(input.up) - Number(input.down) * playerBalance.reverseSpeedMultiplier
  const playerBoundary = Math.max(playerBalance.radius, balance.arena.playerBoundaryPadding)
  moveShip(
    player,
    Math.cos(player.angle) * moveDirection * player.speed * dt,
    Math.sin(player.angle) * moveDirection * player.speed * dt,
    state,
    playerBoundary,
  )

  player.fireCooldown = Math.max(0, player.fireCooldown - dt)
  player.secondaryFireCooldown = Math.max(0, player.secondaryFireCooldown - dt)

  if (input.shoot && player.fireCooldown <= 0) {
    const weapon = balance.weapons.frontal
    const muzzleDistance = player.radius + weapon.muzzleOffset
    state.bullets.push(createBullet(
      `bullet-${state.nextEntityId++}`,
      player.x + Math.cos(player.angle) * muzzleDistance,
      player.y + Math.sin(player.angle) * muzzleDistance,
      player.angle,
      weapon,
      'player',
    ))
    player.fireCooldown = weapon.cooldown
  }

  if ((input.leftShot || input.rightShot) && player.secondaryFireCooldown <= 0) {
    const weapon = balance.weapons.broadside
    const direction = input.leftShot ? -1 : 1
    const shotAngle = player.angle + direction * (Math.PI / 2)
    const muzzleDistance = player.radius + weapon.muzzleOffset
    const forwardX = Math.cos(player.angle)
    const forwardY = Math.sin(player.angle)

    for (const offset of [-weapon.spreadDistance, 0, weapon.spreadDistance]) {
      state.bullets.push(createBullet(
        `bullet-${state.nextEntityId++}`,
        player.x + Math.cos(shotAngle) * muzzleDistance + forwardX * offset,
        player.y + Math.sin(shotAngle) * muzzleDistance + forwardY * offset,
        shotAngle,
        weapon,
        'player',
      ))
    }

    player.secondaryFireCooldown = weapon.cooldown
  }

  state.spawnCooldown -= dt
  if (state.spawnCooldown <= 0) {
    const kind = balance.spawning.enemySpawnSequence[
      state.spawnCount % balance.spawning.enemySpawnSequence.length
    ]
    const enemyBalance = balance.enemies[kind]
    const margin = Math.max(balance.spawning.edgeMargin, enemyBalance.radius)
    const safeX = Math.max(enemyBalance.radius, balance.arena.enemyBoundaryPadding)
    const safeY = Math.max(enemyBalance.radius, balance.arena.enemyBoundaryPadding)
    let spawn: { x: number; y: number } | null = null

    for (let attempt = 0; attempt < balance.spawning.maxAttempts; attempt += 1) {
      const edge = Math.floor(clamp(state.random(), 0, 0.999999) * 4)
      const horizontal = safeX + state.random() * Math.max(0, state.width - safeX * 2)
      const vertical = safeY + state.random() * Math.max(0, state.height - safeY * 2)
      const candidate = edge === 0
        ? { x: horizontal, y: margin }
        : edge === 1
          ? { x: state.width - margin, y: vertical }
          : edge === 2
            ? { x: horizontal, y: state.height - margin }
            : { x: margin, y: vertical }
      const isFarEnoughFromPlayer = distanceBetween(
        candidate.x,
        candidate.y,
        player.x,
        player.y,
      ) >= balance.spawning.playerSafeDistance + player.radius + enemyBalance.radius
      const isClearOfIslands = !overlapsIsland(
        candidate.x,
        candidate.y,
        enemyBalance.radius,
        state.islands,
        balance.spawning.islandClearance,
      )
      const isClearOfShips = state.enemies.every((enemy) => (
        distanceBetween(candidate.x, candidate.y, enemy.x, enemy.y)
        >= enemyBalance.radius + enemy.radius + balance.spawning.islandClearance
      ))

      if (isFarEnoughFromPlayer && isClearOfIslands && isClearOfShips) {
        spawn = candidate
        break
      }
    }

    if (spawn) {
      state.enemies.push(createEnemy(state, kind, spawn))
      state.spawnCount += 1
    }

    state.spawnCooldown = state.config.spawnInterval
  }

  for (const enemy of state.enemies) {
    if (!enemy.active) {
      continue
    }

    const enemyBalance = balance.enemies[enemy.kind]
    enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt)

    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const desiredAngle = Math.atan2(dy, dx)
    enemy.angle = rotateTowards(enemy.angle, desiredAngle, enemyBalance.rotationSpeed * dt)
    const previousEnemyX = enemy.x
    const previousEnemyY = enemy.y

    if (enemy.kind === 'chaser') {
      const travel = enemy.speed * dt
      moveShip(
        enemy,
        Math.cos(enemy.angle) * travel,
        Math.sin(enemy.angle) * travel,
        state,
        Math.max(enemy.radius, balance.arena.enemyBoundaryPadding),
      )
    } else {
      const shooterBalance = balance.enemies.shooter
      const distance = Math.hypot(dx, dy)
      let movement = 0
      if (distance > shooterBalance.approachDistance) {
        movement = enemy.speed * dt
      } else if (distance < shooterBalance.retreatDistance) {
        movement = -enemy.speed * shooterBalance.retreatSpeedMultiplier * dt
      }

      moveShip(
        enemy,
        Math.cos(enemy.angle) * movement,
        Math.sin(enemy.angle) * movement,
        state,
        Math.max(enemy.radius, balance.arena.enemyBoundaryPadding),
      )

      if (distance < shooterBalance.attackRange && enemy.fireCooldown <= 0) {
        const projectile = shooterBalance.projectile
        const muzzleDistance = enemy.radius + projectile.muzzleOffset
        state.bullets.push(createBullet(
          `bullet-${state.nextEntityId++}`,
          enemy.x + Math.cos(enemy.angle) * muzzleDistance,
          enemy.y + Math.sin(enemy.angle) * muzzleDistance,
          enemy.angle,
          projectile,
          'enemy',
        ))
        enemy.fireCooldown = shooterBalance.fireCooldown
      }
    }

    const toPlayer = distanceBetween(enemy.x, enemy.y, player.x, player.y)
    const chaserHitPlayer = enemy.kind === 'chaser' && (
      segmentIntersectsCircle(
        previousEnemyX,
        previousEnemyY,
        enemy.x,
        enemy.y,
        player.x,
        player.y,
        enemy.radius + player.radius,
      )
    )
    if (chaserHitPlayer || (enemy.kind === 'chaser' && toPlayer < enemy.radius + player.radius)) {
      if (player.invulnerable <= 0) {
        player.health -= balance.enemies.chaser.contactDamage
        player.invulnerable = playerBalance.collisionInvulnerability
      }
      enemy.active = false
      if (player.health <= 0) {
        player.health = 0
        state.enemies = state.enemies.filter((activeEnemy) => activeEnemy.active && activeEnemy.health > 0)
        state.bullets = []
        state.running = false
        state.reason = 'defeat'
        return state
      }
    }
  }

  state.enemies = state.enemies.filter((enemy) => enemy.active && enemy.health > 0)
  if (player.health <= 0) {
    state.bullets = []
    state.running = false
    state.reason = 'defeat'
    player.health = 0
    return state
  }

  const remainingBullets: BulletState[] = []
  for (const bullet of state.bullets) {
    if (bullet.ttl <= 0) {
      continue
    }

    const startX = bullet.x
    const startY = bullet.y
    const travelTime = Math.min(dt, bullet.ttl)
    const nextX = startX + bullet.vx * travelTime
    const nextY = startY + bullet.vy * travelTime
    bullet.ttl -= dt

    const islandHitTime = firstIslandIntersectionTime(
      startX,
      startY,
      nextX,
      nextY,
      bullet.radius,
      state.islands,
    )
    let targetHitTime: number | null = null
    let hitEnemy: EnemyState | null = null

    if (bullet.owner === 'player') {
      for (const enemy of state.enemies) {
        if (enemy.active) {
          const enemyHitTime = segmentCircleEntryTime(
            startX,
            startY,
            nextX,
            nextY,
            enemy.x,
            enemy.y,
            bullet.radius + enemy.radius,
          )
          if (enemyHitTime !== null && (targetHitTime === null || enemyHitTime < targetHitTime)) {
            targetHitTime = enemyHitTime
            hitEnemy = enemy
          }
        }
      }
    } else {
      targetHitTime = segmentCircleEntryTime(
        startX,
        startY,
        nextX,
        nextY,
        player.x,
        player.y,
        bullet.radius + player.radius,
      )
    }

    if (islandHitTime !== null && (targetHitTime === null || islandHitTime <= targetHitTime)) {
      continue
    }

    const hitTarget = targetHitTime !== null
    if (hitEnemy) {
      hitEnemy.health -= bullet.damage
      if (hitEnemy.health <= 0) {
        state.score += balance.scoring.pointsPerEnemy
        hitEnemy.active = false
      }
    } else if (bullet.owner === 'enemy' && hitTarget) {
      if (player.invulnerable <= 0) {
        player.health -= bullet.damage
        player.invulnerable = playerBalance.projectileInvulnerability
      }
    }

    if (player.health <= 0) {
      player.health = 0
      state.bullets = []
      state.running = false
      state.reason = 'defeat'
      return state
    }

    const projectileIsOutsideArena = (
      nextX < -balance.arena.projectileBoundaryPadding
      || nextX > state.width + balance.arena.projectileBoundaryPadding
      || nextY < -balance.arena.projectileBoundaryPadding
      || nextY > state.height + balance.arena.projectileBoundaryPadding
    )
    if (!hitTarget && bullet.ttl > 0 && !projectileIsOutsideArena) {
      bullet.x = nextX
      bullet.y = nextY
      remainingBullets.push(bullet)
    }
  }

  state.bullets = remainingBullets
  state.enemies = state.enemies.filter((enemy) => enemy.active && enemy.health > 0)

  return state
}
