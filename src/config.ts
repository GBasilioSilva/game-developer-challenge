import type { GameBalanceConfig, GameplayConfig } from './types/game'

// Implementação da Seção 2 e Seção 3: configuração do gameplay e persistência local das opções do jogador.
export const DEFAULT_CONFIG: GameplayConfig = {
  sessionTime: 120,
  spawnInterval: 6,
  playerLives: 3,
}

export const DEFAULT_GAME_BALANCE: GameBalanceConfig = {
  arena: {
    width: 960,
    height: 540,
    playerBoundaryPadding: 26,
    enemyBoundaryPadding: 12,
    projectileBoundaryPadding: 20,
    islands: [
      { x: 260, y: 180, radius: 64 },
      { x: 640, y: 150, radius: 62 },
      { x: 700, y: 360, radius: 68 },
      { x: 360, y: 420, radius: 54 },
    ],
  },
  player: {
    radius: 18,
    movementSpeed: 230,
    reverseSpeedMultiplier: 0.6,
    rotationSpeed: 2.2,
    collisionInvulnerability: 1,
    projectileInvulnerability: 0.7,
  },
  weapons: {
    frontal: {
      damage: 1,
      speed: 500,
      lifetime: 1.8,
      radius: 4,
      muzzleOffset: 10,
      cooldown: 0.22,
    },
    broadside: {
      damage: 1,
      speed: 540,
      lifetime: 1.8,
      radius: 4,
      muzzleOffset: 10,
      cooldown: 0.45,
      spreadDistance: 8,
    },
  },
  enemies: {
    chaser: {
      radius: 18,
      speed: 90,
      rotationSpeed: 2.8,
      health: 2,
      contactDamage: 1,
    },
    shooter: {
      radius: 16,
      speed: 70,
      rotationSpeed: 2.4,
      health: 1,
      approachDistance: 230,
      retreatDistance: 160,
      retreatSpeedMultiplier: 0.5,
      attackRange: 260,
      fireCooldown: 1.8,
      projectile: {
        damage: 1,
        speed: 310,
        lifetime: 2.6,
        radius: 5,
        muzzleOffset: 10,
      },
    },
  },
  spawning: {
    initialDelay: 2,
    edgeMargin: 32,
    islandClearance: 20,
    playerSafeDistance: 200,
    maxAttempts: 24,
    enemySpawnSequence: ['chaser', 'shooter'],
  },
  scoring: {
    pointsPerEnemy: 1,
  },
}

const STORAGE_KEY = 'naval-shooter-config'

export function normalizeGameplayConfig(input?: Partial<GameplayConfig> | null): GameplayConfig {
  const base = { ...DEFAULT_CONFIG }

  const sessionTime = Number(input?.sessionTime ?? base.sessionTime)
  const spawnInterval = Number(input?.spawnInterval ?? base.spawnInterval)
  const playerLives = Number(input?.playerLives ?? base.playerLives)

  return {
    sessionTime: Number.isFinite(sessionTime) ? Math.min(Math.max(Math.round(sessionTime), 60), 180) : base.sessionTime,
    spawnInterval: Number.isFinite(spawnInterval) ? Math.min(Math.max(Math.round(spawnInterval), 1), 20) : base.spawnInterval,
    playerLives: Number.isFinite(playerLives) ? Math.min(Math.max(Math.round(playerLives), 1), 5) : base.playerLives,
  }
}

export function loadGameplayConfig(): GameplayConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return DEFAULT_CONFIG
  }

  try {
    return normalizeGameplayConfig(JSON.parse(raw) as Partial<GameplayConfig>)
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveGameplayConfig(config: GameplayConfig): GameplayConfig {
  const normalized = normalizeGameplayConfig(config)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  }

  return normalized
}
