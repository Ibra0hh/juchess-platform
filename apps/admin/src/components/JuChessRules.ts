import { Chess } from 'chess.js'

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
