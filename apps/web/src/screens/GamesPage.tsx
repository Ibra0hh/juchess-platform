import { useEffect, useMemo, useState } from 'react'
import { FlipHorizontal2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
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
  sampleGamesBySource,
  type GameSource,
  type SampleGame,
} from '../lib/juchess'
import {
  parseReviewGame,
  reviewGame,
  StockfishReviewEngine,
  type GameReviewResult,
  type ReviewClassification,
  type ReviewedMove,
} from '../lib/gameReview'
import { loadExternalGames } from '../lib/externalGames'
import './ClubScreens.css'

type GameMode = 'review' | 'analysis'
type WorkspaceStep = 'source' | 'search' | 'list' | 'review' | 'workspace'

type SourceDef = {
  key: GameSource
  name: string
  sub: string
  icon: string
  tone: 'green' | 'blue' | 'wine'
}

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const sourceDefs: SourceDef[] = [
  { key: 'chess.com', name: 'Chess.com', sub: 'Import by username', icon: 'C', tone: 'green' },
  { key: 'lichess', name: 'Lichess', sub: 'Import by username', icon: 'L', tone: 'blue' },
  { key: 'tournament', name: 'Tournament Games', sub: 'Search the club archive', icon: '\u2655', tone: 'wine' },
]

const classificationColors: Record<ReviewClassification, string> = {
  Brilliant: '#1f7a70',
  Great: '#2a5db0',
  Best: '#3f6b36',
  Excellent: '#638a4f',
  Good: '#77946a',
  Inaccuracy: '#a98a3f',
  Mistake: '#b0742a',
  Blunder: '#7a2431',
  Forced: '#8a7b5c',
}

const classificationOrder: ReviewClassification[] = [
  'Brilliant',
  'Great',
  'Best',
  'Excellent',
  'Good',
  'Forced',
  'Inaccuracy',
  'Mistake',
  'Blunder',
]

