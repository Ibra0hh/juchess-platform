import { describe, expect, it } from 'vitest'
import { parsePgn, reviewGame, type Evaluator } from './reviewGame'
import type { PositionEval } from './evaluation'

// Fool's mate: White throws it away, Black delivers mate on move 2.
const FOOLS_MATE = '1. f3 e5 2. g4 Qh4#'

// A chess.com-style PGN with headers and clock comments, to prove the parser
// tolerates real exports.
const REAL_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "alice"]
[Black "bob"]
[Result "1-0"]

1. e4 {[%clk 0:03:00]} e5 {[%clk 0:03:00]} 2. Nf3 {[%clk 0:02:58]} Nc6 3. Bb5 a6 1-0`

/** Stub evaluator: flat, equal eval for every position. */
const flatEval: Evaluator = async (fens) =>
  fens.map((fen): PositionEval => ({
    fen,
    blackToMove: fen.split(' ')[1] === 'b',
    lines: [{ cp: 20, pv: ['e2e4'], depth: 12 }],
  }))

describe('parsePgn', () => {
  it('reads moves and FENs from a plain PGN', () => {
    const { history, fens } = parsePgn(FOOLS_MATE)
    expect(history).toHaveLength(4)
    expect(fens).toHaveLength(5) // start + one per move
    expect(history[0].lan).toBe('f2f3')
    expect(fens[0]).toContain('w KQkq') // White to move at the start
  })

  it('tolerates chess.com headers and clock comments', () => {
    const { history } = parsePgn(REAL_PGN)
    expect(history.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])
  })

  it('rejects an empty game', () => {
    expect(() => parsePgn('[Event "x"]\n*')).toThrow(/no moves/i)
  })
})

describe('reviewGame', () => {
  it('produces one reviewed move per half-move and splits by colour', async () => {
    const review = await reviewGame(REAL_PGN, flatEval)
    expect(review.moves).toHaveLength(6)
    expect(review.moves.filter((m) => m.color === 'w')).toHaveLength(3)
    expect(review.moves.filter((m) => m.color === 'b')).toHaveLength(3)

    const whiteTotal = Object.values(review.white.counts).reduce((a, b) => a + b, 0)
    expect(whiteTotal).toBe(3)
  })

  it('flags the blunders that walk into fool\'s mate', async () => {
    // Eval swings hard to Black as White self-destructs, then saturates at mate.
    const scripted: Evaluator = async (fens) =>
      fens.map((fen, index): PositionEval => {
        const whiteCp = [20, 15, -40, -350, undefined][index]
        const mate = index === 4 ? -1 : undefined
        return {
          fen,
          blackToMove: fen.split(' ')[1] === 'b',
          lines: [mate !== undefined ? { mate, pv: [], depth: 10 } : { cp: whiteCp ?? 0, pv: [], depth: 12 }],
        }
      })

    const review = await reviewGame(FOOLS_MATE, scripted)
    // White's two moves (f3, g4) should be poor; at least one blunder.
    const whiteBad = review.moves.filter((m) => m.color === 'w' && ['blunder', 'mistake'].includes(m.classification))
    expect(whiteBad.length).toBeGreaterThanOrEqual(1)
    expect(review.white.accuracy).toBeLessThan(review.black.accuracy)
  })

  it('computes bounded accuracy and estimated Elo', async () => {
    const review = await reviewGame(REAL_PGN, flatEval)
    expect(review.white.accuracy).toBeGreaterThan(90) // flat eval = no mistakes
    expect(review.white.estimatedElo).toBeGreaterThan(250)
    expect(review.white.estimatedElo).toBeLessThanOrEqual(3000)
  })
})
