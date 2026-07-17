import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CODE_ATTEMPTS,
  VERIFICATION_TTL_MS,
  buildVerificationEmailHtml,
  challengeMatchesCurrentEmail,
  confirmCode,
  confirmLink,
  createVerificationChallenge,
  generateVerificationCode,
  hashVerificationEmail,
  hashVerificationValue,
  isVerificationChallengeExpired,
  normalizeVerificationCode,
  secureHashMatches,
} from '../src/main.js';

const secret = 'test-only-secret-that-is-longer-than-thirty-two-characters';

test('verification challenges expire after exactly two hours', () => {
  assert.equal(VERIFICATION_TTL_MS, 7_200_000);
  const challenge = { expiresAt: '2026-07-17T14:00:00.000Z' };
  assert.equal(isVerificationChallengeExpired(challenge, Date.parse('2026-07-17T13:59:59.999Z')), false);
  assert.equal(isVerificationChallengeExpired(challenge, Date.parse('2026-07-17T14:00:00.000Z')), true);
});

test('verification codes are always six digits and allow only five attempts', () => {
  for (let index = 0; index < 50; index += 1) assert.match(generateVerificationCode(), /^\d{6}$/);
  assert.equal(normalizeVerificationCode(' 12-34 56 '), '123456');
  assert.equal(normalizeVerificationCode('1234567'), '1234567');
  assert.equal(MAX_CODE_ATTEMPTS, 5);
});

test('verification secrets and email addresses are stored only as keyed hashes', () => {
  const codeHash = hashVerificationValue('code', 'challenge-1', '123456', secret);
  const linkHash = hashVerificationValue('link', 'challenge-1', 'link-token', secret);
  assert.match(codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(codeHash, linkHash);
  assert.equal(secureHashMatches(codeHash, hashVerificationValue('code', 'challenge-1', '123456', secret)), true);
  assert.equal(secureHashMatches(codeHash, hashVerificationValue('code', 'challenge-1', '654321', secret)), false);
  assert.equal(hashVerificationEmail(' Player@Example.com ', secret), hashVerificationEmail('player@example.com', secret));
  assert.equal(challengeMatchesCurrentEmail(
    { emailHash: hashVerificationEmail('player@example.com', secret) },
    { email: 'PLAYER@example.com' },
    secret,
  ), true);
  assert.equal(challengeMatchesCurrentEmail(
    { emailHash: hashVerificationEmail('old@example.com', secret) },
    { email: 'new@example.com' },
    secret,
  ), false);
});

function challengeFixture() {
  return {
    $id: 'challenge-1',
    userId: 'user-1',
    emailHash: hashVerificationEmail('old@example.com', secret),
    codeHash: hashVerificationValue('code', 'challenge-1', '123456', secret),
    linkHash: hashVerificationValue('link', 'challenge-1', 'valid-link-token-that-is-long-enough', secret),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function changedEmailHarness(challenge) {
  let verificationUpdates = 0;
  const tablesDB = {
    async getRow() { return challenge; },
    async listRows() { return { rows: [challenge] }; },
    async updateRow() { return challenge; },
  };
  const users = {
    async get() { return { $id: 'user-1', email: 'new@example.com', emailVerification: false }; },
    async updateEmailVerification() { verificationUpdates += 1; },
  };
  return { tablesDB, users, verificationUpdates: () => verificationUpdates };
}

test('a link sent to an old address cannot verify a subsequently changed email', async () => {
  const challenge = challengeFixture();
  const harness = changedEmailHarness(challenge);
  await assert.rejects(
    confirmLink({
      ...harness,
      databaseId: 'juchess',
      body: { challengeId: challenge.$id, token: 'valid-link-token-that-is-long-enough' },
      secret,
    }),
    /invalid or expired/i,
  );
  assert.equal(harness.verificationUpdates(), 0);
});

test('a code sent to an old address cannot verify a subsequently changed email', async () => {
  const challenge = challengeFixture();
  const harness = changedEmailHarness(challenge);
  await assert.rejects(
    confirmCode({
      ...harness,
      databaseId: 'juchess',
      body: { email: 'old@example.com', code: '123456' },
      secret,
    }),
    /invalid or expired/i,
  );
  assert.equal(harness.verificationUpdates(), 0);
});

test('a consumed challenge proves its secret before returning already verified', async () => {
  const challenge = { ...challengeFixture(), consumedAt: new Date().toISOString() };
  let userReads = 0;
  await assert.rejects(
    confirmLink({
      tablesDB: { async getRow() { return challenge; } },
      users: { async get() { userReads += 1; return { email: 'old@example.com', emailVerification: true }; } },
      databaseId: 'juchess',
      body: { challengeId: challenge.$id, token: 'wrong-link-token-that-is-long-enough' },
      secret,
    }),
    /invalid or expired/i,
  );
  assert.equal(userReads, 0);
});

test('a messaging failure preserves the previous active verification proof', async () => {
  const previous = {
    ...challengeFixture(),
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  };
  const writes = [];
  const tablesDB = {
    async listRows() { return { rows: [previous] }; },
    async createRow(options) { writes.push(['create', options.rowId]); return options.data; },
    async deleteRow(options) { writes.push(['delete', options.rowId]); },
    async updateRow(options) { writes.push(['update', options.rowId]); },
  };
  await assert.rejects(
    createVerificationChallenge({
      tablesDB,
      messaging: { async createEmail() { throw new Error('SMTP unavailable'); } },
      databaseId: 'juchess',
      user: { $id: 'user-1', email: 'old@example.com', name: 'Player', emailVerification: false },
      secret,
      publicWebUrl: 'https://juchess.page',
    }),
    /SMTP unavailable/,
  );
  assert.equal(writes.some(([action, rowId]) => action === 'update' && rowId === previous.$id), false);
  assert.equal(writes.some(([action]) => action === 'delete'), true);
});

test('the branded email contains both verification methods and no unsafe user markup', () => {
  const html = buildVerificationEmailHtml({
    displayName: '<script>alert(1)</script>',
    code: '123456',
    verificationUrl: 'https://juchess.page/verify-email?challenge=one&token=two',
  });
  assert.match(html, />123456</);
  assert.match(html, /Verify email address/);
  assert.match(html, /Expires in two hours/);
  assert.match(html, /@media only screen and \(max-width:480px\)/);
  assert.doesNotMatch(html, /<script>alert/);
});