function GamesPage() {
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
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [workspaceMoves, setWorkspaceMoves] = useState<string[]>([])
  const [workspaceResult, setWorkspaceResult] = useState('Live')
  const [saved, setSaved] = useState(false)
  const [ran, setRan] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [review, setReview] = useState<GameReviewResult | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewProgress, setReviewProgress] = useState({ completed: 0, total: 0 })
  const [workspaceError, setWorkspaceError] = useState('')

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
        if (active) setTournamentArchive(games)
      } finally {
        refreshing = false
      }
    }

    void refreshArchive()
    const timer = window.setInterval(() => void refreshArchive(), 5000)

    return () => {
      active = false
      window.clearInterval(timer)
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

    const timer = window.setInterval(() => void refreshLiveGame(), 3000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [liveCloudGameId, step])

  useEffect(() => {
    setReview(null)
    setReviewError('')
    setReviewLoading(false)
    setReviewProgress({ completed: 0, total: 0 })

    if (step !== 'review' || !game) return
    if (game.live) {
      setReviewError('The live board is still changing. Full engine review becomes available when the game finishes.')
      return
    }
    if (!game.moves.length) {
      setReviewError('This game does not contain any saved moves yet.')
      return
    }

    const engine = new StockfishReviewEngine()
    const controller = new AbortController()
    let active = true
    setReviewLoading(true)
    setReviewProgress({ completed: 0, total: game.moves.length + 1 })

    void reviewGame(
      { fen: game.fen, moves: game.moves },
      engine,
      {
        depth: 11,
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (active) setReviewProgress({ completed, total })
        },
      },
    ).then((result) => {
      if (!active) return
      setReview(result)
      setReviewLoading(false)
    }).catch((error: unknown) => {
      if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
      setReviewError(error instanceof Error ? error.message : 'The engine could not review this game.')
      setReviewLoading(false)
    }).finally(() => engine.dispose())

    return () => {
      active = false
      controller.abort()
      engine.dispose()
    }
  }, [game, step])

  useEffect(() => {
    if (step !== 'review' || !game) return

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
  }, [game, step])

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
  const workspaceGame = workspaceLoaded ? game || sampleGamesBySource['chess.com'][0] : null
  const boardGame = inReview ? game : inWorkspace ? workspaceGame : null
  const evalNow = getCurrentEval(review, inReview, inWorkspace, workspaceLoaded, moveIdx)
  const boardMoves = inReview && game
    ? game.moves.slice(0, moveIdx + 1)
    : inWorkspace
      ? workspaceMoves
      : []
  const boardFen = boardMoves.length ? undefined : boardGame?.fen || startFen
  const boardSummary = getJuChessBoardSummary(boardFen, boardMoves)
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
  const workspaceRows = buildWorkspaceRows(workspaceMoves)

  const openSource = (nextSource: GameSource) => {
    setSource(nextSource)
    setSelectedKey(null)
    setSearchText('')
    setSourceGames([])
    setSearchError('')
    setSearchLoading(false)
    setStep('search')
  }

  const searchSourceGames = async () => {
    if (!source || searchLoading) return
    setSelectedKey(null)
    setSearchError('')

    if (source === 'tournament') {
      setStep('list')
      return
    }

    setSearchLoading(true)
    try {
      const games = await loadExternalGames(source, searchText)
      setSourceGames(games)
      setStep('list')
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : `${sourceName(source)} games could not be loaded.`)
    } finally {
      setSearchLoading(false)
    }
  }

  const startSelectedGame = () => {
    if (!selectedGame) return

    setGame(selectedGame)
    setMoveIdx(Math.max(0, selectedGame.moves.length - 1))
    setSaved(false)
    setRan(mode === 'analysis')
    setWorkspaceLoaded(mode === 'analysis')
    setWorkspaceMoves(mode === 'analysis' ? selectedGame.moves : [])
    setWorkspaceResult(selectedGame.result)
    setStep(mode === 'review' ? 'review' : 'workspace')
  }

  const openBlankBoard = () => {
    setGame(null)
    setWorkspaceLoaded(false)
    setWorkspaceMoves([])
    setWorkspaceResult('Live')
    setSaved(false)
    setRan(false)
    setStep('workspace')
  }

  const loadPgn = () => {
    if (!pgnText.trim()) return
    try {
      const parsed = parseReviewGame({ pgn: pgnText })
      const importedId = `imported-${Date.now()}`
      const importedGame: SampleGame = {
        bRating: parseRating(parsed.headers.BlackElo),
        black: parsed.headers.Black || 'Black',
        date: formatPgnDate(parsed.headers.Date),
        fen: parsed.initialFen,
        id: importedId,
        key: importedId,
        moves: parsed.moves,
        opening: parsed.headers.Opening || parsed.headers.ECO || 'Imported PGN',
        pgn: pgnText,
        result: parsed.headers.Result || '*',
        round: parsed.headers.Round ? `Round ${parsed.headers.Round}` : 'Imported game',
        source: 'tournament',
        wRating: parseRating(parsed.headers.WhiteElo),
        white: parsed.headers.White || 'White',
      }
      setGame(importedGame)
      setWorkspaceLoaded(true)
      setWorkspaceMoves(parsed.moves)
      setWorkspaceResult(importedGame.result)
      setWorkspaceError('')
      setRan(false)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'The PGN could not be read.')
    }
  }

  const updateWorkspaceBoard = (state: JuChessBoardChange) => {
    setWorkspaceMoves(state.moves)
    setWorkspaceResult(state.result)
    setWorkspaceLoaded(true)
  }

  return (
    <div className="club-screen games-screen" data-screen-label="Tools Workspace">
      <SiteHeader active="tools" />
      <main className="games-main">
        <section className="board-column" aria-label="Board area">
          <div className="board-title-row">
            <h1>{inReview ? 'Game review' : inWorkspace ? 'Analysis board' : isReviewMode ? 'Review room' : 'Analysis room'}</h1>
            <div className="board-title-actions">
              <span>{boardGame ? boardGame.round || boardGame.date : 'Standard position'}</span>
              <button type="button" aria-label="Flip board" title="Flip board" onClick={() => setFlipped((current) => !current)}>
                <FlipHorizontal2 aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="board-player-frame">
            <PlayerBar {...topPlayer} edge="top" />

            <div className="board-wrap">
              <JuChessBoard
                className="games-ju-board"
                evaluation={evalNow}
                fen={boardFen}
                flipped={flipped}
                interactive={inWorkspace}
                moves={boardMoves}
                onChange={inWorkspace ? updateWorkspaceBoard : undefined}
              />
            </div>

            <PlayerBar {...bottomPlayer} edge="bottom" />
          </div>

          {inReview && game ? (
            game.moves.length > 0 ? (
              <div className="move-controls" aria-label="Move controls">
                <button type="button" aria-label="Go to start" onClick={() => setMoveIdx(0)}>
                  &laquo;
                </button>
                <button type="button" aria-label="Previous move" onClick={() => setMoveIdx((current) => Math.max(0, current - 1))}>
                  &lsaquo;
                </button>
                <span>
                  Move {moveIdx + 1} / {game.moves.length}
                </span>
                <button
                  type="button"
                  aria-label="Next move"
                  onClick={() => setMoveIdx((current) => Math.min(game.moves.length - 1, current + 1))}
                >
                  &rsaquo;
                </button>
                <button type="button" aria-label="Go to end" onClick={() => setMoveIdx(game.moves.length - 1)}>
                  &raquo;
                </button>
              </div>
            ) : (
              <div className="move-controls" aria-label="Move controls">
                <span>No moves saved yet</span>
              </div>
            )
          ) : null}
        </section>

        <aside className="game-rail" aria-label="Game tools">
          <div className="mode-toggle" role="tablist" aria-label="Games mode">
            <button
              type="button"
              className={isReviewMode ? 'active' : undefined}
              onClick={() => {
                setMode('review')
                setStep('source')
                setGame(null)
                setSelectedKey(null)
                setSource(null)
                setWorkspaceMoves([])
                setWorkspaceResult('Live')
              }}
            >
              Game Review
            </button>
            <button
              type="button"
              className={!isReviewMode ? 'active' : undefined}
              onClick={() => {
                setMode('analysis')
                setStep('source')
                setGame(null)
                setSelectedKey(null)
                setSource(null)
                setWorkspaceMoves([])
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
                setStep('source')
              }}
              error={searchError}
              loading={searchLoading}
              onSearch={() => void searchSourceGames()}
              setSearchText={setSearchText}
            />
          ) : null}

          {step === 'list' && source ? (
            <ListStep
              games={visiblePool}
              isReviewMode={isReviewMode}
              selectedKey={selectedKey}
              sourceLabel={sourceLabel}
              onBack={() => {
                setSelectedKey(null)
                setStep('search')
              }}
              onSelect={setSelectedKey}
              onStart={startSelectedGame}
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
              progress={reviewProgress}
              review={review}
              selectedMove={selectedReviewMove}
              onExit={() => {
                setStep('source')
                setGame(null)
                setSelectedKey(null)
                setSource(null)
              }}
            />
          ) : null}

          {step === 'workspace' ? (
            <WorkspacePanel
              game={workspaceGame}
              error={workspaceError}
              loaded={workspaceLoaded}
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
                setWorkspaceResult('Live')
              }}
              onLoad={loadPgn}
              onNew={() => {
                setWorkspaceLoaded(false)
                setGame(null)
                setPgnText('')
                setWorkspaceMoves([])
                setWorkspaceResult('Live')
                setSaved(false)
                setRan(false)
                setWorkspaceError('')
              }}
              onReview={() => {
                const nextGame = game || createWorkspaceGame(workspaceMoves, workspaceResult)
                setGame(nextGame)
                setMode('review')
                setStep('review')
                setMoveIdx(Math.max(0, nextGame.moves.length - 1))
              }}
              onRun={() => setRan(true)}
              onSave={() => setSaved(true)}
            />
          ) : null}
        </aside>
      </main>
    </div>
  )
}

