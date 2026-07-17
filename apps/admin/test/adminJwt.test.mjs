import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdminJwtCache } from '../src/lib/adminJwt.ts'

test('admin JWT cache deduplicates concurrent calls and refreshes before expiry', async () => {
  let now = 1_000
  let calls = 0
  const cache = createAdminJwtCache(
    async () => ({ jwt: `jwt-${++calls}` }),
    () => now,
    1_000,
    100,
  )

  const [first, concurrent] = await Promise.all([cache.get(), cache.get()])
  assert.equal(first, 'jwt-1')
  assert.equal(concurrent, 'jwt-1')
  assert.equal(calls, 1)
  now += 900
  assert.equal(await cache.get(), 'jwt-2')
})

test('admin JWT cache rejects a prior-session token that resolves after clear', async () => {
  const finishes = []
  const cache = createAdminJwtCache(() => new Promise((resolve) => finishes.push(resolve)))
  const prior = cache.get()
  cache.clear()
  const current = cache.get()

  finishes[0]?.({ jwt: 'prior' })
  await assert.rejects(prior, /session changed/i)
  finishes[1]?.({ jwt: 'current' })
  assert.equal(await current, 'current')
})
