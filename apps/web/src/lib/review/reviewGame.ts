// Game-review orchestrator.
//
// Ties chess.js (parsing, legality, sacrifice detection) to the Stockfish
// evaluations and the classification brain. The evaluator is injected so this
// whole pipeline is unit-testable with a stub — no live engine required.

import { Chess } from 'chess.js'
import { positionWinPercent, positionValue, type PositionEval } from './evaluation'
import { moveAccuracy, playerAccuracy, estimatedElo } from './accuracy'
import { classifyMove, summarize, type Classification } from './classification'

export type ReviewedMove = {
  ply: number
  san: string
  uci: string
  color: 'w' | 'b'
  fenBefore: string
  fenAfter: string
  classification: Classification
  /** Eval AFTER the move, White POV pawns, for the graph. */
  evalAfter: number
  bestUci?: string
}

export type GameReview = {
  moves: ReviewedMove[]
  fens: string[]
  positions: PositionEval[]
  white: { accuracy: number; estimatedElo: number; counts: Record<Classification, number> }
  black: { accuracy: number; estimatedElo: number; counts: Record<Classification, number> }
}

export type Evaluator = (fens: string[]) => Promise<PositionEval[]>

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const BOOK_MAX_PLY = 10

/** Parse a PGN into its FEN sequence and verbose moves, or throw. */
export function parsePgn(pgn: string) {
  const chess = new Chess()
  chess.loadPgn(pgn)
  const history = chess.history({ verbose: true })
  if (history.length === 0) throw new Error('This PGN has no moves to review.')

  const fens = [history[0].before, ...history.map((move) => move.after)]
  return { history, fens }
}

/**
 * Produce a full review from a PGN. `evaluate` returns one PositionEval per FEN
 * (same length/order as the FEN list from parsePgn).
 */
export async function reviewGame(pgn: string, evaluate: Evaluator): Promise<GameReview> {
  const { history, fens } = parsePgn(pgn)
  const positions = await evaluate(fens)

  const moves: ReviewedMove[] = []
  const whiteAcc: number[] = []
  const blackAcc: number[] = []

  for (let index = 0; index < history.length; index += 1) {
    const move = history[index]
    const before = positions[index]
    const after = positions[index + 1]
    if (!before || !after) continue

    const whiteWinBefore = positionWinPercent(before)
    const whiteWinAfter = positionWinPercent(after)
    const moverIsWhite = move.color === 'w'
    const winBefore = moverIsWhite ? whiteWinBefore : 100 - whiteWinBefore
    const winAfter = moverIsWhite ? whiteWinAfter : 100 - whiteWinAfter

    const bestUci = before.lines[0]?.pv[0]
    const classification = classifyMove({
      playedUci: move.lan,
      bestUci,
      winBefore,
      winAfter,
      isBookMove: index < BOOK_MAX_PLY && isBookish(before, move.lan, whiteWinBefore),
      isSacrifice: isSacrifice(move.after, move.to),
      secondBestDelta: secondBestDelta(before, moverIsWhite),
    })

    const accuracy = moveAccuracy(winBefore, winAfter)
    if (moverIsWhite) whiteAcc.push(accuracy)
    else blackAcc.push(accuracy)

    moves.push({
      ply: index + 1,
      san: move.san,
      uci: move.lan,
      color: move.color,
      fenBefore: move.before,
      fenAfter: move.after,
      classification,
      evalAfter: positionValue(after),
      bestUci,
    })
  }

  const whiteAccuracy = playerAccuracy(whiteAcc)
  const blackAccuracy = playerAccuracy(blackAcc)

  return {
    moves,
    fens,
    positions,
    white: {
      accuracy: whiteAccuracy,
      estimatedElo: estimatedElo(whiteAccuracy),
      counts: summarize(moves.filter((m) => m.color === 'w').map((m) => m.classification)),
    },
    black: {
      accuracy: blackAccuracy,
      estimatedElo: estimatedElo(blackAccuracy),
      counts: summarize(moves.filter((m) => m.color === 'b').map((m) => m.classification)),
    },
  }
}

/** Win-% gap (mover POV) between the best and second-best engine line. */
function secondBestDelta(position: PositionEval, moverIsWhite: boolean): number | undefined {
  if (position.lines.length < 2) return undefined
  const toMover = (whiteWin: number) => (moverIsWhite ? whiteWin : 100 - whiteWin)
  const best = toMover(winPercentOfLine(position, 0))
  const second = toMover(winPercentOfLine(position, 1))
  return Math.max(0, best - second)
}

function winPercentOfLine(position: PositionEval, lineIndex: number): number {
  const single: PositionEval = { ...position, lines: [position.lines[lineIndex]] }
  return positionWinPercent(single)
}

/**
 * Early, quiet, sensible moves count as opening theory. Without a full opening
 * book this is a heuristic: an early move that keeps the eval near equal and is
 * one the engine likes. Deliberately conservative so a bad early move is NOT
 * excused as "book".
 */
function isBookish(before: PositionEval, playedUci: string, whiteWinBefore: number): boolean {
  const nearEqual = Math.abs(whiteWinBefore - 50) < 12
  const engineLikesIt = before.lines.some((line) => line.pv[0] === playedUci)
  return nearEqual && engineLikesIt
}

/**
 * Does the move leave the moved piece capturable for a net material gain by the
 * opponent? Detected on the resulting position: if any opponent capture of the
 * piece on `to` uses a cheaper piece (or the square is undefended), material was
 * sacrificed. Conservative — this only gates the "Brilliant" label, which is
 * further gated on the move also being the engine's best.
 */
function isSacrifice(fenAfter: string, to: string): boolean {
  try {
    const chess = new Chess(fenAfter)
    const movedPiece = chess.get(to as never)
    if (!movedPiece) return false
    const movedValue = PIECE_VALUE[movedPiece.type] ?? 0
    if (movedValue === 0) return false

    const captures = chess
      .moves({ verbose: true })
      .filter((move) => move.to === to && move.captured)

    if (captures.length === 0) return false

    // Cheapest attacker of the moved piece.
    const cheapestAttacker = Math.min(...captures.map((move) => PIECE_VALUE[move.piece] ?? 0))
    // If the opponent can win the piece for less than its value, it's a sacrifice.
    return cheapestAttacker < movedValue
  } catch {
    return false
  }
}
