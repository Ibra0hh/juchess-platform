import { memo, useMemo } from 'react'
import { buildChessGame } from './JuChessRules'
import { parseStoredMoves, type TournamentGame } from '../lib/juchess'

type TournamentMiniBoardProps = {
  game: TournamentGame
}

function TournamentMiniBoardComponent({ game }: TournamentMiniBoardProps) {
  const position = useMemo(() => {
    const chess = buildChessGame(undefined, parseStoredMoves(game.pgn))
    const lastMove = chess.history({ verbose: true }).at(-1)
    const lastMoveSquares = new Set<string>()
    if (lastMove) {
      lastMoveSquares.add(lastMove.from)
      lastMoveSquares.add(lastMove.to)
    }
    return {
      squares: chess.board().flat(),
      lastMoveSquares,
    }
  }, [game.pgn])

  return (
    <span
      className="tournament-mini-board"
      aria-label={`Position for ${game.white.name} against ${game.black.name}`}
      role="img"
    >
      {position.squares.map((piece, index) => {
        const rank = 8 - Math.floor(index / 8)
        const file = String.fromCharCode(97 + (index % 8))
        const square = `${file}${rank}`
        const dark = (Math.floor(index / 8) + index) % 2 === 1
        return (
          <span
            className={[
              dark ? 'dark' : 'light',
              position.lastMoveSquares.has(square) ? 'last-move' : '',
            ].filter(Boolean).join(' ')}
            key={square}
          >
            {piece ? (
              <img
                alt=""
                loading="lazy"
                src={`${import.meta.env.BASE_URL}chess-pieces/${piece.color}${piece.type}.png`}
              />
            ) : null}
          </span>
        )
      })}
    </span>
  )
}

export const TournamentMiniBoard = memo(TournamentMiniBoardComponent)
