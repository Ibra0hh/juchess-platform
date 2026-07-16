import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampCropState,
  getCropRect,
  initialCropState,
  nestedPreviewRect,
  profileCropConfig,
} from './profileImageCrop.ts'

test('avatar crop starts centered and square', () => {
  const rect = getCropRect(4000, 2000, profileCropConfig.avatar.aspect, initialCropState(4000, 2000))

  assert.deepEqual(rect, { height: 2000, width: 2000, x: 1000, y: 0 })
})

test('zoom reduces the selected source area without changing its center', () => {
  const rect = getCropRect(4000, 2000, 1, { centerX: 2000, centerY: 1000, zoom: 2 })

  assert.deepEqual(rect, { height: 1000, width: 1000, x: 1500, y: 500 })
})

test('crop center is clamped so no empty area can enter the output', () => {
  const state = clampCropState(2400, 1200, 1, { centerX: -200, centerY: 4000, zoom: 2 })
  const rect = getCropRect(2400, 1200, 1, state)

  assert.equal(rect.x, 0)
  assert.equal(rect.y, 600)
})

test('mobile cover preview stays inside the saved wide cover crop', () => {
  const cover = getCropRect(3200, 1800, profileCropConfig.cover.aspect, initialCropState(3200, 1800))
  const mobile = nestedPreviewRect(cover, 2.2)

  assert.ok(mobile.x >= cover.x)
  assert.ok(mobile.y >= cover.y)
  assert.ok(mobile.x + mobile.width <= cover.x + cover.width)
  assert.ok(mobile.y + mobile.height <= cover.y + cover.height)
  assert.ok(Math.abs(mobile.width / mobile.height - 2.2) < 0.0001)
})
