import { useMemo, useState } from 'react'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import './JuChessBoard.css'
import { buildChessGame, deriveResult } from './JuChessRules'

export type JuChessBoardChange = {
  fen: string
  gameOver: boolean
  inCheck: boolean
  lastMove: string
  moves: string[]
  pgn: string
  result: string
}

type PendingPromotion = {
  from: Square
  to: Square
  color: Color
}

type BoardSquare = {
  key: Square
  dark: boolean
  piece?: {
    color: Color
    type: PieceSymbol
  }
}

type JuChessBoardProps = {
  className?: string
  fen?: string
  flipped?: boolean
  interactive?: boolean
  moves?: string[]
  onChange?: (state: JuChessBoardChange) => void
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const PROMOTIONS: PieceSymbol[] = ['q', 'r', 'b', 'n']

export function JuChessBoard({
  className,
  fen,
  flipped = false,
  interactive = true,
  moves = [],
  onChange,
}: JuChessBoardProps) {
  const game = useMemo(() => buildChessGame(fen, moves), [fen, moves])
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const legalMoves = selected ? game.moves({ square: selected, verbose: true }) : []
  const legalTargets = new Set(legalMoves.map((move) => move.to))
  const lastMove = game.history({ verbose: true }).at(-1)
  const checkSquare = game.isCheck() ? findKingSquare(game, game.turn()) : null
  const squares = buildSquares(game, flipped)

  function emit(nextGame: Chess, nextMoves: string[], lastMoveSan: string) {
    onChange?.({
      fen: nextGame.fen(),
      gameOver: nextGame.isGameOver(),
      inCheck: nextGame.isCheck(),
      lastMove: lastMoveSan,
      moves: nextMoves,
      pgn: nextGame.pgn(),
      result: deriveResult(nextGame),
    })
  }

  function playMove(from: Square, to: Square, promotion?: PieceSymbol) {
    const nextGame = buildChessGame(fen, moves)
    try {
      const move = nextGame.move({ from, promotion, to })
      if (!move) return
      emit(nextGame, [...moves, move.san], move.san)
      setSelected(null)
      setPendingPromotion(null)
    } catch {
      setSelected(null)
      setPendingPromotion(null)
    }
  }

  function handleSquareClick(square: Square) {
    if (!interactive || pendingPromotion) return
    const piece = game.get(square)

    if (!selected) {
      if (piece?.color === game.turn()) setSelected(square)
      return
    }

    if (selected === square) {
      setSelected(null)
      return
    }

    const move = legalMoves.find((item) => item.to === square)
    if (move) {
      if (move.isPromotion()) {
        setPendingPromotion({ color: game.turn(), from: selected, to: square })
        return
      }
      playMove(selected, square)
      return
    }

    if (piece?.color === game.turn()) {
      setSelected(square)
      return
    }

    setSelected(null)
  }

  return (
    <div className={['ju-chess-board-shell', className].filter(Boolean).join(' ')}>
      <div className="ju-chess-board" data-flipped={flipped ? 'true' : 'false'}>
        {squares.map((square) => {
          const selectedSquare = selected === square.key
          const lastMoveSquare = lastMove?.from === square.key || lastMove?.to === square.key
          const target = legalTargets.has(square.key)
          const check = checkSquare === square.key
          return (
            <button
              type="button"
              aria-label={`Square ${square.key}`}
              className={[
                'ju-chess-square',
                square.dark ? 'dark' : 'light',
                selectedSquare ? 'selected' : '',
                lastMoveSquare ? 'last-move' : '',
                target ? 'target' : '',
                check ? 'check' : '',
              ].filter(Boolean).join(' ')}
              disabled={!interactive}
              data-square={square.key}
              onClick={() => handleSquareClick(square.key)}
              key={square.key}
            >
              {square.piece ? <PieceGlyph color={square.piece.color} type={square.piece.type} /> : null}
            </button>
          )
        })}
        {pendingPromotion ? (
          <div className="ju-promotion-panel">
            {PROMOTIONS.map((piece) => (
              <button type="button" onClick={() => playMove(pendingPromotion.from, pendingPromotion.to, piece)} key={piece}>
                <PieceGlyph color={pendingPromotion.color} type={piece} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PieceGlyph({ color, type }: { color: Color; type: PieceSymbol }) {
  return (
    <img
      alt=""
      className={`ju-chess-piece ${color === 'w' ? 'white' : 'black'}`}
      draggable={false}
      src={`${import.meta.env.BASE_URL}chess-pieces/${color}${type}.png`}
    />
  )
}

function buildSquares(game: Chess, flipped: boolean): BoardSquare[] {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]
  const files = flipped ? [...FILES].reverse() : FILES

  return ranks.flatMap((rank) => files.map((file) => {
    const key = `${file}${rank}` as Square
    const piece = game.get(key)
    const fileIndex = FILES.indexOf(file)
    return {
      dark: (fileIndex + rank) % 2 === 1,
      key,
      piece,
    }
  }))
}

function findKingSquare(game: Chess, color: Color) {
  for (const rank of game.board()) {
    for (const square of rank) {
      if (square?.type === 'k' && square.color === color) return square.square
    }
  }
  return null
}
