import assert from 'node:assert/strict';
import test from 'node:test';
import { hashAttendanceToken, isInvitationExpired } from '../src/main.js';

test('attendance tokens are hashed deterministically without storing the token', () => {
  assert.equal(hashAttendanceToken('one-token'), hashAttendanceToken('one-token'));
  assert.notEqual(hashAttendanceToken('one-token'), hashAttendanceToken('another-token'));
  assert.match(hashAttendanceToken('one-token'), /^[a-f0-9]{64}$/);
});

test('attendance invitation expiry is enforced at the deadline', () => {
  const row = { tokenExpiresAt: '2026-07-12T12:00:00.000Z' };
  assert.equal(isInvitationExpired(row, Date.parse('2026-07-12T11:59:59.999Z')), false);
  assert.equal(isInvitationExpired(row, Date.parse('2026-07-12T12:00:00.000Z')), true);
  assert.equal(isInvitationExpired({}, Date.now()), true);
});
