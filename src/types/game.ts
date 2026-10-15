// Implementação da Seção 1, 2 e 5: contratos compartilhados da configuração, do ranking e do histórico.
export type MatchReason = 'time' | 'defeat'

export interface GameplayConfig {
  sessionTime: number
  spawnInterval: number
  playerLives: number
}

export interface IslandConfig {
  x: number
  y: number
  radius: number
}

export interface ProjectileConfig {
  damage: number
  speed: number
  lifetime: number
  radius: number
  muzzleOffset: number
}

export type EnemyType = 'chaser' | 'shooter'

export interface GameBalanceConfig {
  arena: {
    width: number
    height: number
    playerBoundaryPadding: number
    enemyBoundaryPadding: number
    projectileBoundaryPadding: number
    islands: IslandConfig[]
  }
  player: {
    radius: number
    movementSpeed: number
    reverseSpeedMultiplier: number
    rotationSpeed: number
    collisionInvulnerability: number
    projectileInvulnerability: number
  }
  weapons: {
    frontal: ProjectileConfig & {
      cooldown: number
    }
    broadside: ProjectileConfig & {
      cooldown: number
      spreadDistance: number
    }
  }
  enemies: {
    chaser: {
      radius: number
      speed: number
      rotationSpeed: number
      health: number
      contactDamage: number
    }
    shooter: {
      radius: number
      speed: number
      rotationSpeed: number
      health: number
      approachDistance: number
      retreatDistance: number
      retreatSpeedMultiplier: number
      attackRange: number
      fireCooldown: number
      projectile: ProjectileConfig
    }
  }
  spawning: {
    initialDelay: number
    edgeMargin: number
    islandClearance: number
    playerSafeDistance: number
    maxAttempts: number
    enemySpawnSequence: [EnemyType, EnemyType]
  }
  scoring: {
    pointsPerEnemy: 1
  }
}

export interface LeaderboardEntry {
  id: string
  playerName: string
  score: number
  duration: number
  reason: MatchReason
  recordedAt: string
  configuration: GameplayConfig
}

export interface MatchHistoryEntry extends LeaderboardEntry {
  status: 'completed' | 'pending'
}

export interface CreateMatchPayload {
  playerName: string
  score: number
  duration: number
  reason: MatchReason
  configuration: GameplayConfig
}
