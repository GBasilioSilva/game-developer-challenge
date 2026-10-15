interface Window {
  __NAVAL_GAME_TEST__?: {
    advance: (milliseconds: number) => void
    inspect: () => {
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
    placeEnemy: (
      kind: 'chaser' | 'shooter',
      x: number,
      y: number,
      options?: { health?: number; speed?: number; fireCooldown?: number; angle?: number },
    ) => string
    setPlayerPosition: (x: number, y: number, angle?: number) => void
    setPlayerHealth: (health: number) => void
    suppressSpawns: () => void
  }
}
