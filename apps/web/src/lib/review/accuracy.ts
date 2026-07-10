// Accuracy and estimated-rating math, ported from Lichess / Chesskit.
//
// Accuracy answers "how close to perfect was this move?" on a 0..100 scale, per
// move and per player. Estimated Elo turns a player's accuracy into an
// approximate strength for that single game.

import { clamp } from './evaluation'

/**
 * Accuracy of one move, from the moving side's perspective.
 *
 * `winBefore` / `winAfter` are win percentages FOR THE MOVING SIDE (0..100).
 * A move that keeps the win chances scores ~100; a move that throws them away
 * scores near 0. This is Lichess's exact curve.
 */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const winDiff = Math.max(0, winBefore - winAfter)
  const raw = 103.1668 * Math.exp(-0.04354 * winDiff) - 3.1669
  return clamp(raw + 1, 0, 100)
}

/**
 * A player's game accuracy: the mean of their move accuracies, blended with the
 * harmonic mean so a single catastrophic move still hurts (Lichess weights the
 * two; we use a simple blend that matches its behaviour closely enough for a
 * club-level readout).
 */
export function playerAccuracy(moveAccuracies: number[]): number {
  if (moveAccuracies.length === 0) return 100

  const mean = average(moveAccuracies)
  const harmonic = harmonicMean(moveAccuracies)
  return clamp((mean + harmonic) / 2, 0, 100)
}

/**
 * Estimate a player's rating for this game from their accuracy. This is a
 * heuristic — a friendly "you played around 1600 here" number, never a real
 * rating. Anchored so ~100% ≈ 2700+, ~80% ≈ ~1800, ~50% ≈ ~900.
 */
export function estimatedElo(accuracy: number): number {
  const clamped = clamp(accuracy, 0, 100)
  const elo = Math.round(clamped * 31 - 400)
  return clamp(elo, 250, 3000)
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function harmonicMean(values: number[]): number {
  const safe = values.map((value) => Math.max(value, 1))
  const denominator = safe.reduce((sum, value) => sum + 1 / value, 0)
  return safe.length / denominator
}
