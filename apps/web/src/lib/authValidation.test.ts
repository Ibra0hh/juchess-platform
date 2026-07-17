import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_PASSWORD_MAX_LENGTH,
  normalizeAuthEmail,
  validateAccountEmail,
  validateAccountName,
  validateNewPassword,
  validateSignInPassword,
} from './authValidation.ts'

test('auth inputs normalize email without changing passwords', () => {
  assert.equal(normalizeAuthEmail(' Player@Example.COM '), 'player@example.com')
  assert.equal(validateAccountEmail('player@example.com'), null)
  assert.match(validateAccountEmail('not-an-email') ?? '', /valid email/i)
  assert.match(validateAccountEmail(`${'x'.repeat(245)}@example.com`) ?? '', /valid email/i)
})

test('account names enforce Appwrite limits before making a request', () => {
  assert.equal(validateAccountName('  Student Knight  '), null)
  assert.match(validateAccountName('   ') ?? '', /full name/i)
  assert.match(validateAccountName('Student\u0000Knight') ?? '', /unsupported/i)
  assert.match(validateAccountName('x'.repeat(ACCOUNT_NAME_MAX_LENGTH + 1)) ?? '', /128/)
})

test('new passwords use one shared JuChess policy and Appwrite maximum', () => {
  assert.equal(validateNewPassword('Knight2026'), null)
  assert.match(validateNewPassword('short') ?? '', /uppercase/i)
  assert.match(validateNewPassword('x'.repeat(ACCOUNT_PASSWORD_MAX_LENGTH + 1) + 'A1') ?? '', /256/)
})

test('sign-in passwords require a value without imposing new-account strength rules', () => {
  assert.match(validateSignInPassword('') ?? '', /enter your password/i)
  assert.equal(validateSignInPassword('legacy-password'), null)
  assert.match(validateSignInPassword('a'.repeat(ACCOUNT_PASSWORD_MAX_LENGTH + 1)) ?? '', /256/)
})
