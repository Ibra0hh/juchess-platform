import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCompletePlayerProfile,
  attendanceRowId,
  attendanceWindowState,
  buildPrivateProfileData,
  isCompletePlayerProfile,
  mergeOwnerProfile,
  normalizePhone,
  normalizeProfileUpdate,
  normalizeUniversityId,
  profilePermissions,
  registrationRowId,
  saveOwnerProfile,
  selectCanonicalRegistration,
} from '../src/main.js';

const completePublicProfile = {
  displayName: 'Student Knight',
  university: 'University of Jordan',
};

const completePrivateProfile = {
  universityId: '0201234',
  phone: '+962791234567',
};

test('profile creation requires every membership field before any write can begin', () => {
  assert.equal(isCompletePlayerProfile(completePublicProfile, completePrivateProfile), true);
  assert.doesNotThrow(() => assertCompletePlayerProfile(completePublicProfile, completePrivateProfile));

  for (const [target, field] of [
    ['public', 'displayName'],
    ['public', 'university'],
    ['private', 'universityId'],
    ['private', 'phone'],
  ]) {
    const publicProfile = target === 'public'
      ? { ...completePublicProfile, [field]: '  ' }
      : completePublicProfile;
    const privateProfile = target === 'private'
      ? { ...completePrivateProfile, [field]: null }
      : completePrivateProfile;

    assert.throws(
      () => assertCompletePlayerProfile(publicProfile, privateProfile),
      (error) => error.statusCode === 400 && /required before a JuChess profile can be created/.test(error.message),
      field,
    );
  }
});

test('an incomplete first profile submission starts no database transaction', async () => {
  let transactionCalls = 0;
  const tablesDB = {
    async listRows() {
      return { rows: [] };
    },
    async createTransaction() {
      transactionCalls += 1;
      throw new Error('A transaction must not start for incomplete profile data.');
    },
  };

  await assert.rejects(
    saveOwnerProfile(
      tablesDB,
      'juchess',
      { $id: 'google-auth-id', email: 'student@example.com', name: 'Google Name' },
      { displayName: 'Google Name' },
    ),
    (error) => error.statusCode === 400 && /required before a JuChess profile can be created/.test(error.message),
  );
  assert.equal(transactionCalls, 0);
});

test('profile updates separate editable public and private fields', () => {
  assert.deepEqual(normalizeProfileUpdate({
    displayName: '  Student Knight  ',
    university: '  University of Jordan  ',
    universityId: '  0201234  ',
    phone: '079 123 4567',
    chessComUsername: '  JuKnight  ',
  }), {
    publicData: {
      displayName: 'Student Knight',
      university: 'University of Jordan',
      chessComUsername: 'juknight',
    },
    privateData: {
      universityId: '0201234',
      phone: '+962791234567',
    },
  });
  assert.equal(normalizeUniversityId('  JU-AbC  '), 'ju-abc');
  assert.equal(normalizePhone('00962 79 123 4567'), '+962791234567');
});

test('private profile writes always bind the required matching profile ID', () => {
  assert.deepEqual(buildPrivateProfileData(
    'profile-1',
    { $id: 'account-1', email: ' Owner@Example.com ' },
    { universityId: 'old-id', phone: '+962790000000' },
    { universityId: 'new-id' },
  ), {
    profileId: 'profile-1',
    accountId: 'account-1',
    email: 'owner@example.com',
    universityId: 'new-id',
    phone: '+962790000000',
  });
});

test('profile updates reject every server-owned identity and moderation field', () => {
  for (const field of ['accountId', 'email', 'rating', 'role', 'status', 'profileId', '$id']) {
    assert.throws(
      () => normalizeProfileUpdate({ [field]: 'attacker-controlled' }),
      (error) => error.statusCode === 400 && /managed by JuChess/.test(error.message),
      field,
    );
  }
  assert.throws(
    () => normalizeProfileUpdate({ surprise: true }),
    (error) => error.statusCode === 400 && /unsupported profile fields/i.test(error.message),
  );
});

test('owner profile DTO exposes private identity only from the private join', () => {
  const row = mergeOwnerProfile({
    $id: 'profile-1',
    displayName: 'Public Name',
    status: 'pending',
    accountId: 'legacy-account',
    email: 'legacy@example.com',
    universityId: 'legacy-id',
  }, {
    accountId: 'private-account',
    email: 'Private@Example.com',
    universityId: 'private-id',
    phone: '+962790000000',
  });

  assert.equal(row.accountId, 'private-account');
  assert.equal(row.email, 'private@example.com');
  assert.equal(row.universityId, 'private-id');
  assert.equal(row.phone, '+962790000000');
  assert.equal(row.displayName, 'Public Name');

  const cleared = mergeOwnerProfile({
    $id: 'profile-1',
    universityId: 'legacy-id',
    phone: 'legacy-phone',
  }, { accountId: 'private-account', universityId: null, phone: null });
  assert.equal(cleared.universityId, null);
  assert.equal(cleared.phone, null);
});

test('public profile permissions never grant client update access', () => {
  assert.deepEqual(profilePermissions('active', 'account-1'), [
    'read("any")',
    'read("user:account-1")',
  ]);
  assert.deepEqual(profilePermissions('pending', 'account-1'), ['read("user:account-1")']);
  assert.deepEqual(profilePermissions('suspended', 'account-1'), ['read("user:account-1")']);
  assert.equal(profilePermissions('pending', 'account-1').some((value) => value.startsWith('update(')), false);
});

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