function PlayerBar({
  badge,
  captured,
  color,
  edge,
  name,
  rating,
}: {
  badge: string
  captured: JuCapturedPiece[]
  color: 'black' | 'white'
  edge: 'bottom' | 'top'
  name: string
  rating?: number
}) {
  return (
    <div className={`player-bar ${color} ${edge}`} aria-label={`${color === 'white' ? 'White' : 'Black'} player: ${name}`}>
      <div className="player-bar-person">
        <i className={color} aria-hidden="true" />
        <div>
          <small>{color}</small>
          <b>{name}</b>
          <JuCapturedPieces pieces={captured} />
        </div>
        {rating ? <em>{rating}</em> : null}
      </div>
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

      {sourceDefs.map((source) => (
        <button
          type="button"
          className="source-card"
          onClick={() => onSource(source.key)}
          key={source.key}
        >
          <span className={`source-icon ${source.tone}`}>{source.icon}</span>
          <span>
            <strong>{source.name}</strong>
            <small>{source.sub}</small>
          </span>
          <em>&rarr;</em>
        </button>
      ))}
    </>
  )
}

function SearchStep({
  error,
  loading,
  onBack,
  onSearch,
  searchText,
  setSearchText,
  source,
  sourceLabel,
}: {
  error: string
  loading: boolean
  onBack: () => void
  onSearch: () => void
  searchText: string
  setSearchText: (value: string) => void
  source: GameSource
  sourceLabel: string
}) {
  const isTournament = source === 'tournament'

  return (
    <section className="rail-panel search-panel">
      <button type="button" className="rail-back" onClick={onBack}>
        &larr; Back
      </button>
      <h2>{sourceLabel}</h2>
      <p>{isTournament ? 'Search by player, event, or round' : `Enter a ${sourceLabel} username`}</p>
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
      <button type="button" className="primary-rail-button" disabled={loading} onClick={onSearch}>
        {loading ? 'Loading games...' : 'Search games'}
      </button>
    </section>
  )
}

