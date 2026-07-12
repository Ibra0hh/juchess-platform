import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attendanceRowId,
  attendanceWindowState,
  registrationRowId,
  selectCanonicalRegistration,
} from '../src/main.js';

test('registration row IDs are deterministic and Appwrite-safe', () => {
  const first = registrationRowId('tournament-1', 'profile-1');
  const second = registrationRowId('tournament-1', 'profile-1');

  assert.equal(first, second);
  assert.match(first, /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/);
  assert.ok(first.length <= 36);
  assert.notEqual(first, registrationRowId('tournament-1', 'profile-2'));
});

test('confirmed registrations win duplicate resolution without legacy check-in state', () => {
  const rows = [
    { $id: 'pending', $createdAt: '2026-07-12T00:00:00Z', status: 'pending', checkedIn: false },
    { $id: 'confirmed', $createdAt: '2026-07-12T00:00:01Z', status: 'confirmed', checkedIn: false },
    { $id: 'checked-in', $createdAt: '2026-07-12T00:00:02Z', status: 'pending', checkedIn: true },
  ];

  assert.equal(selectCanonicalRegistration(rows).$id, 'confirmed');
  assert.equal(selectCanonicalRegistration(rows.slice(0, 2)).$id, 'confirmed');
});

test('attendance row IDs are deterministic and Appwrite-safe', () => {
  const id = attendanceRowId('registration-1');
  assert.equal(id, attendanceRowId('registration-1'));
  assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/);
  assert.notEqual(id, attendanceRowId('registration-2'));
});

test('attendance answers open for the final hour and close at the start time', () => {
  const now = Date.parse('2026-07-12T12:00:00.000Z');
  assert.equal(attendanceWindowState('2026-07-12T13:00:00.001Z', now), 'early');
  assert.equal(attendanceWindowState('2026-07-12T13:00:00.000Z', now), 'open');
  assert.equal(attendanceWindowState('2026-07-12T12:00:00.000Z', now), 'closed');
  assert.equal(attendanceWindowState(null, now), 'unscheduled');
});
