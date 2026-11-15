import test from 'node:test'
import assert from 'node:assert/strict'
import { consumeAdminGoogleReturn, createAdminGoogleAttempt } from '../src/lib/adminGoogleAttempt.ts'

function storage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

function callback(stored, kind = 'success') {
  const urls = createAdminGoogleAttempt(stored, new URL('https://juchess.page/admin/'), 'test-nonce', 500)
  const url = new URL(urls[kind])
  assert.equal(url.origin + url.pathname, 'https://juchess.page/admin/')
  if (kind === 'success') {
    url.searchParams.set('userId', 'account-id')
    url.searchParams.set('secret', 'one-time-token')
  }
  return url.searchParams
}

test('OAuth return must match a recent, one-use attempt in that tab', () => {
  const tab = storage()
  const params = callback(tab)
  assert.match(consumeAdminGoogleReturn(params, storage(), 600).error, /did not start/)
  const wrong = new URLSearchParams(params)
  wrong.set('attempt', 'wrong-nonce')
  assert.match(consumeAdminGoogleReturn(wrong, tab, 600).error, /did not start/)
  assert.deepEqual(consumeAdminGoogleReturn(params, tab, 600), { userId: 'account-id', secret: 'one-time-token' })
  assert.match(consumeAdminGoogleReturn(params, tab, 601).error, /did not start/)
  assert.match(consumeAdminGoogleReturn(callback(tab), tab, 901000).error, /expired/)
})

test('cancelled and incomplete callbacks cannot be exchanged for a session', () => {
  const tab = storage()
  assert.equal(consumeAdminGoogleReturn(new URLSearchParams(), tab), null)
  assert.match(consumeAdminGoogleReturn(callback(tab, 'failure'), tab, 600).error, /cancelled/)
  const incomplete = callback(tab)
  incomplete.delete('secret')
  assert.match(consumeAdminGoogleReturn(incomplete, tab, 600).error, /incomplete/)
})
