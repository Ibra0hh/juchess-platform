import assert from 'node:assert/strict'
import test from 'node:test'
import { routeBoundaryKey } from '../lib/routePath.ts'

test('canonical trailing slashes do not remount the route tree', () => {
  assert.equal(routeBoundaryKey('/forgot-password/'), '/forgot-password')
  assert.equal(routeBoundaryKey('/forgot-password'), '/forgot-password')
  assert.equal(routeBoundaryKey('/'), '/')
})
