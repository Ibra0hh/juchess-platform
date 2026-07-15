import assert from 'node:assert/strict'
import test from 'node:test'
import { playerFunctionHeaders } from './functionAuth.ts'

test('player Function requests carry the short-lived account JWT', () => {
  assert.deepEqual(playerFunctionHeaders('signed-user-token'), {
    'content-type': 'application/json',
    'juchess-player-jwt': 'signed-user-token',
  })
})
