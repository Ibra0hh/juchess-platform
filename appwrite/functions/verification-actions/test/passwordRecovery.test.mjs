import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PASSWORD_RECOVERY_HOURLY_LIMIT,
  PASSWORD_RECOVERY_MAX_ATTEMPTS,
  PASSWORD_RECOVERY_RESEND_COOLDOWN_MS,
  PASSWORD_RECOVERY_TTL_MS,
  buildPasswordRecoveryEmailHtml,
  confirmPasswordRecoveryCode,
  confirmPasswordRecoveryLink,
  generateRecoveryCode,
  hashRecoveryIdentity,
  hashRecoveryValue,
  isRecoveryChallengeExpired,
  normalizeRecoveryCode,
  recoveryHashMatches,
  requestPasswordRecovery,
} from '../src/passwordRecovery.js';

const secret = 'recovery-test-secret-that-is-longer-than-thirty-two-characters';

test('password recovery uses one-hour, five-attempt, rate-limited proofs', () => {
  assert.equal(PASSWORD_RECOVERY_TTL_MS, 3_600_000);
  assert.equal(PASSWORD_RECOVERY_MAX_ATTEMPTS, 5);
  assert.equal(PASSWORD_RECOVERY_RESEND_COOLDOWN_MS, 60_000);
  assert.equal(PASSWORD_RECOVERY_HOURLY_LIMIT, 10);
  const challenge = { expiresAt: '2026-07-18T12:00:00.000Z' };
  assert.equal(isRecoveryChallengeExpired(challenge, Date.parse('2026-07-18T11:59:59.999Z')), false);
  assert.equal(isRecoveryChallengeExpired(challenge, Date.parse('2026-07-18T12:00:00.000Z')), true);
});

