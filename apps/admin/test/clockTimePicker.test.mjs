import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clockHandAngle,
  clockLabelAngle,
  clockValueFromPoint,
} from '../src/lib/clockTimePicker.ts'

test('minute labels and hand use the same clock geometry', () => {
  assert.equal(clockLabelAngle('minute', 0), 0)
  assert.equal(clockLabelAngle('minute', 9), 270)
  assert.equal(clockHandAngle('minute', 45), 270)
  assert.equal(clockHandAngle('minute', 40), 240)
})

test('hour labels preserve the conventional 12-at-top layout', () => {
  assert.equal(clockLabelAngle('hour', 0), 30)
  assert.equal(clockLabelAngle('hour', 11), 0)
  assert.equal(clockHandAngle('hour', 12), 0)
})

test('pointer coordinates select the number they visually point to', () => {
  assert.equal(clockValueFromPoint('minute', 0, -1), 0)
  assert.equal(clockValueFromPoint('minute', 1, 0), 15)
  assert.equal(clockValueFromPoint('minute', 0, 1), 30)
  assert.equal(clockValueFromPoint('minute', -1, 0), 45)
  assert.equal(clockValueFromPoint('hour', 0, -1), 12)
  assert.equal(clockValueFromPoint('hour', 1, 0), 3)
})
