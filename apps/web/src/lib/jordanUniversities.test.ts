import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isListedJordanUniversity,
  JORDAN_UNIVERSITIES,
  OTHER_UNIVERSITY_VALUE,
} from './jordanUniversities.ts'

test('Jordan university choices are unique and do not expose the custom sentinel', () => {
  assert.equal(new Set(JORDAN_UNIVERSITIES).size, JORDAN_UNIVERSITIES.length)
  assert.equal(JORDAN_UNIVERSITIES.includes(OTHER_UNIVERSITY_VALUE), false)
})

test('official and custom university names are classified correctly', () => {
  assert.equal(isListedJordanUniversity('University of Jordan'), true)
  assert.equal(isListedJordanUniversity('My International University'), false)
})
