import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Settings2, ShieldAlert, SkipBack, SkipForward, Trophy, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { BoardSettingsPanel } from '../components/BoardSettingsPanel'
import {
  JuCapturedPieces,
  JuChessBoard,
  type JuChessBoardChange,
} from '../components/JuChessBoard'
import { GameChat } from '../components/GameChat'
import { getJuChessBoardSummary, type JuCapturedPiece } from '../components/JuChessRules'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { useTournamentPlay } from '../context/useTournamentPlay'
import { useBoardPreferences } from '../hooks/useBoardPreferences'
import { useFairPlayMonitor } from '../hooks/useFairPlayMonitor'
import type { JuPieceTheme } from '../lib/boardAppearance'
import {
  loadTournamentGame,
  loadTournaments,
  parseStoredMoves,
  subscribeToTournamentGameRow,
  type SampleGame,
  type Tournament,
  type TournamentGame,
} from '../lib/juchess'
import {
  clearOnlineTournamentPlayLock,
  setOnlineTournamentPlayLock,
} from '../lib/onlineTournamentPlayLock'
import {
  resignHostedTournamentGame,
  submitHostedTournamentMove,
  syncHostedTournamentGame,
  type HostedClockSnapshot,
  type HostedGameRow,
} from '../lib/onlineTournament'
import { applyOptimisticHostedMove } from '../lib/onlineTournamentOptimism'
import './OnlineGamesPage.css'

type TournamentGameChoice = {
  game: TournamentGame
  tournament: Tournament
}

const LIVE_GAME_POLL_MS = 1_000

