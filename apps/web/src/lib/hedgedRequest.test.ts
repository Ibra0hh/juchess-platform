import assert from 'node:assert/strict'
import test from 'node:test'

import { runHedgedRequest } from './hedgedRequest.ts'

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

test('does not start a backup when the primary request finishes promptly', async () => {
  let attempts = 0
  const result = await runHedgedRequest(async () => {
    attempts += 1
    return 'primary'
  }, 10)

  await wait(20)
  assert.equal(result, 'primary')
  assert.equal(attempts, 1)
})

test('uses a backup when the primary request stalls', async () => {
  let attempts = 0
  const result = await runHedgedRequest(() => {
    attempts += 1
    if (attempts === 1) return new Promise<string>(() => undefined)
    return Promise.resolve('backup')
  }, 5)

  assert.equal(result, 'backup')
  assert.equal(attempts, 2)
})

test('starts the backup immediately when the primary request fails', async () => {
  let attempts = 0
  const result = await runHedgedRequest(() => {
    attempts += 1
    return attempts === 1
      ? Promise.reject(new Error('temporary failure'))
      : Promise.resolve('backup')
  }, 1_000)

  assert.equal(result, 'backup')
  assert.equal(attempts, 2)
})

test('rejects after both requests fail', async () => {
  let attempts = 0
  await assert.rejects(
    runHedgedRequest(async () => {
      attempts += 1
      throw new Error(`failure ${attempts}`)
    }, 1_000),
    /failure 2/,
  )
  assert.equal(attempts, 2)
})
