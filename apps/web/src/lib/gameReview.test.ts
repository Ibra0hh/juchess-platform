import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyReviewMove,
  estimateGameRating,
  expectedScore,
  isOpeningBookMove,
  moveAccuracyFromLoss,
  parseAnalysisPosition,
  parseReviewGame,
  parseStockfishOutput,
  phaseClassificationForAccuracy,
  reviewPhaseForPosition,
  reviewGameIdentity,
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

test('keeps review sessions scoped to the exact selected game', () => {
  const first = reviewGameIdentity({
    id: 'game-1',
    key: 'chess.com-game-1',
    moves: ['e4', 'e5'],
    source: 'chess.com',
  })
  const second = reviewGameIdentity({
    id: 'game-2',
    key: 'chess.com-game-2',
    moves: ['d4', 'd5'],
    source: 'chess.com',
  })
  const updatedFirst = reviewGameIdentity({
    id: 'game-1',
    key: 'chess.com-game-1',
    moves: ['e4', 'e5', 'Nf3'],
    source: 'chess.com',
  })

  assert.notEqual(first, second)
  assert.notEqual(first, updatedFirst)
})

test('normalizes UCI scores to White perspective', () => {
  const blackToMoveFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const parsed = parseStockfishOutput([
    'info depth 11 multipv 1 score cp 42 wdl 700 200 100 nodes 100 pv g8f6',
    'info depth 11 multipv 2 score cp 30 wdl 650 250 100 nodes 100 pv b8c6',
    'bestmove g8f6',
  ], blackToMoveFen)

  assert.equal(parsed.evaluation, -0.42)
  assert.equal(parsed.lines[1].evaluation, -0.3)
  assert.ok(Math.abs((parsed.whiteExpectedScore ?? 0) - 0.2) < 0.0001)
  assert.equal(parsed.bestMove, 'g8f6')
})

test('builds the exact current position for live analysis', () => {
  const parsed = parseAnalysisPosition({ moves: ['e4', 'e5', 'Nf3', 'Nc6'] })

  assert.deepEqual(parsed.uciMoves, ['e2e4', 'e7e5', 'g1f3', 'b8c6'])
  assert.equal(parsed.currentFen.split(' ')[1], 'w')
  assert.match(parsed.currentFen, /^r1bqkbnr\/pppp1ppp\/2n5\/4p3\/4P3\/5N2\/PPPP1PPP\/RNBQKB1R w /)
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

  assert.equal(classifyReviewMove({
    afterEvaluation: 0.1,
    beforeEvaluation: 2,
    bestMove: 'd1h5',
    legalMoves: 24,
    mover: 'w',
    playedMove: 'a2a3',
  }), 'Miss')

  assert.equal(classifyReviewMove({
    afterEvaluation: 1.2,
    alternateEvaluation: -1,
    beforeEvaluation: 1.1,
    bestMove: 'f3h4',
    isSacrifice: true,
    legalMoves: 28,
    mover: 'w',
    playedMove: 'f3h4',
  }), 'Brilliant')

  assert.equal(classifyReviewMove({
    afterEvaluation: -0.5,
    afterExpectedScore: 0.52,
    beforeEvaluation: 0.8,
    beforeExpectedScore: 0.58,
    bestMove: 'g1f3',
    legalMoves: 22,
    mover: 'w',
    playedMove: 'b1c3',
  }), 'Good')
})

test('recognizes established opening-book sequences', () => {
  const ruyLopez = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']
  assert.equal(isOpeningBookMove(ruyLopez, 4), true)
  assert.equal(isOpeningBookMove(['h2h4'], 0), false)
})

test('accuracy and expected-score helpers stay bounded', () => {
  assert.equal(expectedScore(0, 'w'), 0.5)
  assert.equal(moveAccuracyFromLoss(0), 100)
  assert.ok(moveAccuracyFromLoss(0.2) < 100)
  assert.ok(moveAccuracyFromLoss(10) >= 0)
})

test('game ratings and phase grades are stable and bounded', () => {
  assert.equal(estimateGameRating(100, 1800), 2100)
  assert.equal(estimateGameRating(0, 100), 100)
  assert.equal(phaseClassificationForAccuracy(96), 'Excellent')
  assert.equal(phaseClassificationForAccuracy(84), 'Good')
  assert.equal(phaseClassificationForAccuracy(72), 'Inaccuracy')
  assert.equal(phaseClassificationForAccuracy(50), 'Mistake')
  assert.equal(phaseClassificationForAccuracy(20), 'Blunder')
})

test('review phases progress from opening through a detected endgame', () => {
  const queenlessFen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
  assert.equal(reviewPhaseForPosition(4, queenlessFen), 'Opening')
  assert.equal(reviewPhaseForPosition(14, queenlessFen), 'Middlegame')
  assert.equal(reviewPhaseForPosition(24, queenlessFen), 'Endgame')
})