function OnlineGamesPage() {
  const { profile } = useAuth()
  const {
    activeGame,
    activeTournament,
    error: assignmentError,
    refresh: refreshActiveGame,
  } = useTournamentPlay()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedGameId = searchParams.get('game')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<SampleGame | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(requestedGameId)
  const [boardMoves, setBoardMoves] = useState<string[]>([])
  const [viewedPly, setViewedPly] = useState<number | null>(null)
  const [boardResult, setBoardResult] = useState('Live')
  const [flipped, setFlipped] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  const [movePending, setMovePending] = useState(false)
  const [message, setMessage] = useState('')
  const [, setClockTick] = useState(0)
  const orientedGameRef = useRef<string | null>(null)
  const latestSnapshotRef = useRef<{ gameId: string; moveVersion: number } | null>(null)
  const pendingMoveRef = useRef<{ expectedVersion: number; gameId: string } | null>(null)
  const dueGameId = activeGame?.$id

  const applySelectedGame = useCallback((game: SampleGame) => {
    const moveVersion = game.moveVersion ?? 0
    const previous = latestSnapshotRef.current
    if (previous?.gameId === game.id && moveVersion < previous.moveVersion) return false
    const pending = pendingMoveRef.current
    if (pending?.gameId === game.id && moveVersion <= pending.expectedVersion) return false

    latestSnapshotRef.current = { gameId: game.id, moveVersion }
    setSelectedGame(game)
    setSelectedGameId(game.id)
    setBoardMoves(game.moves)
    setBoardResult(game.result)
    return true
  }, [])

  const openTournamentGame = useCallback(async (gameId: string, updateUrl = true) => {
    let game = await loadTournamentGame(gameId)
    if (game) {
      const assignedPlayer = Boolean(
        profile?.$id
        && (game.whiteProfileId === profile.$id || game.blackProfileId === profile.$id),
      )
      if (assignedPlayer && (game.status === 'scheduled' || game.status === 'live')) {
        const snapshot = await syncHostedTournamentGame(gameId).catch(() => null)
        if (snapshot) game = applyHostedSnapshot(game, snapshot.row, snapshot.clock)
      }
      applySelectedGame(game)
      if (updateUrl) setSearchParams({ game: gameId })
    } else if (dueGameId !== gameId) {
      clearOnlineTournamentPlayLock(gameId)
    }
  }, [applySelectedGame, dueGameId, profile?.$id, setSearchParams])

  useEffect(() => {
    let alive = true
    loadTournaments().then((result) => {
      if (!alive) return
      setTournaments(result.tournaments)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const onlineTournaments = useMemo(
    () => tournaments.filter((tournament) => (
      tournament.playMode === 'online'
      && (tournament.status === 'Upcoming' || tournament.status === 'Active')
    )).sort((left, right) => {
      if (left.status !== right.status) return left.status === 'Active' ? -1 : 1
      return left.name.localeCompare(right.name)
    }),
    [tournaments],
  )
  const activeHostedTournaments = useMemo(
    () => onlineTournaments.filter((tournament) => (
      tournament.status === 'Active' && tournament.onlinePlatform === 'juchess'
    )),
    [onlineTournaments],
  )
  const gameChoices = useMemo<TournamentGameChoice[]>(() => (
    activeHostedTournaments.flatMap((tournament) => (
      (tournament.publishedGames ?? [])
        .filter((game) => (
          (game.status === 'scheduled' || game.status === 'live')
          && (!tournament.currentRound || game.round === tournament.currentRound)
        ))
        .map((game) => ({ game, tournament }))
    ))
  ), [activeHostedTournaments])

  useEffect(() => {
    if (!requestedGameId) return
    void openTournamentGame(requestedGameId, false)
  }, [openTournamentGame, requestedGameId])

  useEffect(() => {
    if (!selectedGameId || (selectedGame?.status !== 'scheduled' && selectedGame?.status !== 'live')) return

    let unsubscribe: (() => void) | undefined
    let alive = true
    const refresh = () => void openTournamentGame(selectedGameId, false)
    const timer = window.setInterval(refresh, LIVE_GAME_POLL_MS)
    void subscribeToTournamentGameRow(selectedGameId, refresh)
      .then((stop) => {
        if (alive) unsubscribe = stop
        else stop()
      })
      .catch(() => {
        // The fallback refresh keeps the board current if Realtime is blocked.
      })
    return () => {
      alive = false
      window.clearInterval(timer)
      unsubscribe?.()
    }
  }, [openTournamentGame, selectedGame?.status, selectedGameId])

  useEffect(() => {
    if (!selectedGame || (selectedGame.status !== 'scheduled' && selectedGame.status !== 'live')) return
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [selectedGame])

  useEffect(() => {
    if (!dueGameId || dueGameId !== selectedGameId) return
    if (selectedGame?.status === 'completed' || selectedGame?.status === 'forfeit') {
      void refreshActiveGame()
    }
  }, [dueGameId, refreshActiveGame, selectedGame?.status, selectedGameId])

  async function updateBoard(state: JuChessBoardChange) {
    if (!selectedGameId || !selectedGame || movePending || !state.lastMove) return
    const gameId = selectedGameId
    const expectedVersion = selectedGame.moveVersion ?? 0
    const optimisticGame = applyOptimisticHostedMove(
      selectedGame,
      state.moves,
      state.result,
      Date.now(),
    )
    setSelectedGame(optimisticGame)
    setBoardMoves(state.moves)
    setBoardResult(state.result)
    pendingMoveRef.current = { expectedVersion, gameId }
    setMovePending(true)
    setMessage('')
    try {
      const response = await submitHostedTournamentMove(
        gameId,
        state.lastMove,
        expectedVersion,
      )
      pendingMoveRef.current = null
      const canonicalGame = applyHostedSnapshot(optimisticGame, response.row, response.clock)
      applySelectedGame(canonicalGame)
      setMessage(response.requiresTiebreak ? 'Draw recorded. The organizer must resolve the knockout tiebreak.' : '')
      if (response.row.status === 'completed' || response.row.status === 'forfeit') {
        await refreshActiveGame()
      }
    } catch (error) {
      pendingMoveRef.current = null
      setMessage(error instanceof Error ? error.message : 'The game server rejected this move.')
      await openTournamentGame(gameId, false)
      await refreshActiveGame()
    } finally {
      setMovePending(false)
    }
  }

  async function resignGame() {
    if (!selectedGameId || !assignedParticipant || movePending) return
    if (!window.confirm('Resign this tournament game? This cannot be undone.')) return
    setMovePending(true)
    try {
      await resignHostedTournamentGame(selectedGameId)
      setMessage('Game resigned.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not resign this game.')
    } finally {
      await openTournamentGame(selectedGameId, false)
      await refreshActiveGame()
      setMovePending(false)
    }
  }

  const watchingTournament = Boolean(selectedGame)
  const profileId = profile?.$id
  const assignedColor = selectedGame?.whiteProfileId === profileId
    ? 'white'
    : selectedGame?.blackProfileId === profileId
    ? 'black'
    : null
  const turnColor = selectedGame?.turn ?? (boardMoves.length % 2 === 0 ? 'white' : 'black')
  const isParticipant = Boolean(assignedColor && selectedGame)
  const assignedParticipant = Boolean(isParticipant && selectedGame && (selectedGame.status === 'scheduled' || selectedGame.status === 'live'))
  const preGameCountdown = selectedGame?.status === 'scheduled'
    ? deadlineCountdown(selectedGame.scheduledStartAt, 'Starting…')
    : null
  const preGameActive = Boolean(preGameCountdown && !preGameCountdown.expired)
  const canMove = Boolean(assignedParticipant && !preGameActive && assignedColor === turnColor && !movePending)
  const playingOnlineTournament = Boolean(dueGameId && dueGameId === selectedGameId)

  useFairPlayMonitor(selectedGameId, assignedParticipant)

  useEffect(() => {
    if (assignedParticipant && selectedGameId) setOnlineTournamentPlayLock(selectedGameId)
    else if (selectedGameId) clearOnlineTournamentPlayLock(selectedGameId)
  }, [assignedParticipant, selectedGameId])

  useEffect(() => {
    if (!selectedGameId || !assignedColor || orientedGameRef.current === selectedGameId) return
    setFlipped(assignedColor === 'black')
    orientedGameRef.current = selectedGameId
  }, [assignedColor, selectedGameId])
  useEffect(() => {
    setViewedPly(null)
  }, [selectedGameId])
  const displayedPly = viewedPly === null ? boardMoves.length : Math.min(viewedPly, boardMoves.length)
  const displayedMoves = useMemo(() => boardMoves.slice(0, displayedPly), [boardMoves, displayedPly])
  const boardSummary = useMemo(() => getJuChessBoardSummary(undefined, displayedMoves), [displayedMoves])
  const viewingLatest = displayedPly === boardMoves.length
  const topSide = flipped ? 'white' : 'black'
  const bottomSide = flipped ? 'black' : 'white'

  const playerFor = (side: 'white' | 'black') => ({
    captured: boardSummary.captured[side],
    clock: hostedClockState(selectedGame, side, turnColor),
    name: side === 'white' ? selectedGame?.white ?? 'White' : selectedGame?.black ?? 'Black',
    side,
  })
  const firstMoveCountdown = selectedGame?.status === 'scheduled'
    ? deadlineCountdown(selectedGame.firstMoveDeadlineAt, 'Confirming forfeit…')
    : null
  const opponentName = assignedColor === 'white' ? selectedGame?.black : selectedGame?.white

  return (
    <div className="club-screen online-games-screen" data-screen-label="Games">
      <SiteHeader active="games" toolsDisabled={playingOnlineTournament} />
      <main className="online-games-main">
        {playingOnlineTournament ? (
          <div className="forced-game-banner" role="status">
            <ShieldAlert size={19} aria-hidden="true" />
            <div>
              <strong>Your tournament pairing is ready</strong>
              <span>
                {activeTournament?.name || selectedGame?.tournamentName || 'Online tournament'} ·
                {' '}analysis, review tools, and other pages stay locked until this game finishes.
              </span>
            </div>
          </div>
        ) : assignmentError && dueGameId ? (
          <div className="forced-game-banner warning" role="status">{assignmentError}</div>
        ) : null}

        <div className="online-games-layout">
          <section className="online-board-station" aria-label="Chess board">
            <div className="online-board-toolbar">
              <div className="online-board-head-actions">
                <button
                  type="button"
                  aria-expanded={settingsOpen}
                  aria-label="Board settings"
                  className={settingsOpen ? 'active' : undefined}
                  title="Board settings"
                  onClick={() => setSettingsOpen((current) => !current)}
                >
                  <Settings2 size={17} aria-hidden="true" />
                </button>
              </div>
            </div>

            {settingsOpen ? (
              <BoardSettingsPanel
                arrowColor={arrowColor}
                boardTheme={boardTheme}
                className="online-board-settings"
                flipped={flipped}
                markColor={markColor}
                onArrowColorChange={setArrowColor}
                onBoardThemeChange={setBoardTheme}
                onClose={() => setSettingsOpen(false)}
                onFlip={() => setFlipped((current) => !current)}
                onMarkColorChange={setMarkColor}
                onPieceThemeChange={setPieceTheme}
                pieceTheme={pieceTheme}
              />
            ) : null}

            {preGameCountdown && !preGameCountdown.expired ? (
              <div className="first-move-deadline" role="status">
                <span>Get ready · game starts in</span>
                <strong>{preGameCountdown.label}</strong>
              </div>
            ) : firstMoveCountdown ? (
              <div className={firstMoveCountdown.expired ? 'first-move-deadline expired' : 'first-move-deadline'}>
                <span>White must make the first move</span>
                <strong>{firstMoveCountdown.label}</strong>
              </div>
            ) : null}

            <PlayerStrip {...playerFor(topSide)} edge="top" pieceTheme={pieceTheme} />
            <JuChessBoard
              annotationsEnabled={!playingOnlineTournament}
              arrowColor={arrowColor}
              boardTheme={boardTheme}
              className="online-ju-board"
              flipped={flipped}
              interactive={Boolean(watchingTournament && viewingLatest && canMove)}
              markColor={markColor}
              moves={displayedMoves}
              onChange={updateBoard}
              pieceTheme={pieceTheme}
              showEvaluation={false}
            />
            <PlayerStrip
              {...playerFor(bottomSide)}
              edge="bottom"
              pieceTheme={pieceTheme}
              center={(
                <div className="online-move-navigation" aria-label="Move navigation">
                  <button type="button" aria-label="Go to first move" disabled={displayedPly === 0} onClick={() => setViewedPly(0)} title="Go to start">
                    <SkipBack size={18} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Previous move" disabled={displayedPly === 0} onClick={() => setViewedPly(Math.max(0, displayedPly - 1))} title="Previous move">
                    <ChevronLeft size={19} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Next move" disabled={viewingLatest} onClick={() => {
                    const nextPly = Math.min(boardMoves.length, displayedPly + 1)
                    setViewedPly(nextPly === boardMoves.length ? null : nextPly)
                  }} title="Next move">
                    <ChevronRight size={19} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Go to latest move" disabled={viewingLatest} onClick={() => setViewedPly(null)} title="Go to latest move">
                    <SkipForward size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            />

            <div className="online-board-controls">
              <span>
                {!viewingLatest
                  ? `Move ${displayedPly} of ${boardMoves.length}`
                  : movePending
                  ? 'Saving move...'
                  : preGameActive
                    ? `Get ready · ${preGameCountdown?.label}`
                  : assignedParticipant
                    ? selectedGame?.status === 'scheduled' && assignedColor === 'black'
                      ? 'Waiting for White to begin'
                      : canMove ? 'Your turn' : 'Opponent to move'
                    : `${boardMoves.length} moves · ${boardResult}`}
              </span>
              {assignedParticipant ? (
                <button className="online-resign-button" type="button" disabled={movePending} onClick={() => void resignGame()}>Resign</button>
              ) : null}
            </div>
            {message ? <p className="online-game-message" role="status">{message}</p> : null}
          </section>

          <aside className="online-tournament-panel" aria-labelledby="play-online-title">
            <div className="online-panel-title">
              <span><Trophy size={18} aria-hidden="true" /></span>
              <div>
                <h2 id="play-online-title">Online tournaments</h2>
                <p>Register for upcoming events, then play or watch here when their boards go live.</p>
              </div>
            </div>

            <div className="online-event-list">
              {loading ? (
                <div className="online-empty">Loading online tournaments...</div>
              ) : onlineTournaments.length ? onlineTournaments.map((tournament) => {
                const choices = gameChoices.filter((choice) => choice.tournament.id === tournament.id)
                const isHostedHere = tournament.onlinePlatform === 'juchess'
                const isActive = tournament.status === 'Active'
                return (
                  <section className="online-event" key={tournament.id}>
                    <div className="online-event-head">
                      <div>
                        <strong>{tournament.name}</strong>
                        <span>{tournament.status} · {onlinePlatformName(tournament)} · {tournament.format}</span>
                      </div>
                      <Link to={`/tournament/${tournament.id}`}>Open</Link>
                    </div>
                    <div className="online-event-meta">
                      <span><Users size={13} aria-hidden="true" /> {tournament.participants} players</span>
                      <span>{tournament.timeControl}</span>
                    </div>
                    {choices.length ? (
                      <div className="online-board-list">
                        {choices.slice(0, 5).map(({ game }) => (
                          <button
                            type="button"
                            className={selectedGameId === game.id ? 'active' : undefined}
                            onClick={() => void openTournamentGame(game.id)}
                            key={game.id}
                          >
                            <span className={game.status === 'live' ? 'live-dot' : undefined} />
                            <strong>{game.white.name} vs {game.black.name}</strong>
                            <small>{game.status === 'live' ? 'Live' : 'Ready'} · Board {game.board}</small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="online-no-boards">
                        {!isActive
                          ? 'Registration is open. Boards will appear here when the tournament starts.'
                          : isHostedHere
                            ? 'Published boards will appear here when play begins.'
                            : `This tournament is hosted on ${onlinePlatformName(tournament)}. Open it for event details.`}
                      </p>
                    )}
                  </section>
                )
              }) : (
                <div className="online-empty">No upcoming or active online tournaments right now.</div>
              )}
            </div>

            {selectedGameId && isParticipant && profile?.$id && opponentName ? (
              <GameChat
                canSend={assignedParticipant}
                currentProfileId={profile.$id}
                gameId={selectedGameId}
                opponentName={opponentName}
                policy={selectedGame?.chatPolicy ?? 'full'}
              />
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  )
}

function onlinePlatformName(tournament: Tournament) {
  if (tournament.onlinePlatform === 'chessCom') return 'Chess.com'
  if (tournament.onlinePlatform === 'lichess') return 'Lichess'
  if (tournament.onlinePlatform === 'juchess') return 'JuChess'
  return 'Online'
}

function PlayerStrip({
  captured,
  center,
  clock,
  edge,
  name,
  pieceTheme,
  side,
}: {
  captured: JuCapturedPiece[]
  center?: ReactNode
  clock?: HostedClockState
  edge: 'bottom' | 'top'
  name: string
  pieceTheme: JuPieceTheme
  side: 'white' | 'black'
}) {
  return (
    <div className={`online-player-strip ${side} ${edge}${center ? ' has-center' : ''}`}>
      <div className="online-player-identity">
        <span>{side === 'white' ? 'W' : 'B'}</span>
        <div className="online-player-copy">
          <strong>{name}</strong>
          <JuCapturedPieces pieces={captured} pieceTheme={pieceTheme} />
        </div>
      </div>
      {center ? <div className="online-player-center">{center}</div> : null}
      <div className="online-player-meta">
        <time className={clock?.tone ?? 'normal'}>{clock?.label ?? '--:--'}</time>
      </div>
    </div>
  )
}

type HostedClockState = {
  label: string
  tone: 'normal' | 'warning' | 'danger'
}

function hostedClockState(
  game: SampleGame | null,
  side: 'white' | 'black',
  turn: 'white' | 'black',
): HostedClockState | undefined {
  const stored = side === 'white' ? game?.whiteTimeMs : game?.blackTimeMs
  const initialMs = parseTimeControlInitialMs(game?.tournamentTimeControl)
  const base = stored ?? initialMs
  if (base === undefined) return undefined
  const runningSince = game?.live && side === turn
    ? game.clockObservedAtMs ?? (game.turnStartedAt ? Date.parse(game.turnStartedAt) : Number.NaN)
    : Number.NaN
  const remaining = Number.isFinite(runningSince) ? Math.max(0, base - (Date.now() - runningSince)) : base
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const thresholds = clockWarningThresholds(initialMs ?? base)
  return {
    label: `${minutes}:${seconds}`,
    tone: remaining <= thresholds.dangerMs
      ? 'danger'
      : remaining <= thresholds.warningMs ? 'warning' : 'normal',
  }
}

function applyHostedSnapshot(
  game: SampleGame,
  row: HostedGameRow,
  clock?: HostedClockSnapshot,
): SampleGame {
  const status = row.status ?? game.status
  const moves = parseStoredMoves(row.pgn ?? game.pgn)
  return {
    ...game,
    blackProfileId: row.blackProfileId ?? game.blackProfileId,
    blackTimeMs: clock?.blackTimeMs ?? row.blackTimeMs ?? game.blackTimeMs,
    clockDeadlineAt: row.clockDeadlineAt ?? game.clockDeadlineAt,
    clockObservedAtMs: clock ? Date.now() : game.clockObservedAtMs,
    firstMoveDeadlineAt: row.firstMoveDeadlineAt ?? game.firstMoveDeadlineAt,
    forfeitedProfileId: row.forfeitedProfileId ?? game.forfeitedProfileId,
    lastMoveAt: row.lastMoveAt ?? game.lastMoveAt,
    live: status === 'live',
    moveVersion: Math.max(game.moveVersion ?? 0, row.moveVersion ?? 0),
    moves,
    pgn: row.pgn ?? game.pgn,
    result: status === 'live' ? 'Live' : row.result ?? game.result,
    scheduledStartAt: row.scheduledStartAt ?? game.scheduledStartAt,
    status,
    terminationReason: row.terminationReason ?? game.terminationReason,
    turn: clock?.turn ?? (moves.length % 2 === 0 ? 'white' : 'black'),
    turnStartedAt: row.turnStartedAt ?? game.turnStartedAt,
    whiteProfileId: row.whiteProfileId ?? game.whiteProfileId,
    whiteTimeMs: clock?.whiteTimeMs ?? row.whiteTimeMs ?? game.whiteTimeMs,
  }
}

function parseTimeControlInitialMs(value?: string) {
  if (!value) return undefined
  const match = value.match(/(\d+(?:\.\d+)?)/)
  if (!match) return undefined
  const minutes = Number(match[1])
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60_000) : undefined
}

function clockWarningThresholds(initialMs: number) {
  if (initialMs <= 3 * 60_000) return { warningMs: 20_000, dangerMs: 10_000 }
  if (initialMs <= 10 * 60_000) return { warningMs: 110_000, dangerMs: 30_000 }
  return { warningMs: 2 * 60_000, dangerMs: 60_000 }
}

function deadlineCountdown(value?: string, expiredLabel = '0:00') {
  if (!value) return null
  const deadline = Date.parse(value)
  if (!Number.isFinite(deadline)) return null
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000))
  return {
    expired: seconds === 0,
    label: seconds === 0
      ? expiredLabel
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
  }
}

export default OnlineGamesPage
