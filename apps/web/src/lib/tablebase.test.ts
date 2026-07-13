import assert from 'node:assert/strict'
import test from 'node:test'
import { isTablebaseEligible, probeTablebase, tablebaseWinner } from './tablebase.ts'

const tablebaseFen = '4k3/6KP/8/8/8/8/7p/8 w - - 0 1'

test('limits tablebase requests to seven pieces or fewer', () => {
  assert.equal(isTablebaseEligible(tablebaseFen), true)
  assert.equal(isTablebaseEligible('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), false)
  assert.equal(isTablebaseEligible('not a fen'), false)
})

test('normalizes an exact tablebase result', async () => {
  const fetcher = async () => new Response(JSON.stringify({
    category: 'win',
    dtm: 17,
    dtz: 1,
    moves: [{ category: 'loss', dtm: -16, dtz: -2, san: 'h8=Q+', uci: 'h7h8q' }],
  }), { status: 200 })
  const result = await probeTablebase(tablebaseFen, { fetcher: fetcher as typeof fetch })

  assert.equal(result?.exact, true)
  assert.equal(result?.winner, 'white')
  assert.equal(result?.moves[0].san, 'h8=Q+')
})

test('respects the fifty-move result categories', () => {
  assert.equal(tablebaseWinner('cursed-win', 'white'), 'draw')
  assert.equal(tablebaseWinner('blessed-loss', 'black'), 'draw')
  assert.equal(tablebaseWinner('loss', 'black'), 'white')
})
