import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, normalizeGameplayConfig } from './config'

describe('game configuration', () => {
  it('normalizes unsafe values back to valid limits', () => {
    expect(
      normalizeGameplayConfig({
        sessionTime: 30,
        spawnInterval: 0,
        playerLives: 12,
      }),
    ).toEqual({
      sessionTime: 60,
      spawnInterval: 1,
      playerLives: 5,
    })
  })

  it('keeps the default config when values are missing', () => {
    expect(normalizeGameplayConfig(undefined)).toEqual(DEFAULT_CONFIG)
  })
})
