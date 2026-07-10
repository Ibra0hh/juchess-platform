// Move classification — the "game review" brain.
//
// Faithful to Chesskit/Lichess thresholds, presented with Chess.com's label set
// so it reads the way players expect. The function is pure: the caller (which
// owns chess.js) precomputes the board-dependent flags (sacrifice, book move,
// engine best move) and passes them in, so this stays unit-testable with no
// engine.

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'

export type ClassificationInput = {
  /** UCI of the move actually played. */
  playedUci: string
  /** UCI of the engine's best move in the position BEFORE the move. */
  bestUci?: string
  /** Win % for the moving side BEFORE the move (0..100). */
  winBefore: number
  /** Win % for the moving side AFTER the move (0..100). */
  winAfter: number
  /** The position before the move was a known opening (book) position. */
  isBookMove: boolean
  /** The played move gives up material that is not immediately regained. */
  isSacrifice: boolean
  /**
   * How much worse the second-best move was than the best, in win % (0..100).
   * Large value ⇒ the best move was effectively the only move.
   */
  secondBestDelta?: number
}

export type ClassificationMeta = {
  label: string
  symbol: string
  color: string
  /** Higher is better; used for sorting/summary emphasis. */
  rank: number
}

// Chess.com-style presentation. Colors are chosen to sit on the dark board theme.
export const CLASSIFICATION_META: Record<Classification, ClassificationMeta> = {
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#1baca6', rank: 9 },
  great: { label: 'Great', symbol: '!', color: '#5c8bb0', rank: 8 },
  best: { label: 'Best', symbol: '★', color: '#95b776', rank: 7 },
  excellent: { label: 'Excellent', symbol: '✓', color: '#96af8b', rank: 6 },
  good: { label: 'Good', symbol: '✓', color: '#a3a29b', rank: 5 },
  book: { label: 'Book', symbol: '📖', color: '#a88865', rank: 4 },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#f0c15c', rank: 3 },
  mistake: { label: 'Mistake', symbol: '?', color: '#e58f2a', rank: 2 },
  miss: { label: 'Miss', symbol: '✗', color: '#e07a3e', rank: 1 },
  blunder: { label: 'Blunder', symbol: '??', color: '#ca3431', rank: 0 },
}

// Win-% loss thresholds (moving side POV). Matches Chesskit's buckets.
const BLUNDER = 20
const MISTAKE = 10
const INACCURACY = 5
const GOOD = 2

/** Classify a single move. Pure. */
export function classifyMove(input: ClassificationInput): Classification {
  const delta = Math.max(0, input.winBefore - input.winAfter)

  // A book move is a book move regardless of the tiny eval wobble.
  if (input.isBookMove) return 'book'

  const base = bucket(delta)
  const playedBest = Boolean(input.bestUci) && input.playedUci === input.bestUci

  if (playedBest) {
    // A sound sacrifice that is also the best move, when the game is not already
    // decided, and there was a genuine choice — that is Brilliant.
    if (input.isSacrifice && delta < INACCURACY && input.winBefore < 97) {
      return 'brilliant'
    }
    // The best move was effectively the only move that held — a Great find.
    if ((input.secondBestDelta ?? 0) >= MISTAKE && delta < INACCURACY) {
      return 'great'
    }
    if (delta < GOOD) return 'best'
    // Played the top move but the whole position was losing anyway.
    return base === 'excellent' ? 'best' : base
  }

  // Missed a clearly winning continuation: had a decisive edge and let a big
  // chunk of it slip while a better move existed. Chess.com calls this a Miss.
  if (input.winBefore >= 75 && delta >= MISTAKE) return 'miss'

  return base
}

function bucket(delta: number): Classification {
  if (delta >= BLUNDER) return 'blunder'
  if (delta >= MISTAKE) return 'mistake'
  if (delta >= INACCURACY) return 'inaccuracy'
  if (delta >= GOOD) return 'good'
  return 'excellent'
}

/** Count classifications for one player, in display order (best → worst). */
export function summarize(classifications: Classification[]): Record<Classification, number> {
  const counts = {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
  }
  for (const classification of classifications) counts[classification] += 1
  return counts
}

/** The order the recap panel lists classifications in. */
export const CLASSIFICATION_ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]
