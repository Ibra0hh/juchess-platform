import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCurrentEmailVerificationState } from './emailVerificationState.ts'

test('a verified signed-in account wins over an expired link user ID', () => {
  assert.equal(resolveCurrentEmailVerificationState({
    $id: 'signed-in-player',
    emailVerification: true,
  }, 'expired-link-player'), 'verified')
})

test('an unverified signed-in account is only trusted for its own link', () => {
  assert.equal(resolveCurrentEmailVerificationState({
    $id: 'signed-in-player',
    emailVerification: false,
  }, 'signed-in-player'), 'unverified')
  assert.equal(resolveCurrentEmailVerificationState({
    $id: 'signed-in-player',
    emailVerification: false,
  }, 'different-player'), 'unknown')
})
