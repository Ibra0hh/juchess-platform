import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeJordanMobile, validateRequiredPlayerProfile } from './profileValidation.ts'

const completeProfile = {
  displayName: 'Student Knight',
  university: 'University of Jordan',
  universityId: '0201234',
  phone: '079 123 4567',
}

test('Jordan mobile numbers normalize consistently', () => {
  assert.equal(normalizeJordanMobile('079 123 4567'), '+962791234567')
  assert.equal(normalizeJordanMobile('00962 79 123 4567'), '+962791234567')
  assert.equal(normalizeJordanMobile('+962-79-123-4567'), '+962791234567')
})

test('profile completion rejects malformed required identity data', () => {
  assert.equal(validateRequiredPlayerProfile(completeProfile), null)
  assert.match(validateRequiredPlayerProfile({ ...completeProfile, phone: '123' }) ?? '', /Jordan mobile/i)
  assert.match(validateRequiredPlayerProfile({ ...completeProfile, displayName: '' }) ?? '', /required/i)
  assert.match(validateRequiredPlayerProfile({ ...completeProfile, chessComUsername: 'two words' }) ?? '', /spaces/i)
  assert.match(validateRequiredPlayerProfile({ ...completeProfile, lichessUsername: 'x'.repeat(81) }) ?? '', /80/i)
})
