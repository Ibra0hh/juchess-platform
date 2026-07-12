import assert from 'node:assert/strict';
import test from 'node:test';
import {
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

test('confirmed and checked-in registrations win duplicate resolution', () => {
  const rows = [
    { $id: 'pending', $createdAt: '2026-07-12T00:00:00Z', status: 'pending', checkedIn: false },
    { $id: 'confirmed', $createdAt: '2026-07-12T00:00:01Z', status: 'confirmed', checkedIn: false },
    { $id: 'checked-in', $createdAt: '2026-07-12T00:00:02Z', status: 'pending', checkedIn: true },
  ];

  assert.equal(selectCanonicalRegistration(rows).$id, 'checked-in');
  assert.equal(selectCanonicalRegistration(rows.slice(0, 2)).$id, 'confirmed');
});
