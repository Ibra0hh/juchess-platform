import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREW_APPLICATION_STATUSES,
  normalizeCrewReviewInput,
} from '../src/main.js';

test('crew review input accepts the complete workflow', () => {
  for (const status of CREW_APPLICATION_STATUSES) {
    assert.equal(normalizeCrewReviewInput({ status }).status, status);
  }
});

test('crew review input trims notes and validates interview dates', () => {
  const value = normalizeCrewReviewInput({
    status: 'interview',
    internalNotes: '  Strong software portfolio.  ',
    assignedTo: ' HR Lead ',
    interviewAt: '2026-08-01T12:00:00.000Z',
  });
  assert.equal(value.internalNotes, 'Strong software portfolio.');
  assert.equal(value.assignedTo, 'HR Lead');
  assert.throws(() => normalizeCrewReviewInput({ interviewAt: 'not-a-date' }), /valid interview/i);
  assert.throws(() => normalizeCrewReviewInput({ status: 'approved-by-me' }), /valid application status/i);
});
