import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyReviewMove,
  expectedScore,
  moveAccuracyFromLoss,
  parseReviewGame,
  parseStockfishOutput,
} from './gameReview.ts'

test('parses PGN into SAN, UCI, and every board position', () => {
  const parsed = parseReviewGame({
    pgn: '[White "Ibrahim"]\n[Black "Sara"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *',
  })

  assert.deepEqual(parsed.moves, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
  assert.deepEqual(parsed.uciMoves, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])
  assert.equal(parsed.fens.length, parsed.moves.length + 1)
  assert.equal(parsed.headers.White, 'Ibrahim')
})

test('normalizes UCI scores to White perspective', () => {
  const blackToMoveFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const parsed = parseStockfishOutput([
    'info depth 11 multipv 1 score cp 42 nodes 100 pv g8f6',
    'info depth 11 multipv 2 score cp 30 nodes 100 pv b8c6',
    'bestmove g8f6',
  ], blackToMoveFen)

  assert.equal(parsed.evaluation, -0.42)
  assert.equal(parsed.lines[1].evaluation, -0.3)
  assert.equal(parsed.bestMove, 'g8f6')
})

test('classifies exact engine choices and large expected-score losses', () => {
  assert.equal(classifyReviewMove({
    afterEvaluation: 0.3,
    alternateEvaluation: -1.5,
    beforeEvaluation: 0.2,
    bestMove: 'e2e4',
    legalMoves: 20,
    mover: 'w',
    playedMove: 'e2e4',
  }), 'Great')

  assert.equal(classifyReviewMove({
    afterEvaluation: -4,
    beforeEvaluation: 0.4,
    bestMove: 'd2d4',
    legalMoves: 20,
    mover: 'w',
    playedMove: 'f2f3',
  }), 'Blunder')
})

test('accuracy and expected-score helpers stay bounded', () => {
  assert.equal(expectedScore(0, 'w'), 0.5)
  assert.equal(moveAccuracyFromLoss(0), 100)
  assert.ok(moveAccuracyFromLoss(0.2) < 100)
  assert.ok(moveAccuracyFromLoss(10) >= 0)
})
