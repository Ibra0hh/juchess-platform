import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import {
  annotationColorForModifiers,
  boardThemeAssetPath,
  getAnnotationColorOption,
  pieceThemeAssetPath,
  type JuAnnotationColor,
  type JuBoardTheme,
  type JuPieceTheme,
} from '../lib/boardAppearance'
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
  color: JuAnnotationColor
  from: Square
  to: Square
}

type RightDrag = {
  color: JuAnnotationColor
  from: Square
}

type PieceDrag = {
  color: Color
  from: Square
  moved: boolean
  pointerId: number
  startX: number
  startY: number
  type: PieceSymbol
  x: number
  y: number
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
  arrowColor?: JuAnnotationColor
  boardTheme?: JuBoardTheme
  className?: string
  evaluation?: number
  fen?: string
  flipped?: boolean
  interactive?: boolean
  markColor?: JuAnnotationColor
  moves?: string[]
  onChange?: (state: JuChessBoardChange) => void
  pieceTheme?: JuPieceTheme
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
  arrowColor = 'red',
  boardTheme = 'juchess',
  className,
  evaluation,
  fen,
  flipped = false,
  interactive = true,
  markColor = 'red',
  moves = [],
  onChange,
  pieceTheme = 'juchess',
  showEvaluation = true,
  squareBadge,
}: JuChessBoardProps) {
  const game = useMemo(() => buildChessGame(fen, moves), [fen, moves])
  const markerId = `ju-arrow-${useId().replaceAll(':', '')}`
  const boardRef = useRef<HTMLDivElement | null>(null)
  const suppressClickRef = useRef(false)
  const [selected, setSelected] = useState<Square | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [rightDrag, setRightDrag] = useState<RightDrag | null>(null)
  const [arrows, setArrows] = useState<BoardArrow[]>([])
  const [markedSquares, setMarkedSquares] = useState<Set<Square>>(() => new Set())
  const [pieceDrag, setPieceDrag] = useState<PieceDrag | null>(null)
  const legalMoves = selected ? game.moves({ square: selected, verbose: true }) : []
  const legalTargets = new Set(legalMoves.map((move) => move.to))
  const lastMove = game.history({ verbose: true }).at(-1)
  const checkSquare = game.isCheck() ? findKingSquare(game, game.turn()) : null
  const squares = buildSquares(game, flipped)
  const evaluationScore = evaluation ?? getMaterialEvaluation(game)
  const evaluationName = evaluation === undefined ? 'Material evaluation' : 'Engine evaluation'
  const whiteShare = Math.max(4, Math.min(96, 50 + evaluationScore * 7))
  const boardAsset = boardThemeAssetPath(boardTheme)
  const arrowColorOption = getAnnotationColorOption(arrowColor)
  const markColorOption = getAnnotationColorOption(markColor)
  const boardStyle = {
    ...(boardAsset ? { backgroundImage: `url(${import.meta.env.BASE_URL}${boardAsset})` } : {}),
    '--ju-arrow-color': arrowColorOption.arrow,
    '--ju-mark-color': markColorOption.mark,
  } as CSSProperties

  useEffect(() => {
    if (annotationsEnabled) return
    setArrows([])
    setMarkedSquares(new Set())
    setRightDrag(null)
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

  function clearAnnotations() {
    if (!annotationsEnabled) return
    setArrows([])
    setMarkedSquares(new Set())
    setRightDrag(null)
  }

  function handleSquareClick(square: Square) {
    if (suppressClickRef.current) return
    clearAnnotations()
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

  function handlePiecePointerDown(event: ReactPointerEvent<HTMLButtonElement>, square: Square) {
    if (event.button !== 0) return
    clearAnnotations()
    if (!interactive || pendingPromotion) return
    const piece = game.get(square)
    const board = boardRef.current
    if (!piece || piece.color !== game.turn() || !board) return

    const bounds = board.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    setPieceDrag({
      color: piece.color,
      from: square,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      type: piece.type,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }

  function handlePiecePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!pieceDrag || pieceDrag.pointerId !== event.pointerId || !boardRef.current) return
    const bounds = boardRef.current.getBoundingClientRect()
    const moved = pieceDrag.moved || Math.hypot(event.clientX - pieceDrag.startX, event.clientY - pieceDrag.startY) > 4
    if (moved && !pieceDrag.moved) setSelected(pieceDrag.from)
    setPieceDrag((current) => current && current.pointerId === event.pointerId ? {
      ...current,
      moved,
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    } : current)
  }

  function handlePiecePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!pieceDrag || pieceDrag.pointerId !== event.pointerId) return
    const drag = pieceDrag
    setPieceDrag(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!drag.moved) return

    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-square]')
    const target = targetElement?.dataset.square as Square | undefined
    const move = target ? game.moves({ square: drag.from, verbose: true }).find((candidate) => candidate.to === target) : null
    if (!target || !move) {
      setSelected(null)
      return
    }
    if (move.isPromotion()) {
      setPendingPromotion({ color: game.turn(), from: drag.from, to: target })
      return
    }
    playMove(drag.from, target)
  }

  function handlePiecePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!pieceDrag || pieceDrag.pointerId !== event.pointerId) return
    setPieceDrag(null)
    setSelected(null)
  }

  function handleRightMouseDown(event: MouseEvent<HTMLButtonElement>, square: Square) {
    if (!annotationsEnabled || event.button !== 2) return
    event.preventDefault()
    setRightDrag({ color: annotationColorForModifiers(event, arrowColor), from: square })
  }

  function handleRightMouseUp(event: MouseEvent<HTMLButtonElement>, square: Square) {
    if (!annotationsEnabled || event.button !== 2 || !rightDrag) return
    event.preventDefault()

    if (rightDrag.from === square) {
      setMarkedSquares((current) => {
        const next = new Set(current)
        if (next.has(square)) next.delete(square)
        else next.add(square)
        return next
      })
    } else {
      const nextArrow = { color: rightDrag.color, from: rightDrag.from, to: square }
      setArrows((current) => {
        const existing = current.findIndex((arrow) => arrow.from === nextArrow.from && arrow.to === nextArrow.to)
        if (existing >= 0) {
          if (current[existing].color === nextArrow.color) {
            return current.filter((_, index) => index !== existing)
          }
          return current.map((arrow, index) => index === existing ? nextArrow : arrow)
        }
        return [...current, nextArrow]
      })
    }

    setRightDrag(null)
  }

  return (
    <div
      className={['ju-chess-board-shell', showEvaluation ? '' : 'without-evaluation', className].filter(Boolean).join(' ')}
      onContextMenu={annotationsEnabled ? (event) => event.preventDefault() : undefined}
      onMouseLeave={() => setRightDrag(null)}
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
      <div
        className="ju-chess-board"
        data-board-theme={boardTheme}
        data-flipped={flipped ? 'true' : 'false'}
        ref={boardRef}
        style={boardStyle}
      >
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
              aria-label={`Square ${square.key}${marked ? `, marked ${markColorOption.label.toLocaleLowerCase()}` : ''}${badge ? `, ${badge.label}` : ''}`}
              className={[
                'ju-chess-square',
                square.dark ? 'dark' : 'light',
                selectedSquare ? 'selected' : '',
                lastMoveSquare ? 'last-move' : '',
                target ? 'target' : '',
                check ? 'check' : '',
                pieceDrag?.from === square.key ? 'dragging-source' : '',
              ].filter(Boolean).join(' ')}
              data-square={square.key}
              onClick={() => handleSquareClick(square.key)}
              onMouseDown={(event) => handleRightMouseDown(event, square.key)}
              onMouseUp={(event) => handleRightMouseUp(event, square.key)}
              onPointerCancel={handlePiecePointerCancel}
              onPointerDown={(event) => handlePiecePointerDown(event, square.key)}
              onPointerMove={handlePiecePointerMove}
              onPointerUp={handlePiecePointerUp}
              tabIndex={interactive ? 0 : -1}
              key={square.key}
            >
              {marked ? <span className="ju-square-mark" aria-hidden="true" /> : null}
              {square.piece ? <PieceGlyph color={square.piece.color} pieceTheme={pieceTheme} type={square.piece.type} /> : null}
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
        {pieceDrag ? (
          <span
            aria-hidden="true"
            className="ju-dragged-piece"
            style={{ left: pieceDrag.x, top: pieceDrag.y }}
          >
            <PieceGlyph color={pieceDrag.color} pieceTheme={pieceTheme} type={pieceDrag.type} />
          </span>
        ) : null}
        {annotationsEnabled && arrows.length ? (
          <svg className="ju-board-arrows" viewBox="0 0 8 8" aria-hidden="true">
            <defs>
              {Array.from(new Set(arrows.map((arrow) => arrow.color))).map((color) => (
                <marker
                  id={`${markerId}-${color}`}
                  key={color}
                  markerHeight="4"
                  markerWidth="4"
                  orient="auto"
                  refX="3.2"
                  refY="2"
                  viewBox="0 0 4 4"
                >
                  <path d="M0,0 L4,2 L0,4 Z" fill={getAnnotationColorOption(color).arrow} />
                </marker>
              ))}
            </defs>
            {arrows.map((arrow) => (
              <path
                className="ju-board-arrow"
                d={arrowPath(arrow, flipped)}
                key={`${arrow.from}-${arrow.to}-${arrow.color}`}
                markerEnd={`url(#${markerId}-${arrow.color})`}
                style={{ '--ju-arrow-color': getAnnotationColorOption(arrow.color).arrow } as CSSProperties}
              />
            ))}
          </svg>
        ) : null}
        {pendingPromotion ? (
          <div className="ju-promotion-panel">
            {PROMOTIONS.map((piece) => (
              <button type="button" onClick={() => playMove(pendingPromotion.from, pendingPromotion.to, piece)} key={piece}>
                <PieceGlyph color={pendingPromotion.color} pieceTheme={pieceTheme} type={piece} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function JuCapturedPieces({
  pieces,
  pieceTheme = 'juchess',
}: {
  pieces: JuCapturedPiece[]
  pieceTheme?: JuPieceTheme
}) {
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
          src={pieceAsset(piece.color, piece.type, pieceTheme)}
        />
      ))}
    </span>
  )
}

function PieceGlyph({
  color,
  pieceTheme,
  type,
}: {
  color: Color
  pieceTheme: JuPieceTheme
  type: PieceSymbol
}) {
  return (
    <img
      alt=""
      className={`ju-chess-piece ${color === 'w' ? 'white' : 'black'}`}
      draggable={false}
      src={pieceAsset(color, type, pieceTheme)}
    />
  )
}

function pieceAsset(color: Color, type: PieceSymbol, pieceTheme: JuPieceTheme) {
  return `${import.meta.env.BASE_URL}${pieceThemeAssetPath(pieceTheme, color, type)}`
}

function buildSquares(game: Chess, flipped: boolean): BoardSquare[] {
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]
  const files = flipped ? [...FILES].reverse() : FILES

  return ranks.flatMap((rank, row) => files.map((file, column) => {
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
    x: (flipped ? 7 - FILES.indexOf(file) : FILES.indexOf(file)) + 0.5,
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