function ListStep({
  games,
  isReviewMode,
  onBack,
  onSelect,
  onStart,
  selectedKey,
  sourceLabel,
}: {
  games: SampleGame[]
  isReviewMode: boolean
  onBack: () => void
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
  onExit,
  progress,
  review,
  selectedMove,
}: {
  classCounts: ReturnType<typeof buildClassCounts>
  error: string
  evalArea: string
  evalCursorX: number
  game: SampleGame
  loading: boolean
  moveRows: ReturnType<typeof buildMoveRows>
  onExit: () => void
  progress: { completed: number; total: number }
  review: GameReviewResult | null
  selectedMove?: ReviewedMove
}) {
  const progressPercent = progress.total
    ? Math.round(progress.completed / progress.total * 100)
    : 0

  return (
    <>
      <section className="rail-panel review-panel">
        <div className="rail-heading">
          <span>Game review</span>
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
        {review ? (
          <>
            <svg viewBox="0 0 300 80" className="eval-graph" preserveAspectRatio="none" aria-label="Evaluation graph">
              <path d={evalArea} />
              <line x1="0" y1="40" x2="300" y2="40" />
              <line className="cursor" x1={evalCursorX} y1="0" x2={evalCursorX} y2="80" />
            </svg>
            {selectedMove ? (
              <div className="review-move-detail">
                <div>
                  <span>{selectedMove.classification}</span>
                  <strong>{formatEvaluation(selectedMove.evaluation)}</strong>
                </div>
                <p>
                  Played <b>{selectedMove.san}</b>
                  {selectedMove.bestMoveSan ? <> · Best <b>{selectedMove.bestMoveSan}</b></> : null}
                </p>
                <small>{selectedMove.bestLine.slice(0, 8).join(' ') || 'Game over'}</small>
              </div>
            ) : null}
            <div className="accuracy-grid">
              <div>
                <span>White accuracy</span>
                <strong>{review.whiteAccuracy.toFixed(1)}%</strong>
              </div>
              <div>
                <span>Black accuracy</span>
                <strong>{review.blackAccuracy.toFixed(1)}%</strong>
              </div>
            </div>
            <div className="class-counts">
              {classCounts.map((count) => (
                <div key={count.label}>
                  <span style={{ color: count.color }}>{count.label}</span>
                  <em>{count.white}</em>
                  <em>{count.black}</em>
                  <i>
                    <b style={{ background: count.color, width: `${count.percent}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="moves-panel">
        <h2>Moves - {game.opening}</h2>
        <div className="move-list-scroll">
          {moveRows.map((row) => (
            <div className="move-row" key={row.number}>
              <span>{row.number}.</span>
              <button type="button" className={row.whiteSelected ? 'selected' : undefined} onClick={row.onWhite}>
                <strong>{row.whiteMove}</strong>
                <em style={{ color: row.whiteColor }}>{row.whiteTag}</em>
              </button>
              {row.blackMove ? (
                <button type="button" className={row.blackSelected ? 'selected' : undefined} onClick={row.onBlack}>
                  <strong>{row.blackMove}</strong>
                  <em style={{ color: row.blackColor }}>{row.blackTag}</em>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function WorkspacePanel({
  error,
  game,
  loaded,
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
  error: string
  game: SampleGame | null
  loaded: boolean
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
  const engineEval = ran ? (loaded ? '+0.4' : '+0.2') : '-'
  const engineLine = ran
    ? loaded
      ? '18. Qb3 Qd7 19. Rae1 Rhe8 20. Rxe8 Rxe8'
      : '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3'
    : 'Press Run to start the engine'

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
            <span>depth 22</span>
          </div>
          <p>{engineLine}</p>
        </div>
        <div className="workspace-opening">
          <strong>{loaded && game ? game.opening : 'Starting position'}</strong>
          <span>ECO C50</span>
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
            {ran ? 'Running...' : 'Run'}
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

function getCurrentEval(
  review: GameReviewResult | null,
  inReview: boolean,
  inWorkspace: boolean,
  workspaceLoaded: boolean,
  moveIdx: number,
) {
  if (inReview) return review?.positions[Math.min(moveIdx + 1, review.positions.length - 1)]?.evaluation ?? 0
  if (inWorkspace) return workspaceLoaded ? 0.4 : 0.2
  return 0.2
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

function buildClassCounts(review: GameReviewResult) {
  return classificationOrder.map((label) => {
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
      percent: review.moves.length ? (white + black) / review.moves.length * 100 : 0,
    }
  }).filter((count) => count.white + count.black > 0)
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
      whiteTag: whiteClass ?? '',
      whiteColor: whiteClass ? classificationColors[whiteClass] : '#8a7b5c',
      whiteSelected: moveIdx === index,
      onWhite: () => setMoveIdx(index),
      blackMove: game.moves[index + 1] || '',
      blackTag: blackClass ?? '',
      blackColor: blackClass ? classificationColors[blackClass] : '#8a7b5c',
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
