import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlipHorizontal2, Radio, RotateCcw, ShieldAlert, Trophy, Undo2, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { useFairPlayMonitor } from '../hooks/useFairPlayMonitor'
import {
  loadTournamentGame,
  loadTournaments,
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
} from '../lib/onlineTournament'
import './OnlineGamesPage.css'

type TournamentGameChoice = {
  game: TournamentGame
  tournament: Tournament
}

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
  const [boardResult, setBoardResult] = useState('Live')
  const [gameLoading, setGameLoading] = useState(Boolean(requestedGameId))
  const [flipped, setFlipped] = useState(false)
  const [movePending, setMovePending] = useState(false)
  const [message, setMessage] = useState('')
  const [, setClockTick] = useState(0)
  const orientedGameRef = useRef<string | null>(null)
  const dueGameId = activeGame?.$id

  const openTournamentGame = useCallback(async (gameId: string, updateUrl = true) => {
    setGameLoading(true)
    try {
      if (dueGameId === gameId) {
        await syncHostedTournamentGame(gameId).catch(() => null)
      }
      const game = await loadTournamentGame(gameId)
      if (game) {
        setSelectedGame(game)
        setSelectedGameId(gameId)
        setBoardMoves(game.moves)
        setBoardResult(game.result)
        if (updateUrl) setSearchParams({ game: gameId })
      } else if (dueGameId !== gameId) {
        clearOnlineTournamentPlayLock(gameId)
      }
    } finally {
      setGameLoading(false)
    }
  }, [dueGameId, setSearchParams])

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
    const timer = window.setInterval(refresh, 5_000)
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

  function startFreeBoard() {
    if (activeGame) {
      setMessage('Your tournament pairing is due now. Finish that game before opening a free board.')
      return
    }
    clearOnlineTournamentPlayLock()
    setSelectedGame(null)
    setSelectedGameId(null)
    setBoardMoves([])
    setBoardResult('Live')
    setFlipped(false)
    orientedGameRef.current = null
    setSearchParams({})
  }

  async function updateBoard(state: JuChessBoardChange) {
    if (!selectedGameId || !selectedGame || movePending || !state.lastMove) return
    setMovePending(true)
    setMessage('Submitting move...')
    try {
      const response = await submitHostedTournamentMove(
        selectedGameId,
        state.lastMove,
        selectedGame.moveVersion ?? 0,
      )
      setMessage(response.requiresTiebreak ? 'Draw recorded. The organizer must resolve the knockout tiebreak.' : '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The game server rejected this move.')
    } finally {
      await openTournamentGame(selectedGameId, false)
      await refreshActiveGame()
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

  function undoMove() {
    if (selectedGame || !boardMoves.length) return
    setBoardMoves((moves) => moves.slice(0, -1))
    setBoardResult('Live')
  }

  const watchingTournament = Boolean(selectedGame)
  const profileId = profile?.$id
  const assignedColor = selectedGame?.whiteProfileId === profileId
    ? 'white'
    : selectedGame?.blackProfileId === profileId
    ? 'black'
    : null
  const turnColor = boardMoves.length % 2 === 0 ? 'white' : 'black'
  const isParticipant = Boolean(assignedColor && selectedGame)
  const assignedParticipant = Boolean(isParticipant && selectedGame && (selectedGame.status === 'scheduled' || selectedGame.status === 'live'))
  const canMove = Boolean(assignedParticipant && assignedColor === turnColor && !movePending)
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
  const boardSummary = useMemo(() => getJuChessBoardSummary(undefined, boardMoves), [boardMoves])
  const topSide = flipped ? 'white' : 'black'
  const bottomSide = flipped ? 'black' : 'white'

  const playerFor = (side: 'white' | 'black') => ({
    captured: boardSummary.captured[side],
    clock: hostedClockState(selectedGame, side, turnColor),
    name: side === 'white' ? selectedGame?.white ?? 'White' : selectedGame?.black ?? 'Black',
    rating: side === 'white' ? selectedGame?.wRating : selectedGame?.bRating,
    side,
  })
  const firstMoveCountdown = selectedGame?.status === 'scheduled'
    ? deadlineCountdown(selectedGame.firstMoveDeadlineAt)
    : null
  const opponentName = assignedColor === 'white' ? selectedGame?.black : selectedGame?.white

  return (
    <div className="club-screen online-games-screen" data-screen-label="Games">
      <SiteHeader active="games" toolsDisabled={playingOnlineTournament} />
      <main className="online-games-main">
        <header className="online-games-heading">
          <div>
            <span>Club play</span>
            <h1>Games</h1>
            <p>Play an assigned tournament game or watch any published board move by move.</p>
          </div>
          <div className={watchingTournament ? 'online-status live' : 'online-status'}>
            <Radio size={15} aria-hidden="true" />
            {watchingTournament ? selectedGame?.round || 'Tournament game' : 'Free board'}
          </div>
        </header>

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
            <div className="online-board-head">
              <div>
                <strong>{watchingTournament ? 'Tournament board' : 'Play on the board'}</strong>
                <span>{gameLoading ? 'Loading game...' : watchingTournament ? 'Live moves update automatically' : 'Legal chess movement enabled'}</span>
              </div>
              <div className="online-board-head-actions">
                <button type="button" aria-label="Flip board" title="Flip board" onClick={() => setFlipped((current) => !current)}>
                  <FlipHorizontal2 size={17} aria-hidden="true" />
                </button>
                {watchingTournament && !playingOnlineTournament ? (
                  <button type="button" onClick={startFreeBoard}>Free board</button>
                ) : null}
              </div>
            </div>

            {firstMoveCountdown ? (
              <div className={firstMoveCountdown.expired ? 'first-move-deadline expired' : 'first-move-deadline'}>
                <span>White must make the first move</span>
                <strong>{firstMoveCountdown.label}</strong>
              </div>
            ) : null}

            <PlayerStrip {...playerFor(topSide)} edge="top" />
            <JuChessBoard
              annotationsEnabled={!playingOnlineTournament}
              className="online-ju-board"
              flipped={flipped}
              interactive={watchingTournament ? canMove : true}
              moves={boardMoves}
              onChange={watchingTournament ? updateBoard : (state) => {
                setBoardMoves(state.moves)
                setBoardResult(state.result)
              }}
              showEvaluation={false}
            />
            <PlayerStrip {...playerFor(bottomSide)} edge="bottom" />

            <div className="online-board-controls">
              <button type="button" disabled={watchingTournament || !boardMoves.length} onClick={undoMove}>
                <Undo2 size={16} aria-hidden="true" />
                Undo
              </button>
              <span>
                {movePending
                  ? 'Saving move...'
                  : assignedParticipant
                    ? selectedGame?.status === 'scheduled' && assignedColor === 'black'
                      ? 'Waiting for White to begin'
                      : canMove ? 'Your turn' : 'Opponent to move'
                    : `${boardMoves.length} moves · ${boardResult}`}
              </span>
              {assignedParticipant ? (
                <button type="button" disabled={movePending} onClick={() => void resignGame()}>Resign</button>
              ) : null}
              <button
                type="button"
                disabled={playingOnlineTournament || (watchingTournament && gameLoading)}
                onClick={startFreeBoard}
                title={playingOnlineTournament ? 'Finish your assigned tournament game first' : undefined}
              >
                <RotateCcw size={16} aria-hidden="true" />
                New game
              </button>
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
  clock,
  edge,
  name,
  rating,
  side,
}: {
  captured: JuCapturedPiece[]
  clock?: HostedClockState
  edge: 'bottom' | 'top'
  name: string
  rating?: number
  side: 'white' | 'black'
}) {
  return (
    <div className={`online-player-strip ${side} ${edge}`}>
      <span>{side === 'white' ? 'W' : 'B'}</span>
      <div className="online-player-copy">
        <strong>{name}</strong>
        <JuCapturedPieces pieces={captured} />
      </div>
      <div className="online-player-meta">
        {clock ? <time className={clock.tone}>{clock.label}</time> : null}
        <small>{rating ?? 'Unrated'}</small>
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
  const runningSince = game?.live && side === turn && game.turnStartedAt ? Date.parse(game.turnStartedAt) : Number.NaN
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

function deadlineCountdown(value?: string) {
  if (!value) return null
  const deadline = Date.parse(value)
  if (!Number.isFinite(deadline)) return null
  const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1_000))
  return {
    expired: seconds === 0,
    label: seconds === 0
      ? 'Confirming forfeit…'
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
  }
}

export default OnlineGamesPage
