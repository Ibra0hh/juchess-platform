import assert from 'node:assert/strict'
import test from 'node:test'
import { playerFunctionHeaders } from './functionAuth.ts'
import { createFunctionJwtCache } from './functionJwt.ts'

test('player Function requests carry the short-lived account JWT', () => {
  assert.deepEqual(playerFunctionHeaders('signed-user-token'), {
    'content-type': 'application/json',
    'juchess-player-jwt': 'signed-user-token',
  })
})

test('Function JWT cache deduplicates concurrent requests and reuses a fresh token', async () => {
  let calls = 0
  let finish: ((value: { jwt: string }) => void) | undefined
  const cache = createFunctionJwtCache(() => {
    calls += 1
    return new Promise((resolve) => { finish = resolve })
  })

  const first = cache.get()
  const concurrent = cache.get()
  assert.equal(calls, 1)
  finish?.({ jwt: 'jwt-one' })
  assert.equal(await first, 'jwt-one')
  assert.equal(await concurrent, 'jwt-one')
  assert.equal(await cache.get(), 'jwt-one')
  assert.equal(calls, 1)
})

test('Function JWT cache refreshes near expiry and clears on session changes', async () => {
  let now = 1_000
  let calls = 0
  const cache = createFunctionJwtCache(
    async () => ({ jwt: `jwt-${++calls}` }),
    () => now,
    1_000,
    100,
  )

  assert.equal(await cache.get(), 'jwt-1')
  now += 899
  assert.equal(await cache.get(), 'jwt-1')
  now += 1
  assert.equal(await cache.get(), 'jwt-2')
  cache.clear()
  assert.equal(await cache.get(), 'jwt-3')
})

test('clearing during an in-flight JWT issue rejects and never caches the prior session token', async () => {
  const finishes: Array<(value: { jwt: string }) => void> = []
  const cache = createFunctionJwtCache(() => new Promise((resolve) => finishes.push(resolve)))

  const priorSessionRequest = cache.get()
  cache.clear()
  const currentSessionRequest = cache.get()

  finishes[0]?.({ jwt: 'prior-session-jwt' })
  await assert.rejects(priorSessionRequest, /session changed/i)
  finishes[1]?.({ jwt: 'current-session-jwt' })
  assert.equal(await currentSessionRequest, 'current-session-jwt')
  assert.equal(await cache.get(), 'current-session-jwt')
})
