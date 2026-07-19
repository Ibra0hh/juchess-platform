import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCompletePlayerProfile,
  assertSubmittedIdentityAllowed,
  activateCompleteOwnerProfile,
  attendanceRowId,
  attendanceWindowState,
  buildPrivateProfileData,
  findReclaimablePrivateIdentities,
  findReclaimablePhoneIdentity,
  isCompletePlayerProfile,
  loadProfileContext,
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

function queryAttribute(options) {
  for (const query of options.queries ?? []) {
    const parsed = typeof query === 'string' ? JSON.parse(query) : query;
    if (parsed.method === 'equal') return parsed.attribute;
  }
  return null;
}

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

test('an unverified email account cannot create a JuChess profile', async () => {
  let databaseCalls = 0;
  const tablesDB = {
    async listRows() {
      databaseCalls += 1;
      return { rows: [] };
    },
  };

  await assert.rejects(
    saveOwnerProfile(
      tablesDB,
      'juchess',
      {
        $id: 'unverified-account',
        email: 'student@example.com',
        emailVerification: false,
      },
      {
        displayName: 'Student Knight',
        university: 'University of Jordan',
        universityId: '0201234',
        phone: '0791234567',
      },
    ),
    (error) => error.statusCode === 403 && /verify your email/i.test(error.message),
  );
  assert.equal(databaseCalls, 0);
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

test('profile validation rejects malformed values before they reach Appwrite', () => {
  for (const body of [null, [], 'not-an-object']) {
    assert.throws(
      () => normalizeProfileUpdate(body),
      (error) => error.statusCode === 400 && /JSON object/.test(error.message),
    );
  }

  for (const [body, message] of [
    [{ displayName: 'x'.repeat(129) }, /Full name must be 128 characters or fewer/],
    [{ university: 'x'.repeat(161) }, /University must be 160 characters or fewer/],
    [{ chessComUsername: 'two words' }, /cannot contain spaces/],
    [{ lichessUsername: 'x'.repeat(81) }, /80 characters or fewer/],
    [{ avatarFileId: '../not-a-file-id' }, /Avatar file ID is invalid/],
    [{ boardTheme: 'x'.repeat(121) }, /Board theme must be 120 characters or fewer/],
    [{ universityId: 'student id!' }, /University ID may contain only/],
    [{ phone: '07912abc4567' }, /valid Jordan mobile number/],
    [{ phone: '+12025550123' }, /valid Jordan mobile number/],
    [{ displayName: { injected: true } }, /Full name must be text/],
    [{ university: 'University\u0000Name' }, /unsupported characters/],
  ]) {
    assert.throws(
      () => normalizeProfileUpdate(body),
      (error) => error.statusCode === 400 && message.test(error.message),
      JSON.stringify(body),
    );
  }

  assert.equal(normalizeProfileUpdate({ displayName: 'x'.repeat(128) }).publicData.displayName.length, 128);
  assert.equal(normalizeUniversityId('ABC_123/4'), 'abc_123/4');
});

test('canonical profile lookup propagates database failures instead of inventing a missing profile', async () => {
  const outage = Object.assign(new Error('database unavailable'), { code: 503 });
  await assert.rejects(
    loadProfileContext({ async listRows() { throw outage; } }, 'juchess', 'account-1'),
    (error) => error === outage,
  );

  const identity = { $id: 'profile-1', profileId: 'profile-1', accountId: 'account-1' };
  await assert.rejects(
    loadProfileContext({
      async listRows() { return { rows: [identity] }; },
      async getRow() { throw outage; },
    }, 'juchess', 'account-1'),
    (error) => error === outage,
  );

  assert.deepEqual(
    await loadProfileContext({
      async listRows() { return { rows: [identity] }; },
      async getRow() { throw { code: 404 }; },
    }, 'juchess', 'account-1'),
    { profile: null, identity },
  );
});

test('profile activation checks the canonical account email against identity blocks', async () => {
  await assert.rejects(
    assertSubmittedIdentityAllowed(
      {
        async listRows(options) {
          assert.equal(options.tableId, 'identity_blocks');
          return {
            rows: [{
              $id: 'email-block',
              type: 'email',
              value: 'blocked@example.com',
              status: 'active',
              reason: 'Membership access revoked.',
            }],
          };
        },
      },
      'juchess',
      { email: 'blocked@example.com', universityId: '0201234', phone: '+962791234567' },
    ),
    (error) => error.statusCode === 403 && error.message === 'Membership access revoked.',
  );
});

test('saving a profile cannot bypass an email block by omitting email from the request body', async () => {
  let transactionCalls = 0;
  await assert.rejects(
    saveOwnerProfile(
      {
        async listRows(options) {
          if (options.tableId === 'profile_private') return { rows: [] };
          if (options.tableId === 'identity_blocks') {
            return {
              rows: [{
                $id: 'email-block',
                type: 'email',
                value: 'blocked@example.com',
                status: 'active',
              }],
            };
          }
          throw new Error(`Unexpected table lookup: ${options.tableId}`);
        },
        async createTransaction() {
          transactionCalls += 1;
          throw new Error('A blocked profile must not start a transaction.');
        },
      },
      'juchess',
      { $id: 'blocked-account', email: 'blocked@example.com', emailVerification: true },
      {
        displayName: 'Blocked Player',
        university: 'University of Jordan',
        universityId: '0201234',
        phone: '0791234567',
      },
    ),
    (error) => error.statusCode === 403 && /blocked by club administration/i.test(error.message),
  );
  assert.equal(transactionCalls, 0);
});

test('identity-block checks paginate instead of silently stopping at 500 rows', async () => {
  let calls = 0;
  const firstPage = Array.from({ length: 500 }, (_, index) => ({
    $id: `lifted-${index}`,
    type: 'phone',
    value: `old-${index}`,
    status: 'lifted',
  }));
  await assert.rejects(
    assertSubmittedIdentityAllowed(
      {
        async listRows() {
          calls += 1;
          return calls === 1
            ? { rows: firstPage }
            : { rows: [{
                $id: 'active-block',
                type: 'phone',
                value: '+962791234567',
                status: 'active',
              }] };
        },
      },
      'juchess',
      { email: 'student@example.com', phone: '+962791234567' },
    ),
    (error) => error.statusCode === 403 && /blocked by club administration/i.test(error.message),
  );
  assert.equal(calls, 2);
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

test('a phone owned by an active account cannot be reclaimed', async () => {
  const tablesDB = {
    async listRows() {
      return {
        rows: [{
          $id: 'other-profile',
          profileId: 'other-profile',
          accountId: 'active-account',
          phone: '+962791234567',
        }],
      };
    },
  };
  const users = {
    async get() {
      return { $id: 'active-account' };
    },
  };

  await assert.rejects(
    findReclaimablePhoneIdentity(
      tablesDB,
      users,
      'juchess',
      'current-profile',
      '+962791234567',
    ),
    (error) => error.statusCode === 409 && /phone number is already registered/i.test(error.message),
  );
});

test('a deleted account cannot reserve a phone number forever', async () => {
  const orphan = {
    $id: 'orphan-profile',
    profileId: 'orphan-profile',
    accountId: 'deleted-account',
    phone: '+962791234567',
  };
  const tablesDB = {
    async listRows() {
      return { rows: [orphan] };
    },
  };
  const users = {
    async get() {
      throw { code: 404 };
    },
  };

  assert.equal(
    await findReclaimablePhoneIdentity(
      tablesDB,
      users,
      'juchess',
      'current-profile',
      '+962791234567',
    ),
    orphan,
  );
});

test('active accounts keep every unique private identity reservation', async () => {
  for (const [field, value, message] of [
    ['email', 'owner@example.com', /email address is already registered/i],
    ['universityId', '0201234', /University ID is already registered/i],
    ['phone', '+962791234567', /phone number is already registered/i],
  ]) {
    const tablesDB = {
      async listRows() {
        return {
          rows: [{
            $id: `other-${field}`,
            profileId: `other-${field}`,
            accountId: 'active-account',
            [field]: value,
          }],
        };
      },
    };
    const users = { async get() { return { $id: 'active-account' }; } };

    await assert.rejects(
      findReclaimablePrivateIdentities(
        tablesDB,
        users,
        'juchess',
        'current-profile',
        { [field]: value },
      ),
      (error) => error.statusCode === 409 && message.test(error.message),
      field,
    );
  }
});

test('one deleted account releases email, University ID, and phone together', async () => {
  const orphan = {
    $id: 'orphan-profile',
    profileId: 'orphan-profile',
    accountId: 'deleted-account',
    email: 'owner@example.com',
    universityId: '0201234',
    phone: '+962791234567',
  };
  let userLookups = 0;
  const reclaimable = await findReclaimablePrivateIdentities(
    { async listRows() { return { rows: [orphan] }; } },
    {
      async get() {
        userLookups += 1;
        throw { code: 404 };
      },
    },
    'juchess',
    'current-profile',
    {
      email: orphan.email,
      universityId: orphan.universityId,
      phone: orphan.phone,
    },
  );

  assert.equal(userLookups, 1);
  assert.equal(reclaimable.length, 1);
  assert.equal(reclaimable[0].identity, orphan);
  assert.match(reclaimable[0].releaseData.email, /^archived\+[a-f0-9]{24}@invalid\.juchess\.page$/);
  assert.equal(reclaimable[0].releaseData.universityId, null);
  assert.equal(reclaimable[0].releaseData.phone, null);
});

test('orphan detection fails closed when user lookup is unavailable', async () => {
  const outage = Object.assign(new Error('Users API unavailable'), { code: 503 });
  await assert.rejects(
    findReclaimablePrivateIdentities(
      {
        async listRows() {
          return { rows: [{ $id: 'conflict', accountId: 'unknown-account', email: 'owner@example.com' }] };
        },
      },
      { async get() { throw outage; } },
      'juchess',
      'current-profile',
      { email: 'owner@example.com' },
    ),
    (error) => error === outage,
  );
});

test('profile completion releases every orphaned identity reservation in the same transaction', async () => {
  const updates = [];
  const transactionUpdates = [];
  const tablesDB = {
    async listRows(options) {
      if (options.tableId === 'identity_blocks') return { rows: [] };
      const attribute = queryAttribute(options);
      if (attribute === 'accountId') {
        return {
          rows: [{
            $id: 'current-profile',
            profileId: 'current-profile',
            accountId: 'current-account',
            email: 'student@example.com',
            universityId: '0201234',
            phone: null,
          }],
        };
      }
      if (['email', 'universityId', 'phone'].includes(attribute)) {
        return {
          rows: [{
            $id: 'orphan-profile',
            profileId: 'orphan-profile',
            accountId: 'deleted-account',
            email: 'student@example.com',
            universityId: '0201234',
            phone: '+962791234567',
          }],
        };
      }
      return { rows: [] };
    },
    async getRow() {
      return { $id: 'current-profile', displayName: 'Student Knight', status: 'pending' };
    },
    async createTransaction() {
      return { $id: 'transaction-1' };
    },
    async updateRow(options) {
      updates.push(options);
      if (options.tableId === 'profiles') {
        return {
          $id: 'current-profile',
          displayName: 'Student Knight',
          university: 'University of Jordan',
          status: options.data.status,
        };
      }
      return { $id: options.rowId, ...options.data };
    },
    async upsertRow(options) {
      return { $id: options.rowId, ...options.data };
    },
    async updateTransaction(options) {
      transactionUpdates.push(options);
      return {};
    },
  };
  const users = {
    async get() {
      throw { code: 404 };
    },
  };

  const result = await saveOwnerProfile(
    tablesDB,
    'juchess',
    { $id: 'current-account', email: 'student@example.com' },
    {
      displayName: 'Student Knight',
      university: 'University of Jordan',
      universityId: '0201234',
      phone: '0791234567',
    },
    users,
  );

  assert.equal(updates[0].databaseId, 'juchess');
  assert.equal(updates[0].tableId, 'profile_private');
  assert.equal(updates[0].rowId, 'orphan-profile');
  assert.match(updates[0].data.email, /^archived\+[a-f0-9]{24}@invalid\.juchess\.page$/);
  assert.equal(updates[0].data.universityId, null);
  assert.equal(updates[0].data.phone, null);
  assert.equal(updates[0].transactionId, 'transaction-1');
  assert.equal(updates[1].tableId, 'profiles');
  assert.equal(updates[1].data.status, 'active');
  assert.deepEqual(updates[1].permissions, [
    'read("any")',
    'read("user:current-account")',
  ]);
  assert.equal(updates[1].transactionId, 'transaction-1');
  assert.deepEqual(transactionUpdates, [{ transactionId: 'transaction-1', commit: true }]);
  assert.equal(result.phone, '+962791234567');
  assert.equal(result.status, 'active');
});

test('a complete first profile submission creates an active club member', async () => {
  const writes = [];
  const tablesDB = {
    async listRows() {
      return { rows: [] };
    },
    async createTransaction() {
      return { $id: 'transaction-1' };
    },
    async createRow(options) {
      writes.push(options);
      return { $id: options.rowId, ...options.data };
    },
    async upsertRow(options) {
      return { $id: options.rowId, ...options.data };
    },
    async updateTransaction() {
      return {};
    },
  };

  const result = await saveOwnerProfile(
    tablesDB,
    'juchess',
    { $id: 'google-account', email: 'student@example.com', name: 'Google Student' },
    {
      displayName: 'Google Student',
      university: 'University of Jordan',
      universityId: '0201234',
      phone: '0791234567',
      chessComUsername: 'GoogleKnight',
    },
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0].tableId, 'profiles');
  assert.equal(writes[0].data.status, 'active');
  assert.deepEqual(writes[0].permissions, [
    'read("any")',
    'read("user:google-account")',
  ]);
  assert.equal(result.status, 'active');
  assert.equal(result.universityId, '0201234');
});

test('a verified complete legacy profile becomes active and public when it is loaded', async () => {
  const updates = [];
  const tablesDB = {
    async updateRow(options) {
      updates.push(options);
      return { $id: options.rowId, ...options.data, $permissions: options.permissions };
    },
  };

  const row = await activateCompleteOwnerProfile(
    tablesDB,
    'juchess',
    { $id: 'verified-account', emailVerification: true },
    {
      $id: 'legacy-profile',
      displayName: 'Legacy Knight',
      university: 'University of Jordan',
      status: 'pending',
      $permissions: ['read("user:verified-account")'],
    },
    {
      universityId: '0201234',
      phone: '+962791234567',
    },
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.status, 'active');
  assert.deepEqual(updates[0].permissions, [
    'read("any")',
    'read("user:verified-account")',
  ]);
  assert.equal(row.status, 'active');
});

test('an incomplete profile is kept private until its required details are saved', async () => {
  let updates = 0;
  const profile = { $id: 'incomplete-profile', displayName: 'New Knight', status: 'active' };
  const row = await activateCompleteOwnerProfile(
    { async updateRow() { updates += 1; } },
    'juchess',
    { $id: 'verified-account', emailVerification: true },
    profile,
    { universityId: null, phone: null },
  );

  assert.equal(row, profile);
  assert.equal(updates, 0);
});

test('profile updates reject every server-owned identity and moderation field', () => {
  for (const field of ['accountId', 'email', 'rating', 'ratingSource', 'ratingUpdatedAt', 'role', 'status', 'profileId', '$id']) {
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
