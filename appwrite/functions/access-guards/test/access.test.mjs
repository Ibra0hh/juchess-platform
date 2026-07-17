import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeCandidates,
  getRequestIp,
  normalizeCandidates,
  normalizePhone,
  storedIdentityLookup,
} from '../src/main.js';

test('guard candidates normalize all protected identity types', () => {
  assert.deepEqual(normalizeCandidates({
    email: ' Student@JU.EDU.JO ',
    universityId: ' 020ABC ',
    phone: '079 123 4567',
  }), [
    { type: 'email', value: 'student@ju.edu.jo' },
    { type: 'universityId', value: '020abc' },
    { type: 'phone', value: '+962791234567' },
  ]);
  assert.equal(normalizePhone('00962 79 123 4567'), '+962791234567');
});

test('authenticated stored candidates merge with and override duplicate submissions', () => {
  const submitted = normalizeCandidates({ email: 'other@example.com', phone: '0791234567' });
  const stored = normalizeCandidates({ email: 'owner@example.com', phone: '+962 79 123 4567' });

  assert.deepEqual(mergeCandidates(submitted, stored), [
    { type: 'email', value: 'other@example.com' },
    { type: 'phone', value: '+962791234567' },
    { type: 'email', value: 'owner@example.com' },
  ]);
});

test('pre-session checks resolve canonical private identity by normalized email', () => {
  assert.deepEqual(storedIdentityLookup('', ' Player@Example.com '), {
    field: 'email',
    value: 'player@example.com',
  });
  assert.deepEqual(storedIdentityLookup('account-1', 'other@example.com'), {
    field: 'accountId',
    value: 'account-1',
  });
  assert.equal(storedIdentityLookup('', ''), null);
});

test('IP checks trust Appwrite client IP ahead of forwarded fallbacks', () => {
  assert.equal(getRequestIp({
    headers: {
      'x-appwrite-client-ip': '203.0.113.20',
      'x-forwarded-for': '198.51.100.1, 198.51.100.2',
    },
  }), '203.0.113.20');
  assert.equal(getRequestIp({
    headers: { 'x-forwarded-for': '198.51.100.1, 198.51.100.2' },
  }), '198.51.100.1');
});
