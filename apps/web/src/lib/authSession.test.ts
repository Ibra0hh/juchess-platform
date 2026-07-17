import assert from 'node:assert/strict'
import test from 'node:test'

import { isExistingSessionError, normalizeAccountEmail } from './authSession.ts'

test('recognizes Appwrite active-session conflicts by response type', () => {
  assert.equal(isExistingSessionError({ type: 'user_session_already_exists' }), true)
  assert.equal(isExistingSessionError({ type: 'user_invalid_credentials' }), false)
})

test('recognizes the legacy active-session conflict message', () => {
  assert.equal(isExistingSessionError({
    message: 'Creation of a session is prohibited when a session is active.',
  }), true)
})

test('account email comparison ignores case and surrounding spaces', () => {
  assert.equal(normalizeAccountEmail(' Player@Example.com '), 'player@example.com')
})
