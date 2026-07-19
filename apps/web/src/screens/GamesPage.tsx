import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Square } from 'chess.js'
import { BookOpen, Check, ChevronLeft, ChevronRight, FlipHorizontal2, Settings2, SkipBack, SkipForward, Star, ThumbsUp, Trophy, X, type LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import chessComLogo from '../assets/providers/chess-com.png'
import lichessLogo from '../assets/providers/lichess.png'
import { BoardSettingsPanel } from '../components/BoardSettingsPanel'
import {
  JuCapturedPieces,
  JuChessBoard,
  type JuChessBoardChange,
} from '../components/JuChessBoard'
import { getJuChessBoardSummary, type JuCapturedPiece } from '../components/JuChessRules'
import SiteHeader from '../components/SiteHeader'
import {
  findSampleGame,
  loadTournamentGame,
  loadTournamentGameArchive,
  subscribeToTournamentGameRow,
  subscribeToVisibleGameChanges,
  type GameSource,
  type SampleGame,
} from '../lib/juchess'
import {
  analyzePosition,
  estimateGameRating,
  parseAnalysisPosition,
  parseReviewGame,
  reviewGame,
  reviewGameIdentity,
  StockfishReviewEngine,
  defaultReviewEngineStrength,
  getReviewEnginePreset,
  reviewEnginePresets,
  type GameReviewResult,
  type PositionAnalysisResult,
  type ReviewClassification,
  type ReviewEngineStrength,
  type ReviewedMove,
} from '../lib/gameReview'
import { loadExternalGamesPage } from '../lib/externalGames'
import type { AuthProfile } from '../lib/auth'
import { useAuth } from '../context/useAuth'
import { useBoardPreferences } from '../hooks/useBoardPreferences'
import { useOpeningIdentity } from '../hooks/useOpeningIdentity'
import type { JuAnnotationColor, JuBoardTheme, JuPieceTheme } from '../lib/boardAppearance'
import type { OpeningIdentity } from '../lib/openingBook'
import './ClubScreens.css'

type GameMode = 'review' | 'analysis'
type WorkspaceStep = 'source' | 'search' | 'list' | 'review' | 'workspace'

type ScopedGameReview = {
  gameIdentity: string
  result: GameReviewResult
}

type SourceDef = {
  key: GameSource
  name: string
  sub: string
  icon?: LucideIcon
  image?: string
  tone: 'green' | 'blue' | 'wine'
}

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const engineStrengthStorageKey = 'juchess.review.engineStrength'
const engineDefaultVersionKey = 'juchess.review.engineDefaultVersion'
const engineDefaultVersion = 'quick-v1'

const sourceDefs: SourceDef[] = [
  { key: 'chess.com', name: 'Chess.com', sub: 'Import by username', image: chessComLogo, tone: 'green' },
  { key: 'lichess', name: 'Lichess', sub: 'Import by username', image: lichessLogo, tone: 'blue' },
  { key: 'tournament', name: 'Tournament Games', sub: 'Search the club archive', icon: Trophy, tone: 'wine' },
]

const classificationColors: Record<ReviewClassification, string> = {
  Brilliant: '#1baca6',
  Great: '#5c8bb0',
  Book: '#c79a73',
  Best: '#81b64c',
  Excellent: '#69a83f',
  Good: '#8aaa79',
  Inaccuracy: '#e6b93f',
  Mistake: '#ef8b4c',
  Miss: '#f36f68',
  Blunder: '#ef4035',
  Forced: '#7d8790',
}

const classificationOrder: ReviewClassification[] = [
  'Brilliant',
  'Great',
  'Book',
  'Best',
  'Excellent',
  'Good',
  'Inaccuracy',
  'Mistake',
  'Miss',
  'Blunder',
  'Forced',
]

function GamesPage() {
  const { linkExternalGameUsername, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const queryGameId = searchParams.get('game')
  const queryGame = findSampleGame(queryGameId)
  const queryMode = searchParams.get('mode') === 'analysis' ? 'analysis' : 'review'
  const [mode, setMode] = useState<GameMode>(queryMode)
  const [step, setStep] = useState<WorkspaceStep>(queryGame ? 'review' : 'source')
  const [source, setSource] = useState<GameSource | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [game, setGame] = useState<SampleGame | null>(queryGame)
  const [moveIdx, setMoveIdx] = useState(queryGame ? Math.max(0, queryGame.moves.length - 1) : 0)
  const [pgnText, setPgnText] = useState('')
  const [loadingGame, setLoadingGame] = useState(Boolean(queryGameId && !queryGame))
  const [tournamentArchive, setTournamentArchive] = useState<SampleGame[]>([])
  const [sourceGames, setSourceGames] = useState<SampleGame[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchNotice, setSearchNotice] = useState('')
  const [externalGamesCursor, setExternalGamesCursor] = useState<string | null>(null)
  const [loadMoreLoading, setLoadMoreLoading] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [workspaceMoves, setWorkspaceMoves] = useState<string[]>([])
  const [workspaceViewedPly, setWorkspaceViewedPly] = useState<number | null>(null)
  const [workspaceResult, setWorkspaceResult] = useState('Live')
  const [saved, setSaved] = useState(false)
  const [ran, setRan] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const {
    arrowColor,
    boardTheme,
    markColor,
    pieceTheme,
    setArrowColor,
    setBoardTheme,
    setMarkColor,
    setPieceTheme,
  } = useBoardPreferences()
  const [reviewSession, setReviewSession] = useState<ScopedGameReview | null>(null)
  const [reviewStarted, setReviewStarted] = useState(false)
  const [reviewRequestVersion, setReviewRequestVersion] = useState(0)
  const [reviewError, setReviewError] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewProgress, setReviewProgress] = useState({ completed: 0, total: 0 })
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceAnalysis, setWorkspaceAnalysis] = useState<PositionAnalysisResult | null>(null)
  const [workspaceAnalysisError, setWorkspaceAnalysisError] = useState('')
  const [workspaceAnalysisLoading, setWorkspaceAnalysisLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [engineStrength, setEngineStrength] = useState<ReviewEngineStrength>(loadReviewEngineStrength)
  const enginePreset = getReviewEnginePreset(engineStrength)
  const activeGameIdentity = game ? reviewGameIdentity(game) : null
  const review = reviewSession?.gameIdentity === activeGameIdentity
    ? reviewSession.result
    : null
  const reviewRunRef = useRef(0)
  const reviewStartedIdentityRef = useRef<string | null>(null)
  const reviewAbortRef = useRef<AbortController | null>(null)
  const reviewEngineRef = useRef<StockfishReviewEngine | null>(null)
  const workspaceAnalysisRunRef = useRef(0)
  const workspaceAnalysisAbortRef = useRef<AbortController | null>(null)
  const workspaceAnalysisEngineRef = useRef<StockfishReviewEngine | null>(null)
  const workspaceInitialFen = game?.fen || startFen
  const displayedWorkspacePly = workspaceViewedPly === null
    ? workspaceMoves.length
    : Math.min(workspaceViewedPly, workspaceMoves.length)
  const displayedWorkspaceMoves = useMemo(
    () => workspaceMoves.slice(0, displayedWorkspacePly),
    [displayedWorkspacePly, workspaceMoves],
  )
  const workspaceViewingLatest = displayedWorkspacePly === workspaceMoves.length

  const resetReviewState = () => {
    reviewRunRef.current += 1
    reviewAbortRef.current?.abort()
    reviewAbortRef.current = null
    reviewEngineRef.current?.dispose()
    reviewEngineRef.current = null
    reviewStartedIdentityRef.current = null
    setReviewSession(null)
    setReviewStarted(false)
    setReviewRequestVersion(0)
    setReviewError('')
    setReviewLoading(false)
    setReviewProgress({ completed: 0, total: 0 })
  }

  useEffect(() => {
    window.localStorage.setItem(engineStrengthStorageKey, engineStrength)
    window.localStorage.setItem(engineDefaultVersionKey, engineDefaultVersion)
  }, [engineStrength])

  useEffect(() => {
    reviewStartedIdentityRef.current = null
    setReviewStarted(false)
    setReviewRequestVersion(0)
  }, [game?.key])

  useEffect(() => {
    const gameId = queryGameId
    if (!gameId) {
      setLoadingGame(false)
      return
    }

    const fromUrl = findSampleGame(gameId)
    if (fromUrl) {
      setMode('review')
      setStep('review')
      setGame(fromUrl)
      setMoveIdx(Math.max(0, fromUrl.moves.length - 1))
      setLoadingGame(false)
      return
    }

    setMode('review')
    setLoadingGame(true)

    let active = true
    loadTournamentGame(gameId).then((cloudGame) => {
      if (!active) return

      if (cloudGame) {
        setStep('review')
        setGame(cloudGame)
        setMoveIdx(Math.max(0, cloudGame.moves.length - 1))
      } else {
        setStep('source')
        setGame(null)
      }
      setLoadingGame(false)
    })

    return () => {
      active = false
    }
  }, [queryGameId])

  useEffect(() => {
    if (source !== 'tournament') return

    let active = true
    let refreshing = false

    const refreshArchive = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const games = await loadTournamentGameArchive()
        if (active) {
          setTournamentArchive(games)
          setSearchError('')
        }
      } catch (caught) {
        if (active) setSearchError(caught instanceof Error ? caught.message : 'Tournament game archive is unavailable right now.')
      } finally {
        refreshing = false
      }
    }

    void refreshArchive()
    let unsubscribe: (() => void) | undefined
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshArchive()
    }
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    void subscribeToVisibleGameChanges(() => void refreshArchive())
      .then((stop) => {
        if (active) unsubscribe = stop
        else stop()
      })
      .catch(() => {
        // The visible-only watchdog still refreshes if Realtime is unavailable.
      })

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      unsubscribe?.()
    }
  }, [source])

  const liveCloudGameId = game?.source === 'tournament' && game.live && !findSampleGame(game.id)
    ? game.id
    : null

  useEffect(() => {
    if (step !== 'review' || !liveCloudGameId) return

    let active = true
    let refreshing = false

    const refreshLiveGame = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const cloudGame = await loadTournamentGame(liveCloudGameId)
        if (!active || !cloudGame) return
        setGame(cloudGame)
        setMoveIdx(Math.max(0, cloudGame.moves.length - 1))
      } finally {
        refreshing = false
      }
    }

    let unsubscribe: (() => void) | undefined
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshLiveGame()
    }
    const timer = window.setInterval(refreshWhenVisible, 15_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    void subscribeToTournamentGameRow(liveCloudGameId, () => void refreshLiveGame())
      .then((stop) => {
        if (active) unsubscribe = stop
        else stop()
      })
      .catch(() => {
        // The visible-only watchdog still refreshes if Realtime is unavailable.
      })
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      unsubscribe?.()
    }
  }, [liveCloudGameId, step])

  useEffect(() => {
    const run = ++reviewRunRef.current
    const targetIdentity = activeGameIdentity
    setReviewSession(null)
    setReviewError('')
    setReviewLoading(false)
    setReviewProgress({ completed: 0, total: 0 })

    if (
      step !== 'review'
      || !game
      || !targetIdentity
      || !reviewStarted
      || reviewRequestVersion < 1
      || reviewStartedIdentityRef.current !== targetIdentity
    ) return
    if (game.live) {
      setReviewError('The live board is still changing. Full engine review becomes available when the game finishes.')
      return
    }
    if (!game.moves.length) {
      setReviewError('This game does not contain any saved moves yet.')
      return
    }

    const engine = new StockfishReviewEngine({
      hashMb: enginePreset.hashMb,
      multiPv: 2,
    })
    const controller = new AbortController()
    let active = true
    reviewAbortRef.current = controller
    reviewEngineRef.current = engine
    setReviewLoading(true)
    setReviewProgress({ completed: 0, total: game.moves.length + 1 })

    void reviewGame(
      { fen: game.fen, moves: game.moves },
      engine,
      {
        depth: enginePreset.depth,
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (active && run === reviewRunRef.current) {
            setReviewProgress({ completed, total })
          }
        },
      },
    ).then((result) => {
      if (!active || run !== reviewRunRef.current) return
      setReviewSession({ gameIdentity: targetIdentity, result })
      setReviewLoading(false)
    }).catch((error: unknown) => {
      if (
        !active
        || run !== reviewRunRef.current
        || (error instanceof DOMException && error.name === 'AbortError')
      ) return
      setReviewError(error instanceof Error ? error.message : 'The engine could not review this game.')
      setReviewLoading(false)
    }).finally(() => {
      engine.dispose()
      if (reviewAbortRef.current === controller) reviewAbortRef.current = null
      if (reviewEngineRef.current === engine) reviewEngineRef.current = null
    })

    return () => {
      active = false
      controller.abort()
      engine.dispose()
      if (reviewAbortRef.current === controller) reviewAbortRef.current = null
      if (reviewEngineRef.current === engine) reviewEngineRef.current = null
    }
  }, [activeGameIdentity, enginePreset.depth, enginePreset.hashMb, game, reviewRequestVersion, reviewStarted, step])

  useEffect(() => {
    const run = ++workspaceAnalysisRunRef.current
    workspaceAnalysisAbortRef.current?.abort()
    workspaceAnalysisAbortRef.current = null
    workspaceAnalysisEngineRef.current?.dispose()
    workspaceAnalysisEngineRef.current = null

    if (step !== 'workspace' || !ran) {
      setWorkspaceAnalysis(null)
      setWorkspaceAnalysisError('')
      setWorkspaceAnalysisLoading(false)
      return
    }

    setWorkspaceAnalysis(null)
    setWorkspaceAnalysisError('')
    setWorkspaceAnalysisLoading(true)

    const timer = window.setTimeout(() => {
      const controller = new AbortController()
      const engine = new StockfishReviewEngine({
        hashMb: enginePreset.hashMb,
        multiPv: 1,
      })
      workspaceAnalysisAbortRef.current = controller
      workspaceAnalysisEngineRef.current = engine

      void analyzePosition(
        { fen: workspaceInitialFen, moves: displayedWorkspaceMoves },
        engine,
        enginePreset.depth,
        controller.signal,
      ).then((result) => {
        if (run !== workspaceAnalysisRunRef.current) return
        setWorkspaceAnalysis(result)
        setWorkspaceAnalysisLoading(false)
      }).catch((error: unknown) => {
        if (run !== workspaceAnalysisRunRef.current) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setWorkspaceAnalysisError(
          error instanceof Error ? error.message : 'Stockfish could not evaluate this position.',
        )
        setWorkspaceAnalysisLoading(false)
      }).finally(() => {
        engine.dispose()
        if (workspaceAnalysisAbortRef.current === controller) {
          workspaceAnalysisAbortRef.current = null
        }
        if (workspaceAnalysisEngineRef.current === engine) {
          workspaceAnalysisEngineRef.current = null
        }
      })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      workspaceAnalysisAbortRef.current?.abort()
      workspaceAnalysisAbortRef.current = null
      workspaceAnalysisEngineRef.current?.dispose()
      workspaceAnalysisEngineRef.current = null
    }
  }, [
    enginePreset.depth,
    enginePreset.hashMb,
    ran,
    step,
    workspaceInitialFen,
    displayedWorkspaceMoves,
  ])

  useEffect(() => {
    if (step !== 'review' || !game || !reviewStarted) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setMoveIdx((current) => Math.max(0, current - 1))
      }
      if (event.key === 'ArrowRight' && game.moves.length > 0) {
        setMoveIdx((current) => Math.min(game.moves.length - 1, current + 1))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [game, reviewStarted, step])

  const sourceLabel = source ? sourceName(source) : 'Tournament Games'
  const visiblePool = useMemo(() => {
    if (!source) return []

    const rawPool = source === 'tournament' ? tournamentArchive : sourceGames
    if (source !== 'tournament') return rawPool

    const needle = searchText.trim().toLowerCase()
    if (!needle) return rawPool

    return rawPool.filter((item) => (
      `${item.white} ${item.black} ${item.tournamentName || ''} ${item.round} ${item.opening}`
        .toLowerCase()
        .includes(needle)
    ))
  }, [searchText, source, sourceGames, tournamentArchive])

  const selectedGame = visiblePool.find((item) => item.key === selectedKey) || null
  const isReviewMode = mode === 'review'
  const inReview = step === 'review' && Boolean(game)
  const inWorkspace = step === 'workspace'
  const workspaceGame = workspaceLoaded ? game : null
  const boardGame = inReview ? game : inWorkspace ? workspaceGame : null
  const evalNow = inReview
    ? getCurrentEval(review, moveIdx)
    : inWorkspace && ran
      ? workspaceAnalysis?.evaluation ?? 0
      : undefined
  const boardMoves = inReview && game
    ? game.moves.slice(0, moveIdx + 1)
    : inWorkspace
      ? displayedWorkspaceMoves
      : []
  const boardFen = boardMoves.length ? undefined : boardGame?.fen || startFen
  const boardSummary = getJuChessBoardSummary(boardFen, boardMoves)
  const currentOpening = useOpeningIdentity(boardGame?.fen || startFen, boardMoves)
  const playerData = {
    black: {
      badge: inWorkspace ? workspaceResult : boardGame ? boardGame.result : '',
      captured: boardSummary.captured.black,
      color: 'black' as const,
      name: boardGame?.black || 'Black',
      rating: boardGame?.bRating,
    },
    white: {
      badge: '',
      captured: boardSummary.captured.white,
      color: 'white' as const,
      name: boardGame?.white || 'White',
      rating: boardGame?.wRating,
    },
  }
  const topPlayer = flipped ? playerData.white : playerData.black
  const bottomPlayer = flipped ? playerData.black : playerData.white
  const reviewRows = game ? buildMoveRows(game, review, moveIdx, setMoveIdx) : []
  const classCounts = review ? buildClassCounts(review) : []
  const reviewEvals = review?.positions.slice(1).map((position) => position.evaluation) ?? []
  const evalArea = buildEvalArea(reviewEvals)
  const evalCursorX = buildEvalCursor(reviewEvals, moveIdx)
  const selectedReviewMove = review?.moves[moveIdx]
  const reviewSquareBadge = reviewStarted && selectedReviewMove
    ? {
        color: classificationColors[selectedReviewMove.classification],
        label: `${selectedReviewMove.classification} move ${selectedReviewMove.san}`,
        square: selectedReviewMove.uci.slice(2, 4) as Square,
        symbol: <ReviewClassificationGlyph classification={selectedReviewMove.classification} />,
      }
    : undefined
  const workspaceRows = buildWorkspaceRows(workspaceMoves)

  const searchSourceGames = async (
    targetSource: GameSource | null = source,
    targetUsername = searchText,
  ) => {
    if (!targetSource || searchLoading) return
    setSelectedKey(null)
    setSearchError('')
    setSearchNotice('')
    setExternalGamesCursor(null)
    setLoadMoreError('')

    if (targetSource === 'tournament') {
      setStep('list')
      return
    }

    setSearchLoading(true)
    try {
      const normalizedUsername = targetUsername.trim().toLowerCase()
      const page = await loadExternalGamesPage(targetSource, normalizedUsername)
      setSourceGames(page.games)
      setExternalGamesCursor(page.nextCursor)
      setStep('list')

      if (profile) {
        try {
          await linkExternalGameUsername(targetSource, normalizedUsername)
          setSearchNotice(`${sourceName(targetSource)} account linked.`)
        } catch (error) {
          setSearchNotice(
            error instanceof Error
              ? `Games loaded, but the account could not be linked: ${error.message}`
              : 'Games loaded, but the account could not be linked.',
          )
        }
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : `${sourceName(targetSource)} games could not be loaded.`)
    } finally {
      setSearchLoading(false)
    }
  }

  const loadMoreSourceGames = async () => {
    if (!source || source === 'tournament' || !externalGamesCursor || loadMoreLoading) return
    setLoadMoreError('')
    setLoadMoreLoading(true)

    try {
      const page = await loadExternalGamesPage(source, searchText.trim().toLowerCase(), {
        cursor: externalGamesCursor,
      })
      setSourceGames((currentGames) => {
        const existingKeys = new Set(currentGames.map((currentGame) => currentGame.key))
        return [
          ...currentGames,
          ...page.games.filter((nextGame) => !existingKeys.has(nextGame.key)),
        ]
      })
      setExternalGamesCursor(page.nextCursor)
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : `${sourceName(source)} games could not be loaded.`)
    } finally {
      setLoadMoreLoading(false)
    }
  }

  const openSource = (nextSource: GameSource) => {
    const linkedUsername = externalUsernameForSource(profile, nextSource)
    setSource(nextSource)
    setSelectedKey(null)
    setSearchText(linkedUsername)
    setSourceGames([])
    setSearchError('')
    setSearchNotice('')
    setSearchLoading(false)
    setExternalGamesCursor(null)
    setLoadMoreError('')
    setLoadMoreLoading(false)
    setStep('search')

    if (linkedUsername && nextSource !== 'tournament') {
      void searchSourceGames(nextSource, linkedUsername)
    }
  }

  const startSelectedGame = () => {
    if (!selectedGame) return

    resetReviewState()
    setGame(selectedGame)
    setMoveIdx(Math.max(0, selectedGame.moves.length - 1))
    setSaved(false)
    setRan(mode === 'analysis')
    setWorkspaceLoaded(mode === 'analysis')
    setWorkspaceMoves(mode === 'analysis' ? selectedGame.moves : [])
    setWorkspaceViewedPly(null)
    setWorkspaceResult(selectedGame.result)
    setStep(mode === 'review' ? 'review' : 'workspace')
  }

  const openBlankBoard = () => {
    setGame(null)
    setWorkspaceLoaded(false)
    setWorkspaceMoves([])
    setWorkspaceViewedPly(null)
    setWorkspaceResult('Live')
    setSaved(false)
    setRan(true)
    setStep('workspace')
  }

  const loadPgn = () => {
    if (!pgnText.trim()) return
    try {
      const input = pgnText.trim()
      const importedId = `imported-${Date.now()}`
      const fenInput = input.includes('/') && input.split(/\s+/).length >= 4
      const importedGame: SampleGame = fenInput
        ? (() => {
            const parsed = parseAnalysisPosition({ fen: input })
            return {
              black: 'Black',
              bRating: 0,
              date: 'Custom position',
              fen: parsed.currentFen,
              id: importedId,
              key: importedId,
              moves: [],
              opening: 'Custom position',
              pgn: '',
              result: '*',
              round: 'Local analysis',
              source: 'tournament',
              wRating: 0,
              white: 'White',
            }
          })()
        : (() => {
            const parsed = parseReviewGame({ pgn: input })
            return {
              bRating: parseRating(parsed.headers.BlackElo),
              black: parsed.headers.Black || 'Black',
              date: formatPgnDate(parsed.headers.Date),
              fen: parsed.initialFen,
              id: importedId,
              key: importedId,
              moves: parsed.moves,
              opening: parsed.headers.Opening || parsed.headers.ECO || 'Imported PGN',
              pgn: input,
              result: parsed.headers.Result || '*',
              round: parsed.headers.Round ? `Round ${parsed.headers.Round}` : 'Imported game',
              source: 'tournament',
              wRating: parseRating(parsed.headers.WhiteElo),
              white: parsed.headers.White || 'White',
            }
          })()
      setGame(importedGame)
      setWorkspaceLoaded(true)
      setWorkspaceMoves(importedGame.moves)
      setWorkspaceViewedPly(null)
      setWorkspaceResult(importedGame.result)
      setWorkspaceError('')
      setRan(true)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'The PGN could not be read.')
    }
  }

  const updateWorkspaceBoard = (state: JuChessBoardChange) => {
    setWorkspaceMoves(state.moves)
    setWorkspaceViewedPly(null)
    setWorkspaceResult(state.result)
    setWorkspaceLoaded(true)
  }

  const startAnalysisFromBoard = (state: JuChessBoardChange) => {
    resetReviewState()
    setMode('analysis')
    setStep('workspace')
    setGame(null)
    setWorkspaceLoaded(true)
    setWorkspaceMoves(state.moves)
    setWorkspaceViewedPly(null)
    setWorkspaceResult(state.result)
    setWorkspaceError('')
    setSaved(false)
    setRan(true)
  }

  return (
    <div className="club-screen games-screen" data-screen-label="Tools Workspace">
      <SiteHeader active="tools" />
      <main className="games-main">
        <section className="board-column" aria-label="Board area">
          <div className="board-title-row">
            <h1>{inReview ? 'Game review' : inWorkspace ? 'Analysis board' : isReviewMode ? 'Review room' : 'Analysis room'}</h1>
            {boardGame || inReview || (inWorkspace && ran) ? (
              <div className="board-title-actions">
                {currentOpening ? (
                  <span className="board-opening-label">
                    <strong>{currentOpening.eco}</strong>
                    {currentOpening.name}
                  </span>
                ) : null}
                <span>
                  {boardGame ? boardGame.round || boardGame.date : null}
                  {inReview || (inWorkspace && ran) ? (
                    <small>
                      {inWorkspace && workspaceAnalysis?.source === 'tablebase'
                        ? `${workspaceAnalysis.tablebase?.exact ? 'Exact ' : ''}Lichess tablebase`
                        : `Stockfish 18 · ${enginePreset.label}`}
                    </small>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>

          {settingsOpen ? (
            <GameSettingsPanel
              arrowColor={arrowColor}
              boardTheme={boardTheme}
              markColor={markColor}
              onArrowColorChange={setArrowColor}
              onBoardThemeChange={setBoardTheme}
              strength={engineStrength}
              onClose={() => setSettingsOpen(false)}
              onMarkColorChange={setMarkColor}
              onPieceThemeChange={setPieceTheme}
              onStrengthChange={setEngineStrength}
              pieceTheme={pieceTheme}
            />
          ) : null}

          <div className="board-control-stack">
            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-label="Board settings"
              className={settingsOpen ? 'active' : undefined}
              title="Board settings"
              onClick={() => setSettingsOpen((current) => !current)}
            >
              <Settings2 aria-hidden="true" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              aria-label="Flip board"
              aria-pressed={flipped}
              title="Flip board"
              onClick={() => setFlipped((current) => !current)}
            >
              <FlipHorizontal2 aria-hidden="true" />
              <span>Flip board</span>
            </button>
          </div>

          <div className="board-player-frame">
            <PlayerBar {...topPlayer} edge="top" pieceTheme={pieceTheme} />

            <div className="board-wrap">
              <JuChessBoard
                arrowColor={arrowColor}
                boardTheme={boardTheme}
                className="games-ju-board"
                evaluation={evalNow}
                fen={boardFen}
                flipped={flipped}
                interactive={!inReview && (!inWorkspace || workspaceViewingLatest)}
                markColor={markColor}
                moves={boardMoves}
                onChange={inWorkspace ? updateWorkspaceBoard : inReview ? undefined : startAnalysisFromBoard}
                pieceTheme={pieceTheme}
                showEvaluation={Boolean(boardGame || inReview || inWorkspace)}
                squareBadge={reviewSquareBadge}
              />
            </div>

            <PlayerBar
              {...bottomPlayer}
              edge="bottom"
              pieceTheme={pieceTheme}
              center={inReview && game ? (
                <MoveNavigation
                  current={game.moves.length > 0 ? moveIdx : 0}
                  last={Math.max(0, game.moves.length - 1)}
                  onChange={setMoveIdx}
                />
              ) : inWorkspace ? (
                <MoveNavigation
                  current={displayedWorkspacePly}
                  last={workspaceMoves.length}
                  onChange={(ply) => setWorkspaceViewedPly(ply === workspaceMoves.length ? null : ply)}
                />
              ) : null}
            />
          </div>
        </section>

        <aside className="game-rail" aria-label="Game tools">
          <div className="mode-toggle" role="tablist" aria-label="Games mode">
            <button
              type="button"
              className={isReviewMode ? 'active' : undefined}
              onClick={() => {
                resetReviewState()
                setMode('review')
                setStep('source')
                setGame(null)
                setSelectedKey(null)
                setSource(null)
                setWorkspaceMoves([])
                setWorkspaceViewedPly(null)
                setWorkspaceResult('Live')
              }}
            >
              Game Review
            </button>
            <button
              type="button"
              className={!isReviewMode ? 'active' : undefined}
              onClick={() => {
                resetReviewState()
                setMode('analysis')
                setStep('source')
                setGame(null)
                setSelectedKey(null)
                setSource(null)
                setWorkspaceMoves([])
                setWorkspaceViewedPly(null)
                setWorkspaceResult('Live')
              }}
            >
              New Analysis
            </button>
          </div>

          {loadingGame ? (
            <section className="rail-panel search-panel">
              <h2>Opening game</h2>
              <p>Loading the saved tournament board.</p>
            </section>
          ) : null}

          {step === 'source' && !loadingGame ? (
            <SourceStep
              isAnalysis={!isReviewMode}
              onBlank={openBlankBoard}
              onSource={openSource}
            />
          ) : null}

          {step === 'search' && source ? (
            <SearchStep
              searchText={searchText}
              source={source}
              sourceLabel={sourceLabel}
              onBack={() => {
                setSource(null)
                setSearchError('')
                setSearchNotice('')
                setStep('source')
              }}
              error={searchError}
              notice={searchNotice}
              loading={searchLoading}
              onSearch={() => void searchSourceGames()}
              setSearchText={setSearchText}
            />
          ) : null}

          {step === 'list' && source ? (
            <ListStep
              games={visiblePool}
              isReviewMode={isReviewMode}
              canLoadMore={source !== 'tournament' && Boolean(externalGamesCursor)}
              loadMoreError={loadMoreError}
              loadMoreLoading={loadMoreLoading}
              notice={searchNotice}
              selectedKey={selectedKey}
              sourceLabel={sourceLabel}
              onBack={() => {
                setSelectedKey(null)
                setStep('search')
              }}
              onSelect={setSelectedKey}
              onStart={startSelectedGame}
              onLoadMore={() => void loadMoreSourceGames()}
            />
          ) : null}

          {step === 'review' && game ? (
            <ReviewPanel
              classCounts={classCounts}
              error={reviewError}
              evalArea={evalArea}
              evalCursorX={evalCursorX}
              game={game}
              loading={reviewLoading}
              moveRows={reviewRows}
              opening={currentOpening}
              onSelectMove={(index) => {
                setMoveIdx(index)
                reviewStartedIdentityRef.current = activeGameIdentity
                setReviewStarted(true)
              }}
              progress={reviewProgress}
              review={review}
              selectedMove={selectedReviewMove}
              started={reviewStarted}
              onExit={() => {
                resetReviewState()
                setStep('source')
                setGame(null)
                setSelectedKey(null)
                setSource(null)
              }}
              onStart={() => {
                setMoveIdx(0)
                reviewStartedIdentityRef.current = activeGameIdentity
                setReviewStarted(true)
                setReviewRequestVersion((version) => version + 1)
              }}
            />
          ) : null}

          {step === 'workspace' ? (
            <WorkspacePanel
              analysis={workspaceAnalysis}
              analysisLoading={workspaceAnalysisLoading}
              game={workspaceGame}
              error={workspaceError || workspaceAnalysisError}
              loaded={workspaceLoaded}
              opening={currentOpening}
              pgnText={pgnText}
              ran={ran}
              rows={workspaceRows}
              saved={saved}
              setPgnText={setPgnText}
              onClose={() => {
                setStep('source')
                setGame(null)
                setWorkspaceLoaded(false)
                setWorkspaceMoves([])
                setWorkspaceViewedPly(null)
                setWorkspaceResult('Live')
                setRan(false)
              }}
              onLoad={loadPgn}
              onNew={() => {
                setWorkspaceLoaded(false)
                setGame(null)
                setPgnText('')
                setWorkspaceMoves([])
                setWorkspaceViewedPly(null)
                setWorkspaceResult('Live')
                setSaved(false)
                setRan(true)
                setWorkspaceError('')
              }}
              onReview={() => {
                const nextGame = game || createWorkspaceGame(workspaceMoves, workspaceResult)
                resetReviewState()
                setGame(nextGame)
                setMode('review')
                setStep('review')
                setMoveIdx(Math.max(0, nextGame.moves.length - 1))
              }}
              onRun={() => setRan((current) => !current)}
              onSave={() => setSaved(true)}
            />
          ) : null}
        </aside>
      </main>
    </div>
  )
}

function GameSettingsPanel({
  arrowColor,
  boardTheme,
  markColor,
  onArrowColorChange,
  onBoardThemeChange,
  onClose,
  onMarkColorChange,
  onPieceThemeChange,
  onStrengthChange,
  pieceTheme,
  strength,
}: {
  arrowColor: JuAnnotationColor
  boardTheme: JuBoardTheme
  markColor: JuAnnotationColor
  onArrowColorChange: (color: JuAnnotationColor) => void
  onBoardThemeChange: (theme: JuBoardTheme) => void
  onClose: () => void
  onMarkColorChange: (color: JuAnnotationColor) => void
  onPieceThemeChange: (theme: JuPieceTheme) => void
  onStrengthChange: (strength: ReviewEngineStrength) => void
  pieceTheme: JuPieceTheme
  strength: ReviewEngineStrength
}) {
  return (
    <BoardSettingsPanel
      arrowColor={arrowColor}
      boardTheme={boardTheme}
      className="games-board-settings"
      markColor={markColor}
      onArrowColorChange={onArrowColorChange}
      onBoardThemeChange={onBoardThemeChange}
      onClose={onClose}
      onMarkColorChange={onMarkColorChange}
      onPieceThemeChange={onPieceThemeChange}
      pieceTheme={pieceTheme}
    >
      <fieldset className="engine-strength-options">
        <legend>Stockfish strength</legend>
        {reviewEnginePresets.map((preset) => (
          <button
            type="button"
            className={preset.id === strength ? 'active' : undefined}
            aria-pressed={preset.id === strength}
            key={preset.id}
            onClick={() => onStrengthChange(preset.id)}
          >
            <strong>{preset.label}</strong>
            <span>Depth {preset.depth}</span>
          </button>
        ))}
      </fieldset>
    </BoardSettingsPanel>
  )
}

function MoveNavigation({
  current,
  last,
  onChange,
}: {
  current: number
  last: number
  onChange: (ply: number) => void
}) {
  return (
    <div className="move-navigation" aria-label="Move navigation">
      <button type="button" aria-label="Go to start" disabled={current <= 0} onClick={() => onChange(0)} title="Go to start">
        <SkipBack aria-hidden="true" />
      </button>
      <button type="button" aria-label="Previous move" disabled={current <= 0} onClick={() => onChange(Math.max(0, current - 1))} title="Previous move">
        <ChevronLeft aria-hidden="true" />
      </button>
      <button type="button" aria-label="Next move" disabled={current >= last} onClick={() => onChange(Math.min(last, current + 1))} title="Next move">
        <ChevronRight aria-hidden="true" />
      </button>
      <button type="button" aria-label="Go to end" disabled={current >= last} onClick={() => onChange(last)} title="Go to end">
        <SkipForward aria-hidden="true" />
      </button>
    </div>
  )
}

function PlayerBar({
  badge,
  captured,
  color,
  center,
  edge,
  name,
  pieceTheme,
  rating,
}: {
  badge: string
  captured: JuCapturedPiece[]
  color: 'black' | 'white'
  center?: ReactNode
  edge: 'bottom' | 'top'
  name: string
  pieceTheme: JuPieceTheme
  rating?: number
}) {
  return (
    <div className={`player-bar ${color} ${edge}${center ? ' has-center' : ''}`} aria-label={`${color === 'white' ? 'White' : 'Black'} player: ${name}`}>
      <div className="player-bar-person">
        <i className={color} aria-hidden="true" />
        <div>
          <small>{color}</small>
          <b>{name}</b>
          <JuCapturedPieces pieces={captured} pieceTheme={pieceTheme} />
        </div>
        {rating ? <em>{rating}</em> : null}
      </div>
      {center ? <div className="player-bar-center">{center}</div> : null}
      <strong>{badge}</strong>
    </div>
  )
}

function SourceStep({
  isAnalysis,
  onBlank,
  onSource,
}: {
  isAnalysis: boolean
  onBlank: () => void
  onSource: (source: GameSource) => void
}) {
  return (
    <>
      {isAnalysis ? (
        <>
          <button type="button" className="blank-board-button" onClick={onBlank}>
            <span aria-hidden="true">{'\u2654'}</span>
            <span>
              <strong>New Analysis</strong>
              <small>Open a blank board workspace</small>
            </span>
            <em>&rarr;</em>
          </button>
          <div className="source-divider">Or import from</div>
        </>
      ) : (
        <p className="source-help">Pick where the game was played, find it, and get a full engine-style review.</p>
      )}

      {sourceDefs.map((source) => {
        const SourceIcon = source.icon
        return (
          <button
            type="button"
            className="source-card"
            onClick={() => onSource(source.key)}
            key={source.key}
          >
            <span className={`source-icon ${source.image ? 'provider' : source.tone}`}>
              {source.image ? <img src={source.image} alt="" aria-hidden="true" /> : SourceIcon ? <SourceIcon aria-hidden="true" /> : null}
            </span>
            <span>
              <strong>{source.name}</strong>
              <small>{source.sub}</small>
            </span>
            <em>&rarr;</em>
          </button>
        )
      })}
    </>
  )
}

function SearchStep({
  error,
  loading,
  notice,
  onBack,
  onSearch,
  searchText,
  setSearchText,
  source,
  sourceLabel,
}: {
  error: string
  loading: boolean
  notice: string
  onBack: () => void
  onSearch: () => void
  searchText: string
  setSearchText: (value: string) => void
  source: GameSource
  sourceLabel: string
}) {
  const isTournament = source === 'tournament'
  const sourceDef = sourceDefs.find((item) => item.key === source)

  return (
    <section className="rail-panel search-panel">
      <button type="button" className="rail-back" onClick={onBack}>
        &larr; Back
      </button>
      <div className="search-provider-heading">
        {sourceDef?.image ? (
          <span className="source-icon provider">
            <img src={sourceDef.image} alt="" aria-hidden="true" />
          </span>
        ) : null}
        <div>
          <h2>{sourceLabel}</h2>
          <p>{isTournament ? 'Search by player, event, or round' : `Enter a ${sourceLabel} username`}</p>
        </div>
      </div>
      <input
        autoCapitalize="none"
        autoComplete="off"
        disabled={loading}
        type="text"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearch()
        }}
        placeholder={isTournament ? 'e.g. Ibrahim, Swiss, QF...' : 'e.g. ibrahim_ju'}
      />
      {error ? <p className="search-error" role="alert">{error}</p> : null}
      {notice ? <p className="search-notice" role="status">{notice}</p> : null}
      <button type="button" className="primary-rail-button" disabled={loading} onClick={onSearch}>
        {loading ? 'Loading games...' : 'Search games'}
      </button>
    </section>
  )
}

function ListStep({
  canLoadMore,
  games,
  isReviewMode,
  loadMoreError,
  loadMoreLoading,
  notice,
  onBack,
  onLoadMore,
  onSelect,
  onStart,
  selectedKey,
  sourceLabel,
}: {
  canLoadMore: boolean
  games: SampleGame[]
  isReviewMode: boolean
  loadMoreError: string
  loadMoreLoading: boolean
  notice: string
  onBack: () => void
  onLoadMore: () => void
  onSelect: (key: string) => void
  onStart: () => void
  selectedKey: string | null
  sourceLabel: string
}) {
  return (
    <section className="game-list-panel">
      <div className="game-list-head">
        <button type="button" onClick={onBack}>
          &larr;
        </button>
        <strong>{sourceLabel}</strong>
        <span>{games.length} games</span>
      </div>
      {notice ? <p className="game-list-notice" role="status">{notice}</p> : null}
      <div className="game-list-scroll">
        {games.length ? games.map((game) => (
          <button
            type="button"
            className={selectedKey === game.key ? 'selected' : undefined}
            onClick={() => onSelect(game.key)}
            key={game.key}
          >
            <span>
              <strong>
                {game.white} - {game.black}
              </strong>
              <em>{game.result}</em>
            </span>
            <small>
              {game.tournamentName ? `${game.tournamentName} - ` : ''}
              {game.opening} - {game.date}
              {game.round ? ` - ${game.round}` : ''}
            </small>
          </button>
        )) : (
          <div className="game-list-empty">
            <strong>No games found</strong>
            <span>
              {sourceLabel === 'Tournament Games'
                ? 'Completed or live tournament games will appear here.'
                : 'Check the username or try another account.'}
            </span>
          </div>
        )}
      </div>
      {canLoadMore || loadMoreLoading || loadMoreError ? (
        <div className="game-list-more">
          {loadMoreError ? <p role="alert">{loadMoreError}</p> : null}
          {canLoadMore || loadMoreLoading ? (
            <button type="button" disabled={loadMoreLoading} onClick={onLoadMore}>
              {loadMoreLoading ? 'Loading more games...' : 'Load more games'}
            </button>
          ) : null}
        </div>
      ) : null}
      {selectedKey ? (
        <div className="game-list-action">
          <button type="button" onClick={onStart}>
            {isReviewMode ? 'Start Review' : 'Start Analysis'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

function ReviewPanel({
  classCounts,
  error,
  evalArea,
  evalCursorX,
  game,
  loading,
  moveRows,
  opening,
  onExit,
  onSelectMove,
  onStart,
  progress,
  review,
  selectedMove,
  started,
}: {
  classCounts: ReturnType<typeof buildClassCounts>
  error: string
  evalArea: string
  evalCursorX: number
  game: SampleGame
  loading: boolean
  moveRows: ReturnType<typeof buildMoveRows>
  opening: OpeningIdentity | null
  onExit: () => void
  onSelectMove: (index: number) => void
  onStart: () => void
  progress: { completed: number; total: number }
  review: GameReviewResult | null
  selectedMove?: ReviewedMove
  started: boolean
}) {
  const progressPercent = progress.total
    ? Math.round(progress.completed / progress.total * 100)
    : 0
  const selectedColor = selectedMove ? classificationColors[selectedMove.classification] : '#7d8790'
  const moveListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!started) return
    const container = moveListRef.current
    const selected = container?.querySelector<HTMLButtonElement>('button.selected')
    if (!container || !selected) return
    const top = selected.offsetTop
    const bottom = top + selected.offsetHeight
    if (top < container.scrollTop) container.scrollTop = top
    else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom - container.clientHeight
    }
  }, [selectedMove?.uci, started])

  return (
    <>
      <section className="rail-panel review-panel" data-review-state={started ? 'walkthrough' : 'summary'}>
        <div className="rail-heading">
          <span>{started ? 'Move review' : 'Game review'}</span>
          <button type="button" onClick={onExit}>
            New review
          </button>
        </div>
        {loading ? (
          <div className="review-progress" role="status" aria-live="polite">
            <div>
              <strong>Stockfish review</strong>
              <span>{progress.completed} / {progress.total} positions</span>
            </div>
            <i><b style={{ width: `${progressPercent}%` }} /></i>
            <small>{progressPercent}%</small>
          </div>
        ) : null}
        {error ? <p className="review-error" role="alert">{error}</p> : null}
        {!review && !loading ? (
          <div className="review-engine-cta">
            <span>Engine review</span>
            <strong>Analyze this completed game when you are ready.</strong>
            <small>Stockfish loads only after you start.</small>
            <button type="button" className="review-start-button" onClick={onStart}>
              {error ? 'Try engine review again' : 'Start engine review'}
            </button>
          </div>
        ) : null}
        {review ? (
          <>
            <ReviewGraph
              area={evalArea}
              cursorX={evalCursorX}
              onSelectMove={onSelectMove}
              review={review}
              showCursor={started}
            />
            {started && selectedMove ? (
              <div className="review-move-detail" style={{ borderColor: selectedColor }}>
                <div>
                  <span>
                    <ReviewClassificationBadge classification={selectedMove.classification} />
                    {reviewFeedback(selectedMove)}
                  </span>
                  <strong>{formatEvaluation(selectedMove.evaluation)}</strong>
                </div>
                <p>
                  Played <b>{selectedMove.san}</b>
                  {selectedMove.bestMoveSan ? <> · Best <b>{selectedMove.bestMoveSan}</b></> : null}
                </p>
                <small>{selectedMove.bestLine.slice(0, 8).join(' ') || 'Game over'}</small>
              </div>
            ) : null}
            {!started ? (
              <>
                <div className="review-ready-players">
                  <div>
                    <span>White</span>
                    <strong>{game.white}</strong>
                    <em>{review.whiteAccuracy.toFixed(1)}</em>
                  </div>
                  <div>
                    <span>Black</span>
                    <strong>{game.black}</strong>
                    <em>{review.blackAccuracy.toFixed(1)}</em>
                  </div>
                </div>
                <div className="class-count-head" aria-hidden="true">
                  <span>Move quality</span>
                  <em>White</em>
                  <i />
                  <em>Black</em>
                </div>
                <div className="class-counts">
                  {classCounts.map((count) => (
                    <div key={count.label}>
                      <span>{count.label}</span>
                      <em style={{ color: count.color }}>{count.white}</em>
                      <ReviewClassificationBadge classification={count.label} compact />
                      <em style={{ color: count.color }}>{count.black}</em>
                    </div>
                  ))}
                </div>
                <div className="review-phase-breakdown">
                  <div className="game-rating-row">
                    <span>Game rating</span>
                    <strong>{estimateGameRating(review.whiteAccuracy, game.wRating)}</strong>
                    <i aria-hidden="true" />
                    <strong>{estimateGameRating(review.blackAccuracy, game.bRating)}</strong>
                  </div>
                  {review.phases.map((phase) => (
                    <div className="phase-grade-row" key={phase.name}>
                      <span>{phase.name}</span>
                      {phase.white ? (
                        <ReviewClassificationBadge classification={phase.white.classification} compact />
                      ) : <em aria-label={`White did not reach the ${phase.name.toLowerCase()}`}>-</em>}
                      <i aria-hidden="true" />
                      {phase.black ? (
                        <ReviewClassificationBadge classification={phase.black.classification} compact />
                      ) : <em aria-label={`Black did not reach the ${phase.name.toLowerCase()}`}>-</em>}
                    </div>
                  ))}
                </div>
                <button type="button" className="review-start-button" onClick={onStart}>
                  Start Review
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </section>

      {review && started ? (
        <section className="moves-panel">
          <h2>Moves - {opening ? `${opening.eco} ${opening.name}` : game.opening}</h2>
          <div className="move-list-scroll" ref={moveListRef}>
            {moveRows.map((row) => (
              <div className="move-row" key={row.number}>
                <span>{row.number}.</span>
                <button type="button" className={row.whiteSelected ? 'selected' : undefined} onClick={row.onWhite}>
                  <strong>{row.whiteMove}</strong>
                  {row.whiteClass ? <ReviewClassificationBadge classification={row.whiteClass} compact /> : null}
                </button>
                {row.blackMove ? (
                  <button type="button" className={row.blackSelected ? 'selected' : undefined} onClick={row.onBlack}>
                    <strong>{row.blackMove}</strong>
                    {row.blackClass ? <ReviewClassificationBadge classification={row.blackClass} compact /> : null}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

function ReviewGraph({
  area,
  cursorX,
  onSelectMove,
  review,
  showCursor,
}: {
  area: string
  cursorX: number
  onSelectMove: (index: number) => void
  review: GameReviewResult
  showCursor: boolean
}) {
  const dots = buildEvalDots(review)
  return (
    <svg
      viewBox="0 0 300 80"
      className="eval-graph"
      preserveAspectRatio="none"
      aria-label="Evaluation graph"
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        const pointerX = (event.clientX - bounds.left) / bounds.width * 300
        const pointerY = (event.clientY - bounds.top) / bounds.height * 80
        let closest = dots[0]
        let closestDistance = Number.POSITIVE_INFINITY
        dots.forEach((dot) => {
          const xDistance = (dot.x - pointerX) * bounds.width / 300
          const yDistance = (dot.y - pointerY) * bounds.height / 80
          const distance = xDistance * xDistance + yDistance * yDistance
          if (distance >= closestDistance) return
          closest = dot
          closestDistance = distance
        })
        if (closest && closestDistance <= 14 * 14) onSelectMove(closest.index)
      }}
    >
      <path d={area} />
      <line x1="0" y1="40" x2="300" y2="40" />
      {dots.map((dot) => (
        <g
          aria-label={`Move ${dot.index + 1}: ${review.moves[dot.index].san}, ${review.moves[dot.index].classification}`}
          className="eval-point"
          key={dot.key}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onSelectMove(dot.index)
          }}
          role="button"
          tabIndex={0}
        >
          <circle className="point" cx={dot.x} cy={dot.y} fill={dot.color} r="3.2" />
        </g>
      ))}
      {showCursor ? <line className="cursor" x1={cursorX} y1="0" x2={cursorX} y2="80" /> : null}
    </svg>
  )
}

function ReviewClassificationBadge({
  classification,
  compact = false,
}: {
  classification: ReviewClassification
  compact?: boolean
}) {
  return (
    <i
      aria-label={classification}
      className={compact ? 'review-classification-badge compact' : 'review-classification-badge'}
      style={{ backgroundColor: classificationColors[classification] }}
      title={classification}
    >
      <ReviewClassificationGlyph classification={classification} />
    </i>
  )
}

function ReviewClassificationGlyph({
  classification,
}: {
  classification: ReviewClassification
}) {
  switch (classification) {
    case 'Book':
      return <BookOpen aria-hidden="true" />
    case 'Best':
      return <Star aria-hidden="true" fill="currentColor" />
    case 'Excellent':
      return <ThumbsUp aria-hidden="true" fill="currentColor" />
    case 'Good':
      return <Check aria-hidden="true" />
    case 'Miss':
      return <X aria-hidden="true" />
    case 'Brilliant':
      return <span aria-hidden="true">!!</span>
    case 'Great':
      return <span aria-hidden="true">!</span>
    case 'Inaccuracy':
      return <span aria-hidden="true">?!</span>
    case 'Mistake':
      return <span aria-hidden="true">?</span>
    case 'Blunder':
      return <span aria-hidden="true">??</span>
    case 'Forced':
      return <span aria-hidden="true">=</span>
  }
}

function WorkspacePanel({
  analysis,
  analysisLoading,
  error,
  game,
  loaded,
  opening,
  onClose,
  onLoad,
  onNew,
  onReview,
  onRun,
  onSave,
  pgnText,
  ran,
  rows,
  saved,
  setPgnText,
}: {
  analysis: PositionAnalysisResult | null
  analysisLoading: boolean
  error: string
  game: SampleGame | null
  loaded: boolean
  opening: OpeningIdentity | null
  onClose: () => void
  onLoad: () => void
  onNew: () => void
  onReview: () => void
  onRun: () => void
  onSave: () => void
  pgnText: string
  ran: boolean
  rows: { blackMove: string; number: number; whiteMove: string }[]
  saved: boolean
  setPgnText: (value: string) => void
}) {
  const engineEval = !ran
    ? 'Off'
    : analysis
      ? formatAnalysisEvaluation(analysis)
      : analysisLoading
        ? '...'
        : '-'
  const engineLine = !ran
    ? 'Press Run to start Stockfish'
    : analysisLoading
      ? 'Evaluating the current position...'
      : analysis?.source === 'tablebase'
        ? formatTablebaseLine(analysis)
      : analysis?.bestLineSan.length
        ? analysis.bestLineSan.slice(0, 10).join(' ')
        : analysis
          ? 'No continuation - the game is over'
          : 'Stockfish is waiting for a valid position'

  return (
    <>
      <section className="rail-panel workspace-panel">
        <div className="rail-heading">
          <span>Analysis workspace</span>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="engine-line">
          <div>
            <strong>{engineEval}</strong>
            <span>
              {analysis?.source === 'tablebase'
                ? `${analysis.tablebase?.exact ? 'Exact tablebase' : 'Tablebase'} · ${analysis.tablebase?.pieceCount ?? 7} pieces`
                : analysis ? `depth ${analysis.depth}` : 'Stockfish 18'}
            </span>
          </div>
          <p>{engineLine}</p>
        </div>
        <div className="workspace-opening">
          <strong>{opening?.name || (loaded && game ? game.opening : 'Starting position')}</strong>
          <span>
            {opening?.eco || (loaded && game
              ? game.opening === 'Custom position' ? 'FEN' : sourceName(game.source)
              : 'Standard')}
          </span>
        </div>
        <div className="workspace-actions">
          <button type="button" onClick={onNew}>
            New
          </button>
          <button type="button" onClick={onSave}>
            {saved ? 'Saved' : 'Save'}
          </button>
          <button type="button" onClick={onReview}>
            Review
          </button>
          <button type="button" className="run" onClick={onRun}>
            {ran ? 'Stop' : 'Run'}
          </button>
        </div>
      </section>

      <section className="moves-panel workspace-moves">
        <h2>Move table</h2>
        {loaded ? (
          <div className="move-list-scroll short">
            {rows.map((row) => (
              <div className="move-row read-only" key={row.number}>
                <span>{row.number}.</span>
                <strong>{row.whiteMove}</strong>
                <strong>{row.blackMove}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>Blank board - paste a PGN or FEN below, or Run the engine on the start position.</p>
        )}
      </section>

      <section className="rail-panel pgn-panel">
        <h2>Paste PGN or FEN</h2>
        <textarea
          value={pgnText}
          onChange={(event) => setPgnText(event.target.value)}
          placeholder="1. e4 e5 2. Nf3 ... or rnbqkbnr/pppppppp/8/..."
        />
        {error ? <p className="pgn-error" role="alert">{error}</p> : null}
        <button type="button" onClick={onLoad}>
          Load into board
        </button>
      </section>
    </>
  )
}

function sourceName(source: GameSource) {
  if (source === 'chess.com') return 'Chess.com'
  if (source === 'lichess') return 'Lichess'
  return 'Tournament Games'
}

function externalUsernameForSource(profile: AuthProfile | null, source: GameSource) {
  if (source === 'chess.com') return profile?.chessComUsername?.trim() ?? ''
  if (source === 'lichess') return profile?.lichessUsername?.trim() ?? ''
  return ''
}

function loadReviewEngineStrength(): ReviewEngineStrength {
  const saved = window.localStorage.getItem(engineStrengthStorageKey)
  const appliedDefaultVersion = window.localStorage.getItem(engineDefaultVersionKey)
  if (saved === 'balanced' && appliedDefaultVersion !== engineDefaultVersion) {
    return defaultReviewEngineStrength
  }
  return reviewEnginePresets.some((preset) => preset.id === saved)
    ? saved as ReviewEngineStrength
    : defaultReviewEngineStrength
}

function getCurrentEval(
  review: GameReviewResult | null,
  moveIdx: number,
) {
  return review?.positions[Math.min(moveIdx + 1, review.positions.length - 1)]?.evaluation ?? 0
}

function buildEvalArea(evals: number[]) {
  if (!evals.length) return 'M0,40 L300,40 L300,80 L0,80 Z'
  const maxIndex = Math.max(1, evals.length - 1)
  const path = ['M0,40']

  evals.forEach((score, index) => {
    const x = (index / maxIndex) * 300
    const y = 40 - Math.max(-38, Math.min(38, score * 6.5))
    path.push(`L${x.toFixed(1)},${y.toFixed(1)}`)
  })

  path.push('L300,80 L0,80 Z')
  return path.join(' ')
}

function buildEvalCursor(evals: number[], moveIdx: number) {
  if (!evals.length) return 0
  const maxIndex = Math.max(1, evals.length - 1)
  return (Math.min(moveIdx, evals.length - 1) / maxIndex) * 300
}

function buildEvalDots(review: GameReviewResult) {
  const maxIndex = Math.max(1, review.moves.length - 1)
  return review.moves.map((move, index) => ({
    color: classificationColors[move.classification],
    index,
    key: `${index}-${move.uci}`,
    x: (index / maxIndex) * 300,
    y: 40 - Math.max(-38, Math.min(38, move.evaluation * 6.5)),
  }))
}

function reviewFeedback(move: ReviewedMove) {
  const messages: Record<ReviewClassification, string> = {
    Brilliant: `${move.san} is brilliant`,
    Great: `${move.san} is a great move`,
    Book: `${move.san} follows opening theory`,
    Best: `${move.san} is the best move`,
    Excellent: `${move.san} is excellent`,
    Good: `${move.san} is a good move`,
    Inaccuracy: `${move.san} is an inaccuracy`,
    Mistake: `${move.san} is a mistake`,
    Miss: `${move.san} misses a strong opportunity`,
    Blunder: `${move.san} is a blunder`,
    Forced: `${move.san} was the only move`,
  }
  return messages[move.classification]
}

function buildClassCounts(review: GameReviewResult) {
  const counts = classificationOrder.map((label) => {
    let white = 0
    let black = 0

    review.moves.forEach((move, index) => {
      if (move.classification !== label) return
      if (index % 2 === 0) {
        white += 1
      } else {
        black += 1
      }
    })

    return {
      label,
      white,
      black,
      color: classificationColors[label],
    }
  })

  return counts.filter((count) => count.label !== 'Forced' || count.white + count.black > 0)
}

function buildMoveRows(
  game: SampleGame,
  review: GameReviewResult | null,
  moveIdx: number,
  setMoveIdx: (updater: number) => void,
) {
  const rows = []

  for (let index = 0; index < game.moves.length; index += 2) {
    const whiteClass = review?.moves[index]?.classification
    const blackClass = review?.moves[index + 1]?.classification

    rows.push({
      number: index / 2 + 1,
      whiteMove: game.moves[index],
      whiteClass,
      whiteSelected: moveIdx === index,
      onWhite: () => setMoveIdx(index),
      blackMove: game.moves[index + 1] || '',
      blackClass,
      blackSelected: moveIdx === index + 1,
      onBlack: () => setMoveIdx(index + 1),
    })
  }

  return rows
}

function parseRating(value?: string) {
  const rating = Number.parseInt(value ?? '', 10)
  return Number.isFinite(rating) ? rating : 1200
}

function formatPgnDate(value?: string) {
  if (!value) return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date())
  const match = /^(\d{4})[.-](\d{2})[.-](\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

function createWorkspaceGame(moves: string[], result: string): SampleGame {
  const id = `workspace-${Date.now()}`
  return {
    bRating: 1200,
    black: 'Black',
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date()),
    fen: startFen,
    id,
    key: id,
    moves,
    opening: 'Analysis board',
    result,
    round: 'Local analysis',
    source: 'tournament',
    wRating: 1200,
    white: 'White',
  }
}

function formatEvaluation(value: number) {
  if (Math.abs(value) >= 99) return value > 0 ? 'M+' : 'M-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatAnalysisEvaluation(analysis: PositionAnalysisResult) {
  if (analysis.source === 'tablebase') {
    if (analysis.tablebase?.winner === 'white') return 'White wins'
    if (analysis.tablebase?.winner === 'black') return 'Black wins'
    if (analysis.tablebase?.winner === 'draw') return 'Draw'
    return 'Tablebase'
  }
  if (analysis.mate !== undefined) return `M${analysis.mate > 0 ? '+' : ''}${analysis.mate}`
  return formatEvaluation(analysis.evaluation)
}

function formatTablebaseLine(analysis: PositionAnalysisResult) {
  const tablebase = analysis.tablebase
  const bestMove = analysis.bestLineSan[0]
  const decisive = tablebase?.winner === 'white' || tablebase?.winner === 'black'
  const distance = decisive && tablebase?.dtm !== null && tablebase?.dtm !== undefined
    ? ` · mate in ${Math.ceil(Math.abs(tablebase.dtm) / 2)}`
    : tablebase?.dtz !== null && tablebase?.dtz !== undefined
      ? ` · zeroing move in ${Math.abs(tablebase.dtz)} plies`
      : ''
  return `${bestMove ? `Best ${bestMove}` : 'No legal continuation'}${distance}`
}

function buildWorkspaceRows(moves: string[]) {
  const rows = []

  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      number: index / 2 + 1,
      whiteMove: moves[index],
      blackMove: moves[index + 1] || '',
    })
  }

  return rows
}

export default GamesPage
