import { Chess, type Color, type PieceSymbol } from 'chess.js'

export type JuCapturedPiece = {
  color: Color
  type: PieceSymbol
}

export type JuChessBoardSummary = {
  captured: {
    black: JuCapturedPiece[]
    white: JuCapturedPiece[]
  }
  materialEvaluation: number
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  b: 3,
  k: 0,
  n: 3,
  p: 1,
  q: 9,
  r: 5,
}

export function buildChessGame(fen?: string, moves: string[] = []) {
  const game = createChessGame(fen)
  moves.forEach((move) => {
    try {
      game.move(move)
    } catch {
      // Stored move lists should not break board rendering.
    }
  })
  return game
}

function createChessGame(fen?: string) {
  if (!fen?.trim()) return new Chess()

  try {
    return new Chess(normalizeFen(fen))
  } catch {
    return new Chess()
  }
}

function normalizeFen(fen: string) {
  const parts = fen.trim().split(/\s+/)

  if (parts.length === 1) return `${parts[0]} w - - 0 1`
  if (parts.length === 4) return `${parts.join(' ')} 0 1`
  if (parts.length === 5) return `${parts.join(' ')} 1`

  return parts.join(' ')
}

export function deriveResult(game: Chess) {
  if (game.isCheckmate()) return game.turn() === 'w' ? '0-1' : '1-0'
  if (game.isDraw()) return '1/2-1/2'
  return 'Live'
}

export function getJuChessBoardSummary(fen?: string, moves: string[] = []): JuChessBoardSummary {
  const game = buildChessGame(fen, moves)
  const captured: JuChessBoardSummary['captured'] = { black: [], white: [] }

  game.history({ verbose: true }).forEach((move) => {
    if (!move.captured) return
    const capturer = move.color === 'w' ? 'white' : 'black'
    captured[capturer].push({
      color: move.color === 'w' ? 'b' : 'w',
      type: move.captured,
    })
  })

  const sortByValue = (left: JuCapturedPiece, right: JuCapturedPiece) => PIECE_VALUES[right.type] - PIECE_VALUES[left.type]
  captured.white.sort(sortByValue)
  captured.black.sort(sortByValue)

  return { captured, materialEvaluation: getMaterialEvaluation(game) }
}

export function getMaterialEvaluation(game: Chess) {
  let score = 0
  game.board().forEach((rank) => {
    rank.forEach((piece) => {
      if (!piece) return
      score += PIECE_VALUES[piece.type] * (piece.color === 'w' ? 1 : -1)
    })
  })
  return score
}
