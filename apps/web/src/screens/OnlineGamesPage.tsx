import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlipHorizontal2, Radio, RotateCcw, Trophy, Undo2, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  JuCapturedPieces,
  JuChessBoard,
  type JuChessBoardChange,
} from '../components/JuChessBoard'
import { getJuChessBoardSummary, type JuCapturedPiece } from '../components/JuChessRules'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import {
  loadTournamentGame,
  loadTournaments,
  type SampleGame,
  type Tournament,
  type TournamentGame,
} from '../lib/juchess'
import {
  clearOnlineTournamentPlayLock,
  setOnlineTournamentPlayLock,
} from '../lib/onlineTournamentPlayLock'
import { resignHostedTournamentGame, submitHostedTournamentMove } from '../lib/onlineTournament'
import './OnlineGamesPage.css'

type TournamentGameChoice = {
  game: TournamentGame
  tournament: Tournament
}

function OnlineGamesPage() {
  const { profile } = useAuth()
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

  const openTournamentGame = useCallback(async (gameId: string, updateUrl = true) => {
    setGameLoading(true)
    const game = await loadTournamentGame(gameId)
    if (game) {
      setSelectedGame(game)
      setSelectedGameId(gameId)
      setBoardMoves(game.moves)
      setBoardResult(game.result)
      if (updateUrl) setSearchParams({ game: gameId })
    } else {
      clearOnlineTournamentPlayLock(gameId)
    }
    setGameLoading(false)
  }, [setSearchParams])

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

  const activeTournaments = useMemo(
    () => tournaments.filter((tournament) => (
      tournament.status === 'Active'
      && tournament.playMode === 'online'
      && tournament.onlinePlatform === 'juchess'
    )),
    [tournaments],
  )
  const gameChoices = useMemo<TournamentGameChoice[]>(() => (
    activeTournaments.flatMap((tournament) => (
      (tournament.publishedGames ?? [])
        .filter((game) => (
          (game.status === 'scheduled' || game.status === 'live')
          && (!tournament.currentRound || game.round === tournament.currentRound)
        ))
        .map((game) => ({ game, tournament }))
    ))
  ), [activeTournaments])

  useEffect(() => {
    if (!requestedGameId) return
    void openTournamentGame(requestedGameId, false)
  }, [openTournamentGame, requestedGameId])

  useEffect(() => {
    if (!selectedGameId || (selectedGame?.status !== 'scheduled' && selectedGame?.status !== 'live')) return

    const timer = window.setInterval(() => {
      void openTournamentGame(selectedGameId, false)
    }, 1200)
    return () => window.clearInterval(timer)
  }, [openTournamentGame, selectedGame?.status, selectedGameId])

  useEffect(() => {
    if (!selectedGame?.live || !selectedGame.turnStartedAt) return
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [selectedGame?.live, selectedGame?.turnStartedAt])

  function startFreeBoard() {
    clearOnlineTournamentPlayLock()
    setSelectedGame(null)
    setSelectedGameId(null)
    setBoardMoves([])
    setBoardResult('Live')
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
  const assignedParticipant = Boolean(assignedColor && selectedGame && (selectedGame.status === 'scheduled' || selectedGame.status === 'live'))
  const canMove = Boolean(assignedParticipant && assignedColor === turnColor && !movePending)
  const playingOnlineTournament = assignedParticipant

  useEffect(() => {
    if (assignedParticipant && selectedGameId) setOnlineTournamentPlayLock(selectedGameId)
    else if (selectedGameId) clearOnlineTournamentPlayLock(selectedGameId)
  }, [assignedParticipant, selectedGameId])
  const boardSummary = useMemo(() => getJuChessBoardSummary(undefined, boardMoves), [boardMoves])
  const topSide = flipped ? 'white' : 'black'
  const bottomSide = flipped ? 'black' : 'white'

  const playerFor = (side: 'white' | 'black') => ({
    captured: boardSummary.captured[side],
    clock: hostedClockLabel(selectedGame, side, turnColor),
    name: side === 'white' ? selectedGame?.white ?? 'White' : selectedGame?.black ?? 'Black',
    rating: side === 'white' ? selectedGame?.wRating : selectedGame?.bRating,
    side,
  })

  return (
    <div className="club-screen online-games-screen" data-screen-label="Games">
      <SiteHeader active="games" toolsDisabled={playingOnlineTournament} />
      <main className="online-games-main">
        <header className="online-games-heading">
          <div>
            <span>Club play</span>
            <h1>Games</h1>
            <p>Use the board freely or open a published tournament game and follow every live move.</p>
          </div>
          <div className={watchingTournament ? 'online-status live' : 'online-status'}>
            <Radio size={15} aria-hidden="true" />
            {watchingTournament ? selectedGame?.round || 'Tournament game' : 'Free board'}
          </div>
        </header>

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
                {watchingTournament ? (
                  <button type="button" onClick={startFreeBoard}>Free board</button>
                ) : null}
              </div>
            </div>

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
              <span>{movePending ? 'Saving move...' : assignedParticipant ? canMove ? 'Your turn' : 'Opponent to move' : `${boardMoves.length} moves · ${boardResult}`}</span>
              {assignedParticipant ? (
                <button type="button" disabled={movePending} onClick={() => void resignGame()}>Resign</button>
              ) : null}
              <button type="button" disabled={watchingTournament && gameLoading} onClick={startFreeBoard}>
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
                <h2 id="play-online-title">Play online tournament</h2>
                <p>Choose an active event, follow its boards, and enter through the tournament page.</p>
              </div>
            </div>

            <div className="online-event-list">
              {loading ? (
                <div className="online-empty">Loading active tournaments...</div>
              ) : activeTournaments.length ? activeTournaments.map((tournament) => {
                const choices = gameChoices.filter((choice) => choice.tournament.id === tournament.id)
                return (
                  <section className="online-event" key={tournament.id}>
                    <div className="online-event-head">
                      <div>
                        <strong>{tournament.name}</strong>
                        <span>{tournament.format} · {tournament.round}</span>
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
                      <p className="online-no-boards">Published boards will appear here when play begins.</p>
                    )}
                  </section>
                )
              }) : (
                <div className="online-empty">No online tournament is active right now.</div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
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
  clock?: string
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
      <small>{clock ? `${clock} · ` : ''}{rating ?? 'Unrated'}</small>
    </div>
  )
}

function hostedClockLabel(game: SampleGame | null, side: 'white' | 'black', turn: 'white' | 'black') {
  const stored = side === 'white' ? game?.whiteTimeMs : game?.blackTimeMs
  if (stored === undefined) return undefined
  const runningSince = game?.live && side === turn && game.turnStartedAt ? Date.parse(game.turnStartedAt) : Number.NaN
  const remaining = Number.isFinite(runningSince) ? Math.max(0, stored - (Date.now() - runningSince)) : stored
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export default OnlineGamesPage