test('recovery codes are six digits and secrets use domain-separated keyed hashes', () => {
  for (let index = 0; index < 50; index += 1) assert.match(generateRecoveryCode(), /^\d{6}$/);
  assert.equal(normalizeRecoveryCode(' 12-34 56 '), '123456');
  const codeHash = hashRecoveryValue('code', 'challenge-1', '123456', secret);
  const linkHash = hashRecoveryValue('link', 'challenge-1', 'token', secret);
  const emailHash = hashRecoveryIdentity('email', 'player@example.com', secret);
  assert.match(codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(codeHash, linkHash);
  assert.notEqual(codeHash, emailHash);
  assert.equal(recoveryHashMatches(codeHash, hashRecoveryValue('code', 'challenge-1', '123456', secret)), true);
  assert.equal(recoveryHashMatches(codeHash, hashRecoveryValue('code', 'challenge-1', '654321', secret)), false);
});

test('the branded recovery email contains a link and code without unsafe player markup', () => {
  const html = buildPasswordRecoveryEmailHtml({
    displayName: '<script>alert(1)</script>',
    code: '123456',
    recoveryUrl: 'https://juchess.page/forgot-password?challenge=one&token=two',
  });
  assert.match(html, />123456</);
  assert.match(html, /Reset JuChess password/);
  assert.match(html, /Expires in one hour/);
  assert.match(html, /@media only screen and \(max-width:480px\)/);
  assert.doesNotMatch(html, /<script>alert/);
});

function challengeFixture(overrides = {}) {
  return {
    $id: 'challenge-1',
    userId: 'user-1',
    emailHash: hashRecoveryIdentity('email', 'player@example.com', secret),
    ipHash: hashRecoveryIdentity('ip', '127.0.0.1', secret),
    codeHash: hashRecoveryValue('code', 'challenge-1', '123456', secret),
    linkHash: hashRecoveryValue('link', 'challenge-1', 'valid-link-token-that-is-long-enough', secret),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    attempts: 0,
    consumedAt: null,
    emailMessageId: 'recover_challenge-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function resetHarness(challenge = challengeFixture()) {
  const calls = [];
  const tablesDB = {
    async getRow() { return challenge; },
    async listRows(options) {
      if (options.queries.some((query) => query.includes('userId'))) return { rows: [] };
      return { rows: [challenge] };
    },
    async incrementRowColumn() {
      challenge.attempts += 1;
      return { ...challenge };
    },
    async updateRow(options) { calls.push(['update-row', options.rowId]); return challenge; },
    async deleteRow(options) { calls.push(['delete-row', options.rowId]); },
    async createRow(options) { calls.push(['restore-row', options.rowId]); return options.data; },
  };
  const user = {
    $id: 'user-1',
    email: 'player@example.com',
    password: 'argon-hash',
    status: true,
  };
  const users = {
    async get() { return user; },
    async deleteSessions() { calls.push(['delete-sessions', user.$id]); },
    async updatePassword(options) { calls.push(['update-password', options.userId]); return user; },
  };
  return { tablesDB, users, calls };
}

test('a valid recovery link atomically claims the proof, revokes sessions, and changes the password', async () => {
  const challenge = challengeFixture();
  const harness = resetHarness(challenge);
  const result = await confirmPasswordRecoveryLink({
    ...harness,
    databaseId: 'juchess',
    body: {
      challengeId: challenge.$id,
      token: 'valid-link-token-that-is-long-enough',
      password: 'Securepass1',
    },
    secret,
  });
  assert.deepEqual(result, { reset: true });
  assert.deepEqual(harness.calls.slice(0, 3), [
    ['delete-row', 'challenge-1'],
    ['delete-sessions', 'user-1'],
    ['update-password', 'user-1'],
  ]);
});

test('a code attempt is incremented atomically before its proof is accepted', async () => {
  const challenge = challengeFixture();
  const harness = resetHarness(challenge);
  const result = await confirmPasswordRecoveryCode({
    ...harness,
    databaseId: 'juchess',
    body: { email: 'player@example.com', code: '123456', password: 'Securepass1' },
    secret,
  });
  assert.deepEqual(result, { reset: true });
  assert.equal(challenge.attempts, 1);
});

test('the fifth incorrect code consumes the challenge', async () => {
  const challenge = challengeFixture({ attempts: 4 });
  const harness = resetHarness(challenge);
  await assert.rejects(
    confirmPasswordRecoveryCode({
      ...harness,
      databaseId: 'juchess',
      body: { email: 'player@example.com', code: '999999', password: 'Securepass1' },
      secret,
    }),
    /Too many incorrect attempts/i,
  );
  assert.equal(challenge.attempts, 5);
  assert.equal(harness.calls.some(([action]) => action === 'update-row'), true);
});

test('a changed account email invalidates an otherwise correct recovery proof', async () => {
  const challenge = challengeFixture();
  const harness = resetHarness(challenge);
  harness.users.get = async () => ({
    $id: 'user-1',
    email: 'changed@example.com',
    password: 'argon-hash',
    status: true,
  });
  await assert.rejects(
    confirmPasswordRecoveryLink({
      ...harness,
      databaseId: 'juchess',
      body: {
        challengeId: challenge.$id,
        token: 'valid-link-token-that-is-long-enough',
        password: 'Securepass1',
      },
      secret,
    }),
    /invalid or expired/i,
  );
  assert.equal(harness.calls.some(([action]) => action === 'update-password'), false);
});

test('an Appwrite password-policy rejection restores the claimed proof', async () => {
  const challenge = challengeFixture();
  const harness = resetHarness(challenge);
  harness.users.updatePassword = async () => {
    const error = new Error('Password is in the dictionary');
    error.code = 400;
    throw error;
  };
  await assert.rejects(
    confirmPasswordRecoveryLink({
      ...harness,
      databaseId: 'juchess',
      body: {
        challengeId: challenge.$id,
        token: 'valid-link-token-that-is-long-enough',
        password: 'Securepass1',
      },
      secret,
    }),
    /different password/i,
  );
  assert.equal(harness.calls.some(([action]) => action === 'restore-row'), true);
});

test('an unknown email returns the same accepted response without creating or sending', async () => {
  let creates = 0;
  let sends = 0;
  const result = await requestPasswordRecovery({
    tablesDB: {
      async listRows() { return { rows: [] }; },
      async createRow() { creates += 1; },
    },
    users: { async list() { return { users: [] }; } },
    messaging: { async createEmail() { sends += 1; } },
    databaseId: 'juchess',
    body: { email: 'missing@example.com' },
    secret,
    publicWebUrl: 'https://juchess.page',
    clientIp: '127.0.0.1',
  });
  assert.deepEqual(result, { accepted: true });
  assert.equal(creates, 0);
  assert.equal(sends, 0);
});

test('a messaging failure deletes the new row and preserves every previous active proof', async () => {
  const previous = challengeFixture({
    $id: 'previous-challenge',
    createdAt: new Date(Date.now() - 120_000).toISOString(),
  });
  const calls = [];
  await assert.rejects(
    requestPasswordRecovery({
      tablesDB: {
        async listRows(options) {
          return { rows: options.queries.some((query) => query.includes('emailHash')) ? [previous] : [] };
        },
        async createRow(options) { calls.push(['create', options.rowId]); },
        async deleteRow(options) { calls.push(['delete', options.rowId]); },
        async updateRow(options) { calls.push(['update', options.rowId]); },
      },
      users: {
        async list() {
          return {
            users: [{
              $id: 'user-1',
              name: 'Player',
              email: 'player@example.com',
              password: 'argon-hash',
              status: true,
              targets: [{ $id: 'target-1', providerType: 'email', identifier: 'player@example.com', expired: false }],
            }],
          };
        },
      },
      messaging: { async createEmail() { throw new Error('SMTP unavailable'); } },
      databaseId: 'juchess',
      body: { email: 'player@example.com' },
      secret,
      publicWebUrl: 'https://juchess.page',
      clientIp: '127.0.0.1',
    }),
    /SMTP unavailable/,
  );
  assert.equal(calls.some(([action, rowId]) => action === 'delete' && rowId !== previous.$id), true);
  assert.equal(calls.some(([action, rowId]) => action === 'update' && rowId === previous.$id), false);
});
