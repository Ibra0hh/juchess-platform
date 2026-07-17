import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CODE_ATTEMPTS,
  VERIFICATION_TTL_MS,
  buildVerificationEmailHtml,
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
