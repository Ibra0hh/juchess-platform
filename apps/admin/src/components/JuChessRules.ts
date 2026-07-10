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

export function pgnFromMoves(moves: string[]) {
  return buildChessGame(undefined, moves).pgn()
}

export function parseChessPgn(value: string) {
  const pgn = value.trim()
  if (!pgn || pgn === 'bye') throw new Error('Enter PGN moves first.')

  const resultToken = pgn.match(/\b(1-0|0-1|1\/2-1\/2)\s*$/)?.[1]
  const game = new Chess()

  try {
    game.loadPgn(pgn)
    const moves = game.history()
    if (!moves.length) throw new Error('The PGN does not contain moves.')
    return { moves, result: deriveResult(game) === 'Live' ? resultToken ?? 'Live' : deriveResult(game) }
  } catch {
    const fallback = new Chess()
    const tokens = pgn
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .split(/\s+/)
      .map((token) => token.replace(/^\d+\.(?:\.\.)?/, ''))
      .filter((token) => token && !/^\d+\.*$/.test(token) && !/^\$\d+$/.test(token))
      .filter((token) => !['1-0', '0-1', '1/2-1/2', '*'].includes(token))

    for (const token of tokens) {
      try {
        fallback.move(token)
      } catch {
        throw new Error(`Invalid PGN move: ${token}`)
      }
    }

    const moves = fallback.history()
    if (!moves.length) throw new Error('The PGN does not contain valid moves.')
    const derived = deriveResult(fallback)
    return { moves, result: derived === 'Live' ? resultToken ?? 'Live' : derived }
  }
}
