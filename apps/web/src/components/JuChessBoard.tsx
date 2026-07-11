import { useEffect, useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import './JuChessBoard.css'
import { buildChessGame, deriveResult, getMaterialEvaluation, type JuCapturedPiece } from './JuChessRules'

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

type BoardArrow = {
  from: Square
  to: Square
}

type BoardSquare = {
  key: Square
  dark: boolean
  fileLabel?: string
  rankLabel?: string
  piece?: {
    color: Color
    type: PieceSymbol
  }
}

type JuChessBoardProps = {
  annotationsEnabled?: boolean
  className?: string
  evaluation?: number
  fen?: string
  flipped?: boolean
  interactive?: boolean
  moves?: string[]
  onChange?: (state: JuChessBoardChange) => void
  showEvaluation?: boolean
  squareBadge?: {
    color: string
    label: string
    square: Square
    symbol: ReactNode
  }
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const PROMOTIONS: PieceSymbol[] = ['q', 'r', 'b', 'n']
const PIECE_NAMES: Record<PieceSymbol, string> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
}
export function JuChessBoard({
  annotationsEnabled = true,
  className,
  evaluation,
  fen,
  flipped = false,
  interactive = true,
  moves = [],
  onChange,
  showEvaluation = true,
  squareBadge,
}: JuChessBoardProps) {
  const game = useMemo(() => buildChessGame(fen, moves), [fen, moves])
  const markerId = `ju-arrow-${useId().replaceAll(':', '')}`
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [rightDragFrom, setRightDragFrom] = useState<Square | null>(null)
  const [arrows, setArrows] = useState<BoardArrow[]>([])
  const [markedSquares, setMarkedSquares] = useState<Set<Square>>(() => new Set())
  const legalMoves = selected ? game.moves({ square: selected, verbose: true }) : []
  const legalTargets = new Set(legalMoves.map((move) => move.to))
  const lastMove = game.history({ verbose: true }).at(-1)
  const checkSquare = game.isCheck() ? findKingSquare(game, game.turn()) : null
  const squares = buildSquares(game, flipped)
  const evaluationScore = evaluation ?? getMaterialEvaluation(game)
  const evaluationName = evaluation === undefined ? 'Material evaluation' : 'Engine evaluation'
  const whiteShare = Math.max(4, Math.min(96, 50 + evaluationScore * 7))

  useEffect(() => {
    if (annotationsEnabled) return
    setArrows([])
    setMarkedSquares(new Set())
    setRightDragFrom(null)
  }, [annotationsEnabled])

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

  function handleRightMouseDown(event: MouseEvent<HTMLButtonElement>, square: Square) {
    if (!annotationsEnabled || event.button !== 2) return
    event.preventDefault()
    setRightDragFrom(square)
  }

  function handleRightMouseUp(event: MouseEvent<HTMLButtonElement>, square: Square) {
    if (!annotationsEnabled || event.button !== 2 || !rightDragFrom) return
    event.preventDefault()

    if (rightDragFrom === square) {
      setMarkedSquares((current) => {
        const next = new Set(current)
        if (next.has(square)) next.delete(square)
        else next.add(square)
        return next
      })
    } else {
      const nextArrow = { from: rightDragFrom, to: square }
      setArrows((current) => {
        const existing = current.findIndex((arrow) => arrow.from === nextArrow.from && arrow.to === nextArrow.to)
        if (existing >= 0) return current.filter((_, index) => index !== existing)
        return [...current, nextArrow]
      })
    }

    setRightDragFrom(null)
  }

  return (
    <div
      className={['ju-chess-board-shell', showEvaluation ? '' : 'without-evaluation', className].filter(Boolean).join(' ')}
      onContextMenu={annotationsEnabled ? (event) => event.preventDefault() : undefined}
      onMouseLeave={() => setRightDragFrom(null)}
    >
      {showEvaluation ? (
        <div
          aria-label={`${evaluationName} ${formatEvaluation(evaluationScore)}. Positive values favor White.`}
          className="ju-evaluation-bar"
          role="meter"
          aria-valuemin={-99}
          aria-valuemax={99}
          aria-valuenow={evaluationScore}
          title={`${evaluationName}; positive values favor White`}
        >
          <span className="ju-evaluation-fill" style={{ height: `${whiteShare}%` }} />
          <strong className="ju-evaluation-number">{formatEvaluation(evaluationScore)}</strong>
        </div>
      ) : null}
      <div className="ju-chess-board" data-flipped={flipped ? 'true' : 'false'}>
        {squares.map((square) => {
          const selectedSquare = selected === square.key
          const lastMoveSquare = lastMove?.from === square.key || lastMove?.to === square.key
          const target = legalTargets.has(square.key)
          const check = checkSquare === square.key
          const marked = annotationsEnabled && markedSquares.has(square.key)
          const badge = squareBadge?.square === square.key ? squareBadge : null
          return (
            <button
              type="button"
              aria-disabled={!interactive}
              aria-label={`Square ${square.key}${marked ? ', marked red' : ''}${badge ? `, ${badge.label}` : ''}`}
              className={[
                'ju-chess-square',
                square.dark ? 'dark' : 'light',
                selectedSquare ? 'selected' : '',
                lastMoveSquare ? 'last-move' : '',
                target ? 'target' : '',
                check ? 'check' : '',
              ].filter(Boolean).join(' ')}
              data-square={square.key}
              onClick={() => handleSquareClick(square.key)}
              onMouseDown={(event) => handleRightMouseDown(event, square.key)}
              onMouseUp={(event) => handleRightMouseUp(event, square.key)}
              tabIndex={interactive ? 0 : -1}
              key={square.key}
            >
              {marked ? <span className="ju-square-mark" aria-hidden="true" /> : null}
              {square.piece ? <PieceGlyph color={square.piece.color} type={square.piece.type} /> : null}
              {badge ? (
                <span
                  aria-label={badge.label}
                  className="ju-review-square-badge"
                  role="img"
                  style={{ backgroundColor: badge.color }}
                >
                  {badge.symbol}
                </span>
              ) : null}
              {square.rankLabel ? <span className="ju-rank-label" aria-hidden="true">{square.rankLabel}</span> : null}
              {square.fileLabel ? <span className="ju-file-label" aria-hidden="true">{square.fileLabel}</span> : null}
            </button>
          )
        })}
        {annotationsEnabled && arrows.length ? (
          <svg className="ju-board-arrows" viewBox="0 0 8 8" aria-hidden="true">
            <defs>
              <marker id={markerId} markerHeight="4" markerWidth="4" orient="auto" refX="3.2" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" />
              </marker>
            </defs>
            {arrows.map((arrow) => (
              <path
                className="ju-board-arrow"
                d={arrowPath(arrow, flipped)}
                key={`${arrow.from}-${arrow.to}`}
                markerEnd={`url(#${markerId})`}
              />
            ))}
          </svg>
        ) : null}
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

export function JuCapturedPieces({ pieces }: { pieces: JuCapturedPiece[] }) {
  const label = pieces.length
    ? `Captured ${pieces.map((piece) => `${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}`).join(', ')}`
    : 'No captured pieces'

  return (
    <span aria-label={label} className="ju-captured-pieces" data-empty={pieces.length ? 'false' : 'true'}>
      {pieces.map((piece, index) => (
        <img
          alt=""
          draggable={false}
          key={`${piece.color}-${piece.type}-${index}`}
          src={pieceAsset(piece.color, piece.type)}
        />
      ))}
    </span>
  )
}

function PieceGlyph({ color, type }: { color: Color; type: PieceSymbol }) {
  return (
    <img
      alt=""
      className={`ju-chess-piece ${color === 'w' ? 'white' : 'black'}`}
      draggable={false}
      src={pieceAsset(color, type)}
    />
  )
}

function pieceAsset(color: Color, type: PieceSymbol) {
  return `${import.meta.env.BASE_URL}chess-pieces/${color}${type}.png`
}

function buildSquares(game: Chess, flipped: boolean): BoardSquare[] {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]

  return ranks.flatMap((rank, row) => FILES.map((file, column) => {
    const key = `${file}${rank}` as Square
    const piece = game.get(key)
    const fileIndex = FILES.indexOf(file)
    return {
      dark: (fileIndex + rank) % 2 === 1,
      fileLabel: row === 7 ? file : undefined,
      key,
      piece,
      rankLabel: column === 0 ? String(rank) : undefined,
    }
  }))
}

function formatEvaluation(value: number) {
  if (!Number.isFinite(value)) return '0.0'
  const bounded = Math.max(-99, Math.min(99, value))
  return `${bounded > 0 ? '+' : ''}${bounded.toFixed(1)}`
}

function arrowPath(arrow: BoardArrow, flipped: boolean) {
  const from = squareCenter(arrow.from, flipped)
  const to = squareCenter(arrow.to, flipped)
  const fileDistance = Math.abs(FILES.indexOf(arrow.from[0] as typeof FILES[number]) - FILES.indexOf(arrow.to[0] as typeof FILES[number]))
  const rankDistance = Math.abs(Number(arrow.from[1]) - Number(arrow.to[1]))

  if ((fileDistance === 2 && rankDistance === 1) || (fileDistance === 1 && rankDistance === 2)) {
    const corner = fileDistance === 2 ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
    return `M ${from.x} ${from.y} L ${corner.x} ${corner.y} L ${to.x} ${to.y}`
  }

  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
}

function squareCenter(square: Square, flipped: boolean) {
  const file = square[0] as typeof FILES[number]
  const rank = Number(square[1])
  return {
    x: FILES.indexOf(file) + 0.5,
    y: (flipped ? rank - 1 : 8 - rank) + 0.5,
  }
}

function findKingSquare(game: Chess, color: Color) {
  for (const rank of game.board()) {
    for (const square of rank) {
      if (square?.type === 'k' && square.color === color) return square.square
    }
  }
  return null
}
