import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertAdminPanelSession,
  claimAdminPanelSession,
  readAdminPanelSessionToken,
} from '../src/main.js';

test('admin panel session claims replace only the panel lease and preserve account preferences', async () => {
  let saved = null;
  const users = {
    async getPrefs() {
      return { locale: 'en', boardTheme: 'juchess' };
    },
    async updatePrefs(input) {
      saved = input;
      return input.prefs;
    },
  };

  await claimAdminPanelSession(users, 'account-1', 'panel-new');

  assert.equal(saved.userId, 'account-1');
  assert.equal(saved.prefs.locale, 'en');
  assert.equal(saved.prefs.boardTheme, 'juchess');
  assert.equal(saved.prefs.juchessAdminPanelSession.token, 'panel-new');
  assert.ok(Date.parse(saved.prefs.juchessAdminPanelSession.claimedAt));
});

test('only the most recently claimed admin panel lease is accepted', async () => {
  const users = {
    async getPrefs() {
      return {
        juchessAdminPanelSession: {
          token: 'panel-current',
          claimedAt: new Date().toISOString(),
        },
      };
    },
  };

  await assert.doesNotReject(() => assertAdminPanelSession(users, 'account-1', 'panel-current'));
  await assert.rejects(
    () => assertAdminPanelSession(users, 'account-1', 'panel-old'),
    (error) => error.statusCode === 409 && /another device or browser/.test(error.message),
  );
  await assert.rejects(
    () => assertAdminPanelSession(users, 'account-1', ''),
    (error) => error.statusCode === 409 && /another device or browser/.test(error.message),
  );
});

test('a legacy admin client is accepted only before the first panel lease is claimed', async () => {
  const users = {
    async getPrefs() {
      return { locale: 'en' };
    },
  };

  await assert.doesNotReject(() => assertAdminPanelSession(users, 'account-1', ''));
});

test('admin panel session tokens are read from the dedicated request header', () => {
  assert.equal(readAdminPanelSessionToken({
    headers: { 'juchess-admin-panel-session': '  panel-123  ' },
  }), 'panel-123');
});
