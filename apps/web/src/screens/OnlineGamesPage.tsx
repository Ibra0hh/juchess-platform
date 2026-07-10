import { useCallback, useEffect, useMemo, useState } from 'react'
import { Radio, RotateCcw, Trophy, Undo2, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { JuChessBoard, type JuChessBoardChange } from '../components/JuChessBoard'
import SiteHeader from '../components/SiteHeader'
import {
  loadTournamentGame,
  loadTournaments,
  type SampleGame,
  type Tournament,
  type TournamentGame,
} from '../lib/juchess'
import './OnlineGamesPage.css'

type TournamentGameChoice = {
  game: TournamentGame
  tournament: Tournament
}

function OnlineGamesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedGameId = searchParams.get('game')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<SampleGame | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(requestedGameId)
  const [boardMoves, setBoardMoves] = useState<string[]>([])
  const [boardResult, setBoardResult] = useState('Live')
  const [gameLoading, setGameLoading] = useState(Boolean(requestedGameId))

  const openTournamentGame = useCallback(async (gameId: string, updateUrl = true) => {
    setGameLoading(true)
    const game = await loadTournamentGame(gameId)
    if (game) {
      setSelectedGame(game)
      setSelectedGameId(gameId)
      setBoardMoves(game.moves)
      setBoardResult(game.result)
      if (updateUrl) setSearchParams({ game: gameId })
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
    () => tournaments.filter((tournament) => tournament.status === 'Active' && tournament.playMode === 'online'),
    [tournaments],
  )
  const gameChoices = useMemo<TournamentGameChoice[]>(() => (
    activeTournaments.flatMap((tournament) => (
      (tournament.publishedGames ?? [])
        .filter((game) => game.status === 'live')
        .map((game) => ({ game, tournament }))
    ))
  ), [activeTournaments])

  useEffect(() => {
    if (!requestedGameId) return
    void openTournamentGame(requestedGameId, false)
  }, [openTournamentGame, requestedGameId])

  useEffect(() => {
    if (!selectedGameId || !selectedGame?.live) return

    const timer = window.setInterval(() => {
      void openTournamentGame(selectedGameId, false)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [openTournamentGame, selectedGame?.live, selectedGameId])

  function startFreeBoard() {
    setSelectedGame(null)
    setSelectedGameId(null)
    setBoardMoves([])
    setBoardResult('Live')
    setSearchParams({})
  }

  function updateBoard(state: JuChessBoardChange) {
    setBoardMoves(state.moves)
    setBoardResult(state.result)
  }

  function undoMove() {
    if (selectedGame || !boardMoves.length) return
    setBoardMoves((moves) => moves.slice(0, -1))
    setBoardResult('Live')
  }

  const watchingTournament = Boolean(selectedGame)

  return (
    <div className="club-screen online-games-screen" data-screen-label="Games">
      <SiteHeader active="games" />
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
              {watchingTournament ? (
                <button type="button" onClick={startFreeBoard}>Free board</button>
              ) : null}
            </div>

            <PlayerStrip side="black" name={selectedGame?.black ?? 'Black'} rating={selectedGame?.bRating} />
            <JuChessBoard
              className="online-ju-board"
              interactive={!watchingTournament}
              moves={boardMoves}
              onChange={watchingTournament ? undefined : updateBoard}
            />
            <PlayerStrip side="white" name={selectedGame?.white ?? 'White'} rating={selectedGame?.wRating} />

            <div className="online-board-controls">
              <button type="button" disabled={watchingTournament || !boardMoves.length} onClick={undoMove}>
                <Undo2 size={16} aria-hidden="true" />
                Undo
              </button>
              <span>{boardMoves.length} moves · {boardResult}</span>
              <button type="button" disabled={watchingTournament && gameLoading} onClick={startFreeBoard}>
                <RotateCcw size={16} aria-hidden="true" />
                New game
              </button>
            </div>
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
                            <small>Board {game.board}</small>
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

function PlayerStrip({ name, rating, side }: { name: string; rating?: number; side: 'white' | 'black' }) {
  return (
    <div className={`online-player-strip ${side}`}>
      <span>{side === 'white' ? 'W' : 'B'}</span>
      <strong>{name}</strong>
      <small>{rating ?? 'Unrated'}</small>
    </div>
  )
}

export default OnlineGamesPage
