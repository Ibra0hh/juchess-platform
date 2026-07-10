// Core evaluation math for the game-review engine.
//
// Ported from the logic used by Chesskit (github.com/GuillaumeSD/Chesskit) and
// Lichess. Everything here is pure and framework-agnostic so the same brain can
// power the web analysis screen today and the Flutter app later.

/** A single Stockfish line for one position, from White's point of view. */
export type EngineLine = {
  /** Centipawn score (White POV). Undefined when the line is a forced mate. */
  cp?: number
  /** Moves-to-mate (White POV). Positive = White mates, negative = Black mates. */
  mate?: number
  /** Principal variation as UCI moves, best move first. */
  pv: string[]
  depth: number
}

/** Stockfish's evaluation of one position: its best lines, deepest first. */
export type PositionEval = {
  /** Best lines, sorted best-first for the side to move. lines[0] is the top move. */
  lines: EngineLine[]
  /** FEN this evaluation belongs to. */
  fen: string
  /** true when it is Black to move in `fen` (needed to flip White-POV scores). */
  blackToMove: boolean
}

const WIN_PERCENT_K = 0.00368208 // Lichess constant for the cp -> win% sigmoid.

/**
 * Convert a White-POV line into a win percentage for White (0..100).
 *
 * cp uses Lichess's logistic curve; a forced mate saturates to 0 or 100 so a
 * "mate in 5" and a "mate in 1" both read as a decisive 100/0 rather than a
 * gigantic centipawn number that would swamp the accuracy math.
 */
export function lineWinPercent(line: EngineLine): number {
  if (line.mate !== undefined) {
    return line.mate > 0 ? 100 : 0
  }
  const cp = clamp(line.cp ?? 0, -1500, 1500)
  const winChances = 2 / (1 + Math.exp(-WIN_PERCENT_K * cp)) - 1
  return clamp(50 + 50 * winChances, 0, 100)
}

/** White's win percentage for a position, taken from its best line. */
export function positionWinPercent(position: PositionEval): number {
  const best = position.lines[0]
  if (!best) return 50
  return lineWinPercent(best)
}

/**
 * Numeric score of the best line from White's POV, in "pawns", for display and
 * for ordering. A mate is mapped onto a large but finite value so sorting and
 * graphs behave.
 */
export function positionValue(position: PositionEval): number {
  const best = position.lines[0]
  if (!best) return 0
  if (best.mate !== undefined) {
    return best.mate > 0 ? 100 - best.mate / 100 : -100 - best.mate / 100
  }
  return (best.cp ?? 0) / 100
}

/** Human-readable eval string, e.g. "+1.4" or "M3" / "-M2". */
export function formatEval(position: PositionEval): string {
  const best = position.lines[0]
  if (!best) return '0.0'
  if (best.mate !== undefined) {
    return best.mate > 0 ? `M${best.mate}` : `-M${Math.abs(best.mate)}`
  }
  const pawns = (best.cp ?? 0) / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
