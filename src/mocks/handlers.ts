import { http, HttpResponse } from 'msw'
import type { CreateMatchPayload, GameplayConfig, LeaderboardEntry, MatchHistoryEntry } from '../types/game'

// Implementação da Seção 6: mocks do ranking e histórico com cenários de falha e latência reproduzíveis.
export type MockScenario =
  | 'normal'
  | 'slow'
  | 'timeout'
  | 'commit-timeout'
  | 'empty'
  | 'out-of-order'
  | 'ranking-error'
  | 'history-error'

const defaultConfig: GameplayConfig = {
  sessionTime: 120,
  spawnInterval: 6,
  playerLives: 3,
}

const getScenario = (): MockScenario => {
  if (typeof window === 'undefined') {
    return 'normal'
  }

  const saved = window.localStorage.getItem('naval-shooter:mock-scenario') as MockScenario | null
  return saved && [
    'normal',
    'slow',
    'timeout',
    'commit-timeout',
    'empty',
    'out-of-order',
    'ranking-error',
    'history-error',
  ].includes(saved)
    ? saved
    : 'normal'
}

const delayByScenario = async (ms: number) => {
  const scenario = getScenario()
  if (scenario === 'slow') {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}

const rankingSeed: LeaderboardEntry[] = [
  {
    id: 'rank-1',
    playerName: 'Astra',
    score: 820,
    duration: 110,
    reason: 'time',
    recordedAt: '2026-10-10T10:10:00.000Z',
    configuration: defaultConfig,
  },
  {
    id: 'rank-2',
    playerName: 'Nautilus',
    score: 760,
    duration: 96,
    reason: 'time',
    recordedAt: '2026-10-09T18:45:00.000Z',
    configuration: defaultConfig,
  },
  {
    id: 'rank-3',
    playerName: 'Harbor',
    score: 690,
    duration: 88,
    reason: 'defeat',
    recordedAt: '2026-10-08T22:15:00.000Z',
    configuration: defaultConfig,
  },
  {
    id: 'rank-4',
    playerName: 'Corsair',
    score: 640,
    duration: 84,
    reason: 'time',
    recordedAt: '2026-10-07T19:00:00.000Z',
    configuration: defaultConfig,
  },
  {
    id: 'rank-5',
    playerName: 'Mariner',
    score: 590,
    duration: 73,
    reason: 'defeat',
    recordedAt: '2026-10-06T17:30:00.000Z',
    configuration: defaultConfig,
  },
  {
    id: 'rank-6',
    playerName: 'Seafarer',
    score: 520,
    duration: 68,
    reason: 'time',
    recordedAt: '2026-10-05T11:20:00.000Z',
    configuration: defaultConfig,
  },
  {
    id: 'rank-7',
    playerName: 'Tidecaller',
    score: 480,
    duration: 62,
    reason: 'defeat',
    recordedAt: '2026-10-04T09:15:00.000Z',
    configuration: defaultConfig,
  },
]

const historySeed: MatchHistoryEntry[] = rankingSeed.map((entry) => ({
  ...entry,
  status: 'completed',
}))

const readStoredRecords = <T,>(key: string, fallback: T[]): T[] => {
  if (typeof window === 'undefined') {
    return fallback
  }

  const stored = window.localStorage.getItem(key)
  if (!stored) {
    return fallback
  }

  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as T[] : fallback
  } catch {
    return fallback
  }
}

const persistRecords = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('naval-shooter:mock-ranking', JSON.stringify(leaderboard))
    window.localStorage.setItem('naval-shooter:mock-history', JSON.stringify(history))
  }
}

let leaderboard = readStoredRecords('naval-shooter:mock-ranking', rankingSeed)
let history = readStoredRecords('naval-shooter:mock-history', historySeed)
let rankingReadCount = 0
let historyReadCount = 0

export const buildMatchSignature = (payload: CreateMatchPayload): string => {
  const configSignature = JSON.stringify({
    sessionTime: payload.configuration.sessionTime,
    spawnInterval: payload.configuration.spawnInterval,
    playerLives: payload.configuration.playerLives,
  })

  return `${payload.playerName}|${payload.score}|${payload.duration}|${payload.reason}|${configSignature}`
}

const findExistingMatchRecord = (payload: CreateMatchPayload): MatchHistoryEntry | undefined => {
  const signature = buildMatchSignature(payload)
  const combinedEntries: MatchHistoryEntry[] = [
    ...history,
    ...leaderboard.map((entry) => ({
      ...entry,
      status: 'completed' as const,
    })),
  ]

  return combinedEntries.find((entry) => {
    const entrySignature = `${entry.playerName}|${entry.score}|${entry.duration}|${entry.reason}|${JSON.stringify({
      sessionTime: entry.configuration.sessionTime,
      spawnInterval: entry.configuration.spawnInterval,
      playerLives: entry.configuration.playerLives,
    })}`

    return entrySignature === signature
  })
}

export const resetMockState = () => {
  leaderboard = [...rankingSeed]
  history = [...historySeed]
  persistRecords()
  rankingReadCount = 0
  historyReadCount = 0
}

export const saveMockScenario = (scenario: MockScenario) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('naval-shooter:mock-scenario', scenario)
  }
}

export const handlers = [
  http.get('/api/ranking', async () => {
    const scenario = getScenario()

    if (scenario === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, 6000))
    }

    if (scenario === 'ranking-error') {
      return HttpResponse.json({ message: 'Ranking unavailable.' }, { status: 500 })
    }

    if (scenario === 'empty') {
      return HttpResponse.json([])
    }

    rankingReadCount += 1
    const response = HttpResponse.json(leaderboard)
    if (scenario === 'out-of-order' && rankingReadCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 3500))
    }
    await delayByScenario(1400)
    return response
  }),

  http.get('/api/history', async () => {
    const scenario = getScenario()

    if (scenario === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, 6000))
    }

    if (scenario === 'history-error') {
      return HttpResponse.json({ message: 'History unavailable.' }, { status: 500 })
    }

    if (scenario === 'empty') {
      return HttpResponse.json([])
    }

    historyReadCount += 1
    const response = HttpResponse.json(history)
    if (scenario === 'out-of-order' && historyReadCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 3500))
    }
    await delayByScenario(1400)
    return response
  }),

  http.post('/api/history', async ({ request }) => {
    const scenario = getScenario()
    if (scenario === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, 6000))
    }

    if (scenario === 'history-error' || scenario === 'ranking-error') {
      return HttpResponse.json({ message: 'History write failed.' }, { status: 503 })
    }

    const payload = (await request.json()) as CreateMatchPayload
    const existingRecord = findExistingMatchRecord(payload)

    if (existingRecord) {
      await delayByScenario(400)
      return HttpResponse.json(existingRecord, { status: 200 })
    }

    const record: MatchHistoryEntry = {
      id: crypto.randomUUID(),
      playerName: payload.playerName,
      score: payload.score,
      duration: payload.duration,
      reason: payload.reason,
      recordedAt: new Date().toISOString(),
      configuration: payload.configuration,
      status: 'completed',
    }

    history = [record, ...history]
    leaderboard = [...leaderboard, record]
      .sort((left, right) => right.score - left.score)
      .slice(0, 10)
    persistRecords()

    if (scenario === 'commit-timeout') {
      await new Promise((resolve) => setTimeout(resolve, 6000))
    } else {
      await delayByScenario(1200)
    }
    return HttpResponse.json(record, { status: 201 })
  }),
]
