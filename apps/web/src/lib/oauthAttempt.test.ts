import assert from 'node:assert/strict'
import test from 'node:test'
import { consumeOAuthAttempt, storeOAuthAttempt } from './oauthAttempt.ts'

function sessionStorage() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value) },
    removeItem: (key: string) => { entries.delete(key) },
  }
}

test('an OAuth attempt is specific to the initiating tab and usable once', () => {
  const storage = sessionStorage()
  storeOAuthAttempt(storage, 'first', 10)
  assert.equal(consumeOAuthAttempt(sessionStorage(), 'first', 11), false)
  assert.equal(consumeOAuthAttempt(storage, null, 11), false)
  assert.equal(consumeOAuthAttempt(storage, 'unrelated', 11), false)
  assert.equal(consumeOAuthAttempt(storage, 'first', 11), true)
  assert.equal(consumeOAuthAttempt(storage, 'first', 12), false)
})

test('an expired or replaced OAuth attempt cannot finish', () => {
  const storage = sessionStorage()
  storeOAuthAttempt(storage, 'first', 0)
  storeOAuthAttempt(storage, 'second', 1)
  assert.equal(consumeOAuthAttempt(storage, 'first', 2), false)
  assert.equal(consumeOAuthAttempt(storage, 'second', 1 + 15 * 60 * 1000), false)
})
