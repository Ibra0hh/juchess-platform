import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasPasswordRecoveryParams,
  normalizePasswordRecoveryCode,
  parsePasswordRecoveryEntry,
} from './passwordRecoveryState.ts'

test('custom and legacy recovery links require complete, unmixed credentials', () => {
  assert.deepEqual(
    parsePasswordRecoveryEntry('?challenge=challenge-1&token=token-1'),
    {
      kind: 'link',
      source: 'url',
      credential: { kind: 'custom', challengeId: 'challenge-1', token: 'token-1' },
    },
  )
  assert.deepEqual(
    parsePasswordRecoveryEntry('?userId=user-1&secret=secret-1'),
    {
      kind: 'link',
      source: 'url',
      credential: { kind: 'legacy', userId: 'user-1', secret: 'secret-1' },
    },
  )
  assert.deepEqual(parsePasswordRecoveryEntry('?challenge=challenge-1'), { kind: 'invalid' })
  assert.deepEqual(parsePasswordRecoveryEntry('?challenge=one&token=two&userId=three&secret=four'), { kind: 'invalid' })
})

test('a stripped recovery credential survives refresh through history state', () => {
  assert.deepEqual(
    parsePasswordRecoveryEntry('', {
      passwordRecoveryCredential: { kind: 'custom', challengeId: 'challenge-1', token: 'token-1' },
    }),
    {
      kind: 'link',
      source: 'history',
      credential: { kind: 'custom', challengeId: 'challenge-1', token: 'token-1' },
    },
  )
  assert.deepEqual(parsePasswordRecoveryEntry('', null), { kind: 'request' })
})

test('recovery query detection and six-digit normalization are strict', () => {
  assert.equal(hasPasswordRecoveryParams('?unrelated=value'), false)
  assert.equal(hasPasswordRecoveryParams('?secret=sensitive'), true)
  assert.equal(normalizePasswordRecoveryCode(' 12-34 5678 '), '123456')
})
