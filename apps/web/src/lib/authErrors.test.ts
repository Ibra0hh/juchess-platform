import assert from 'node:assert/strict'
import test from 'node:test'

import { formatAuthError, isUnknownAccountRecoveryError } from './authErrors.ts'

test('authentication errors use player-friendly messages', () => {
  assert.equal(formatAuthError({ type: 'user_invalid_credentials', message: 'Invalid credentials.' }), 'Email or password is incorrect.')
  assert.match(formatAuthError({ type: 'user_already_exists' }), /already exists/i)
  assert.match(formatAuthError({ type: 'user_invalid_token' }), /invalid or expired/i)
  assert.match(formatAuthError({ type: 'password_recently_used' }), /not used recently/i)
  assert.match(formatAuthError(new Error('Failed to fetch')), /connection/i)
  assert.equal(formatAuthError(new Error('Appwrite service is warming up.')), 'cloud service is warming up.')
  assert.doesNotMatch(
    formatAuthError({ type: 'general_argument_invalid', message: 'Internal SDK parameter detail' }),
    /SDK parameter/i,
  )
  assert.match(formatAuthError({ code: 503, message: 'internal upstream detail' }), /temporarily unavailable/i)
})

test('password recovery can hide unknown-account responses', () => {
  assert.equal(isUnknownAccountRecoveryError({ type: 'user_not_found' }), true)
  assert.equal(isUnknownAccountRecoveryError({ code: 404, message: 'User was not found.' }), true)
  assert.equal(isUnknownAccountRecoveryError({ type: 'general_rate_limit_exceeded' }), false)
})
