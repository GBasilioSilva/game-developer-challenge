import { describe, expect, it } from 'vitest'
import type { CreateMatchPayload } from '../types/game'
import { buildMatchSignature } from './handlers'

describe('match record deduplication', () => {
  it('creates a stable signature for equivalent match payloads', () => {
    const payloadA: CreateMatchPayload = {
      playerName: 'Captain Nox',
      score: 120,
      duration: 90,
      reason: 'time',
      configuration: {
        sessionTime: 240,
        spawnInterval: 6,
        playerLives: 3,
      },
    }

    const payloadB: CreateMatchPayload = {
      playerName: 'Captain Nox',
      score: 120,
      duration: 90,
      reason: 'time',
      configuration: {
        sessionTime: 240,
        spawnInterval: 6,
        playerLives: 3,
      },
    }

    expect(buildMatchSignature(payloadA)).toBe(buildMatchSignature(payloadB))
  })
})
