import assert from 'node:assert/strict'
import test from 'node:test'

import { parseStoredMoves } from './storedMoves.ts'

const oneMovePgn = `[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]

1. e4 *`

test('PGN headers do not count as chess moves', () => {
  assert.deepEqual(parseStoredMoves(oneMovePgn), ['e4'])
  assert.equal(parseStoredMoves(oneMovePgn).length % 2, 1, 'Black must move after White plays e4')
})

test('turn returns to White after Black replies', () => {
  const pgn = oneMovePgn.replace('1. e4 *', '1. e4 e5 *')
  assert.deepEqual(parseStoredMoves(pgn), ['e4', 'e5'])
  assert.equal(parseStoredMoves(pgn).length % 2, 0, 'White must move after Black replies e5')
})

test('legacy move text is parsed as legal SAN only', () => {
  assert.deepEqual(parseStoredMoves('1. e4 {first move} e5 2. Nf3!? Nc6 *'), [
    'e4',
    'e5',
    'Nf3',
    'Nc6',
  ])
})
