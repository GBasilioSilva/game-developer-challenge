import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { createMatchRecord, getLeaderboard, getMatchHistory } from './api/client'
import { DEFAULT_CONFIG, loadGameplayConfig, normalizeGameplayConfig, saveGameplayConfig } from './config'

// Implementação da Seção 3, 5 e 7: shell da interface, telas de menu/opções/resultados, consultas de ranking/histórico e acessibilidade básica.
import { resetMockState, saveMockScenario, type MockScenario } from './mocks/handlers'
import logoJungle from './assets/logo_jungle_gaming-DJ6LxWQy.svg'
import sceneBackground from './assets/ui_scene_background-DaVheB5U.png'
import type { GameplayConfig, LeaderboardEntry, MatchHistoryEntry, MatchReason } from './types/game'
import './App.css'

const LAST_RESULT_KEY = 'naval-shooter:last-result'
const PENDING_MATCH_KEY = 'naval-shooter:pending-match'

type LastMatchResult = {
  score: number
  reason: MatchReason
  duration: number
  recordedAt: string
}

type PendingMatch = {
  payload: {
    playerName: string
    score: number
    duration: number
    reason: MatchReason
    configuration: GameplayConfig
  }
  savedAt: string
}

const GameCanvas = lazy(async () => {
  const module = await import('./game/GameCanvas')
  return { default: module.GameCanvas }
})

type HudState = {
  score: number
  lives: number
  timeLeft: number
}

const PANEL_PAGE_SIZE = 5

