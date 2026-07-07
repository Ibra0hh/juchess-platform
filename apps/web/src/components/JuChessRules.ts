import { Chess } from 'chess.js'

export function buildChessGame(fen?: string, moves: string[] = []) {
  const game = new Chess(fen)
  moves.forEach((move) => {
    try {
      game.move(move)
    } catch {
      // Stored move lists should not break board rendering.
    }
  })
  return game
}

export function deriveResult(game: Chess) {
  if (game.isCheckmate()) return game.turn() === 'w' ? '0-1' : '1-0'
  if (game.isDraw()) return '1/2-1/2'
  return 'Live'
}