function App() {
  const queryClient = useQueryClient()
  const [screen, setScreen] = useState<'menu' | 'game' | 'results' | 'options'>('menu')
  const [score, setScore] = useState(0)
  const [matchReason, setMatchReason] = useState<MatchReason>('time')
  const [matchDuration, setMatchDuration] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)
  const [menuTab, setMenuTab] = useState<'ranking' | 'history'>('ranking')
  const [rankingPage, setRankingPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [config, setConfig] = useState<GameplayConfig>(() => loadGameplayConfig())
  const [draftConfig, setDraftConfig] = useState<GameplayConfig>(() => loadGameplayConfig())
  const [lastResult, setLastResult] = useState<LastMatchResult | null>(() => {
    const stored = window.localStorage.getItem(LAST_RESULT_KEY)
    if (!stored) {
      return null
    }

    try {
      const parsed = JSON.parse(stored) as LastMatchResult
      return parsed && typeof parsed.score === 'number' ? parsed : null
    } catch {
      return null
    }
  })
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(() => {
    const stored = window.localStorage.getItem(PENDING_MATCH_KEY)
    if (!stored) {
      return null
    }

    try {
      const parsed = JSON.parse(stored) as PendingMatch
      return parsed && typeof parsed.payload?.score === 'number' ? parsed : null
    } catch {
      return null
    }
  })
  const [mockScenario, setMockScenario] = useState<MockScenario>(() => {
    const stored = window.localStorage.getItem('naval-shooter:mock-scenario') as MockScenario | null
    return stored && [
      'normal',
      'slow',
      'timeout',
      'commit-timeout',
      'empty',
      'out-of-order',
      'ranking-error',
      'history-error',
    ].includes(stored)
      ? stored
      : 'normal'
  })
  const [hud, setHud] = useState<HudState>({ score: 0, lives: config.playerLives, timeLeft: config.sessionTime })
  const pendingMatchAtStartupRef = useRef(pendingMatch)

  // Implementação da Seção 3 - Estado da interface e a persistência das opções do jogador.
  useEffect(() => {
    saveMockScenario(mockScenario)
  }, [mockScenario])

  useEffect(() => {
    if (lastResult) {
      window.localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(lastResult))
    } else {
      window.localStorage.removeItem(LAST_RESULT_KEY)
    }
  }, [lastResult])

  useEffect(() => {
    if (pendingMatch) {
      window.localStorage.setItem(PENDING_MATCH_KEY, JSON.stringify(pendingMatch))
    } else {
      window.localStorage.removeItem(PENDING_MATCH_KEY)
    }
  }, [pendingMatch])

  const {
    data: ranking,
    isLoading: rankingLoading,
    isError: rankingError,
    refetch: refetchRanking,
  } = useQuery({
    queryKey: ['ranking'],
    queryFn: getLeaderboard,
    staleTime: 10000,
  })

  const {
    data: history,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['history'],
    queryFn: getMatchHistory,
    staleTime: 10000,
  })

  const rankingList = Array.isArray(ranking) ? ranking : []
  const historyList = Array.isArray(history) ? history : []
  const rankingPageCount = Math.max(1, Math.ceil(rankingList.length / PANEL_PAGE_SIZE))
  const historyPageCount = Math.max(1, Math.ceil(historyList.length / PANEL_PAGE_SIZE))
  const visibleRanking = rankingList.slice((rankingPage - 1) * PANEL_PAGE_SIZE, rankingPage * PANEL_PAGE_SIZE)
  const visibleHistory = historyList.slice((historyPage - 1) * PANEL_PAGE_SIZE, historyPage * PANEL_PAGE_SIZE)

  const submitMatch = useMutation({
    mutationFn: createMatchRecord,
    onSuccess: async (record, variables) => {
      setPendingMatch(null)
      await queryClient.cancelQueries({ queryKey: ['ranking'] })
      await queryClient.cancelQueries({ queryKey: ['history'] })
      queryClient.setQueryData<LeaderboardEntry[]>(['ranking'], (current) => {
        const entries = current?.filter((entry) => entry.id !== record.id) ?? []
        return [...entries, record]
          .sort((left, right) => right.score - left.score || right.recordedAt.localeCompare(left.recordedAt))
          .slice(0, 10)
      })
      queryClient.setQueryData<MatchHistoryEntry[]>(['history'], (current) => [
        record,
        ...(current?.filter((entry) => entry.id !== record.id) ?? []),
      ])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ranking'] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
      ])
      if (variables?.playerName) {
        setLastResult((current) => current ?? {
          score: variables.score,
          reason: variables.reason,
          duration: variables.duration,
          recordedAt: new Date().toISOString(),
        })
      }
    },
    onError: async (_error, variables) => {
      const nextPending: PendingMatch = {
        payload: variables,
        savedAt: new Date().toISOString(),
      }
      setPendingMatch(nextPending)
    },
  })

  useEffect(() => {
    const initialPendingMatch = pendingMatchAtStartupRef.current
    if (initialPendingMatch) {
      pendingMatchAtStartupRef.current = null
      submitMatch.mutate(initialPendingMatch.payload)
    }
  }, [submitMatch])

  // Implementação da Seção 5: finalização da partida e persistência do resultado no ranking/histórico.
  const retryPendingSubmission = useCallback(() => {
    if (!pendingMatch) {
      return
    }

    submitMatch.mutate(pendingMatch.payload)
  }, [pendingMatch, submitMatch])

  const handleGameOver = useCallback(async (finalScore: number, reason: MatchReason, duration: number) => {
    const nextResult = {
      score: finalScore,
      reason,
      duration,
      recordedAt: new Date().toISOString(),
    }

    setScore(finalScore)
    setMatchReason(reason)
    setMatchDuration(duration)
    setLastResult(nextResult)

    const payload = {
      playerName: 'Captain Nox',
      score: finalScore,
      duration,
      reason,
      configuration: config,
    }

    setPendingMatch({
      payload,
      savedAt: new Date().toISOString(),
    })

    submitMatch.mutate(payload)
    setScreen('results')
  }, [config, submitMatch])

  const handleHudChange = useCallback((nextHud: HudState) => {
    setHud((current) => {
      if (current.score === nextHud.score && current.lives === nextHud.lives && current.timeLeft === nextHud.timeLeft) {
        return current
      }
      return nextHud
    })
  }, [])

  const handleConfigChange = (key: keyof GameplayConfig, value: string) => {
    const numericValue = Number(value)

    setDraftConfig((current) =>
      normalizeGameplayConfig({
        ...current,
        [key]: Number.isFinite(numericValue) ? numericValue : DEFAULT_CONFIG[key],
      }),
    )
  }

  const handleSaveConfig = () => {
    const normalized = saveGameplayConfig(normalizeGameplayConfig(draftConfig))
    setConfig(normalized)
    setHud((current) => ({ ...current, lives: normalized.playerLives, timeLeft: normalized.sessionTime }))
    setScreen('menu')
  }

  const startBattle = () => {
    setScore(0)
    setMatchReason('time')
    setMatchDuration(0)
    setHud({ score: 0, lives: config.playerLives, timeLeft: config.sessionTime })
    setSessionKey((current) => current + 1)
    setScreen('game')
  }

  //Seção 5 e Seção 7: painéis de ranking, histórico e formulário de configuração.
  const renderTopPanels = () => (
    <div className="top-grid">
      <section className="panel panel-tabs">
        <div className="tab-header" role="tablist" aria-label="Ranking and match history tabs">
          <button type="button" role="tab" aria-selected={menuTab === 'ranking'} aria-controls="ranking-panel" id="ranking-tab" className={menuTab === 'ranking' ? 'tab-button active' : 'tab-button'} onClick={() => setMenuTab('ranking')}>
            Ranking
          </button>
          <button type="button" role="tab" aria-selected={menuTab === 'history'} aria-controls="history-panel" id="history-tab" className={menuTab === 'history' ? 'tab-button active' : 'tab-button'} onClick={() => setMenuTab('history')}>
            Histórico de partidas
          </button>
        </div>

        {menuTab === 'ranking' ? (
          <div id="ranking-panel" role="tabpanel" aria-labelledby="ranking-tab" aria-live="polite">
            <button type="button" className="secondary-button" onClick={() => void refetchRanking()}>
              Atualizar ranking
            </button>
            {rankingLoading ? <p>Carregando…</p> : null}
            {rankingError ? <p>Ranking indisponível.</p> : null}
            {!rankingLoading && !rankingError ? (
              <>
                {visibleRanking.length ? (
                  <ol className="list">
                    {visibleRanking.map((entry, index) => (
                      <li key={entry.id}>
                        <span>#{(rankingPage - 1) * PANEL_PAGE_SIZE + index + 1}</span>
                        <strong>{entry.playerName}</strong>
                        <span>{entry.score}</span>
                      </li>
                    ))}
                  </ol>
                ) : <p>Nenhum registro de ranking ainda.</p>}
                <div className="panel-pagination" aria-label="Paginação do ranking">
                  <button type="button" className="secondary-button" disabled={rankingPage === 1} onClick={() => setRankingPage((page) => Math.max(1, page - 1))}>Página anterior</button>
                  <span>Página {rankingPage} de {rankingPageCount}</span>
                  <button type="button" className="secondary-button" disabled={rankingPage >= rankingPageCount} onClick={() => setRankingPage((page) => Math.min(rankingPageCount, page + 1))}>Próxima página</button>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div id="history-panel" role="tabpanel" aria-labelledby="history-tab" aria-live="polite">
            <button type="button" className="secondary-button" onClick={() => void refetchHistory()}>
              Atualizar histórico de partidas
            </button>
            {historyLoading ? <p>Carregando…</p> : null}
            {historyError ? <p>Histórico indisponível.</p> : null}
            {!historyLoading && !historyError ? (
              <>
                {visibleHistory.length ? (
                  <ol className="list">
                    {visibleHistory.map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.reason}</span>
                        <strong>{entry.score}</strong>
                        <span>{new Date(entry.recordedAt).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ol>
                ) : <p>Nenhuma partida registrada ainda.</p>}
                <div className="panel-pagination" aria-label="Paginação do histórico de partidas">
                  <button type="button" className="secondary-button" disabled={historyPage === 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>Página anterior</button>
                  <span>Página {historyPage} de {historyPageCount}</span>
                  <button type="button" className="secondary-button" disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}>Próxima página</button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )

  return (
    <div
      className="app-shell"
      style={{
        backgroundImage: `radial-gradient(circle at top, rgba(62, 141, 200, 0.2), transparent 30%), linear-gradient(180deg, rgba(7,27,45,0.9), rgba(11,29,45,0.98)), url(${sceneBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <header className="topbar">
        <div className="brand-block">
          <img src={logoJungle} alt="Jungle Gaming logo" className="brand-mark" />
          <div>
            <p className="brand">Batalha Naval!</p>
            <span className="subtitle">Feita com React + TypeScript + PixiJS</span>
          </div>
        </div>
        <nav className="topbar-actions" aria-label="Main navigation">
          <button type="button" aria-label="Open main menu" className="secondary-button" onClick={() => setScreen('menu')}>
            Menu
          </button>
          <button type="button" aria-label="Open gameplay options" className="secondary-button" onClick={() => {
            setDraftConfig(config)
            setScreen('options')
          }}>
            Opções
          </button>
          <button type="button" aria-label="Start a new battle" className="primary-button" onClick={startBattle}>
            Jogar
          </button>
        </nav>
      </header>

      {screen === 'menu' ? (
        <main className="menu-layout">
          <section className="hero-panel panel">
            <span className="eyebrow">Missão: Patrulhamento Costeiro</span>         
            <div className="hero-meta">
              <span className="status-pill">Pronto para combate</span>
            </div>
            <h1>Defenda a costa e sobreviva ao ataque</h1>
            <p>
              Navegue por águas rasas, intercepte navios inimigos e proteja a frota enquanto a pontuação aumenta! 
              Use suas habilidades de navegação e mira para se manter vivo e alcançar a maior pontuação possível antes que o tempo acabe!
            </p>
            <div className="control-hint" aria-label="Keyboard controls">
              <span className="control-chip">W / ↑ cima</span>
              <span className="control-chip">A / D rotacionar</span>
              <span className="control-chip">Espaço / Atirar</span>
              <span className="control-chip">Q / E Explosão de Velocidade</span>
            </div>
            <div className="action-row">
              <button type="button" aria-label="Start a new battle" className="primary-button" onClick={startBattle}>
                Começar Batalha
              </button>
              <button type="button" aria-label="Open gameplay options" className="secondary-button" onClick={() => {
                setDraftConfig(config)
                setScreen('options')
              }}>
                Opções de jogo  
              </button>
              <button type="button" aria-label="View previous battle result" className="secondary-button" onClick={() => {
                if (lastResult) {
                  setScore(lastResult.score)
                  setMatchReason(lastResult.reason)
                  setMatchDuration(lastResult.duration)
                }
                setScreen('results')
              }}>
                Ver resultado
              </button>
            </div>
          </section>

          {renderTopPanels()}
        </main>
      ) : null}

      {screen === 'game' ? (
        <main className="game-layout">
          <div
            className="hud-panel panel"
            role="status"
            aria-live="polite"
            aria-label={`Score ${hud.score}, lives ${hud.lives}, time remaining ${Math.ceil(hud.timeLeft)} seconds`}
          >
            <span>Pontuação: {hud.score}</span>
            <span>Vidas: {hud.lives}</span>
            <span>Tempo: {Math.ceil(hud.timeLeft)}s</span>
          </div>
          <Suspense fallback={<div className="game-area loading-area">Carregando Arena…</div>}>
            <GameCanvas
              key={sessionKey}
              config={config}
              onGameOver={handleGameOver}
              onHudChange={handleHudChange}
            />
          </Suspense>
        </main>
      ) : null}

      {screen === 'options' ? (
        <main className="options-layout panel">
          <span className="eyebrow">Opções</span>
          <h2>Configurações da partida</h2>
          <div className="options-grid">
            <label>
              <span>Tempo da partida(segundos)</span>
              <input
                aria-label="Session time in seconds"
                type="number"
                min={60}
                max={180}
                step={5}
                value={draftConfig.sessionTime}
                onChange={(event) => handleConfigChange('sessionTime', event.target.value)}
              />
            </label>
            <label>
              <span>Intervalo de geração de inimigos (segundos)</span>
              <input
                aria-label="Enemy spawn interval in seconds"
                type="number"
                min={1}
                max={20}
                step={1}
                value={draftConfig.spawnInterval}
                onChange={(event) => handleConfigChange('spawnInterval', event.target.value)}
              />
            </label>
            <label>
              <span>Vidas do Jogador</span>
              <input
                aria-label="Player lives"
                type="number"
                min={1}
                max={5}
                step={1}
                value={draftConfig.playerLives}
                onChange={(event) => handleConfigChange('playerLives', event.target.value)}
              />
            </label>
            <label>
              <span>Cenário de rede simulada</span>
              <select
                aria-label="Mock network scenario"
                value={mockScenario}
                onChange={(event) => setMockScenario(event.target.value as MockScenario)}
              >
                <option value="normal">Normal</option>
                <option value="slow">Resposta lenta</option>
                <option value="timeout">Tempo esgotado</option>
                <option value="commit-timeout">Confirmar, depois aguardar o tempo limite</option>
                <option value="empty">Listas vazias</option>
                <option value="out-of-order">Resposta fora de ordem</option>
                <option value="ranking-error">Erro de Ranking</option>
                <option value="history-error">Erro de Histórico</option>
              </select>
            </label>
          </div>
          <div className="action-row">
            <button type="button" className="primary-button" onClick={handleSaveConfig}>
              Salvar Alterações
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                resetMockState()
                setMockScenario('normal')
                saveMockScenario('normal')
              }}
            >
              Redefinir
            </button>
            <button type="button" className="secondary-button" onClick={() => setScreen('menu')}>
              Cancelar
            </button>
          </div>
        </main>
      ) : null}

      {screen === 'results' ? (
        <main className="results-layout panel">
          <span className="eyebrow">Resultado</span>
          <h2>Pontuação final: {score}</h2>
          <p>
            <strong>Motivo:</strong> {matchReason === 'time' ? 'Tempo esgotado' : 'Derrota'}
          </p>
          <p>
            <strong>Duração:</strong> {matchDuration}s
          </p>
          <p>
            <strong>Último salvamento:</strong> {lastResult ? new Date(lastResult.recordedAt).toLocaleString() : 'Not available'}
          </p>
          <p>
            {pendingMatch && !submitMatch.isSuccess
              ? 'O envio está pendente e será tentado novamente caso a rede se restabeleça'
              : submitMatch.isPending
                ? 'Submetendo ao ranking e ao histórico…'
                : submitMatch.isSuccess
                  ? 'A partida foi registrada na API simulada'
                  : 'A partida ainda não pôde ser enviada na API simulada'}
          </p>
          <div className="action-row">
            {pendingMatch ? (
              <button type="button" className="secondary-button" onClick={retryPendingSubmission}>
                Tentar sincronizar novamente
              </button>
            ) : null}
            <button type="button" className="primary-button" onClick={startBattle}>
              Jogar novamente
            </button>
            <button type="button" className="secondary-button" onClick={() => setScreen('menu')}>
              Voltar ao menu
            </button>
          </div>
        </main>
      ) : null}
    </div>
  )
}

export default App
