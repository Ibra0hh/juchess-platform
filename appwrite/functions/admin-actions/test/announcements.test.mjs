import assert from 'node:assert/strict';
import test from 'node:test';

import {
  announcementCapabilitiesFromProviders,
  normalizeAnnouncementInput,
  resolveAnnouncementProfileIds,
} from '../src/main.js';

test('announcement input normalizes content and enforces real audience/channel rules', () => {
  assert.deepEqual(normalizeAnnouncementInput({
    title: '  Round   two  ',
    message: ' Pairings are ready.\r\nPlease check your board. ',
    audience: 'allUsers',
    channels: ['app', 'email', 'email'],
  }), {
    title: 'Round two',
    message: 'Pairings are ready.\nPlease check your board.',
    audience: 'allUsers',
    tournamentId: '',
    emails: [],
    channels: ['app', 'email'],
    link: null,
  });

  assert.throws(() => normalizeAnnouncementInput({ title: '', message: 'Body', channels: ['app'] }), /title/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: '', channels: ['app'] }), /message/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', channels: [] }), /at least one/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', channels: ['fax'] }), /supported/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'tournamentParticipants', channels: ['email'] }), /choose an upcoming or active tournament/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'tournamentParticipants', tournamentId: 't1', channels: ['app'] }), /targeted website/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'specificEmails', channels: ['email'] }), /at least one registered/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'specificEmails', emails: ['not-an-email'], channels: ['email'] }), /complete email/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'specificEmails', emails: ['player@example.com'], channels: ['app'] }), /targeted website/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', channels: ['app'], link: { text: 'Open', url: 'https://juchess.page' } }), /requires the Email channel/i);

  assert.deepEqual(normalizeAnnouncementInput({
    title: 'Direct update',
    message: 'Please review it.',
    audience: 'specificEmails',
    emails: [' Player@Example.com ', 'player@example.com'],
    channels: ['email'],
    link: { text: ' Open details ', url: 'https://juchess.page/tournaments' },
  }), {
    title: 'Direct update',
    message: 'Please review it.',
    audience: 'specificEmails',
    tournamentId: '',
    emails: ['player@example.com'],
    channels: ['email'],
    link: { text: 'Open details', url: 'https://juchess.page/tournaments' },
  });
});

test('announcement capabilities never claim SMS from a provider alone', () => {
  const capabilities = announcementCapabilitiesFromProviders([
    { enabled: true, type: 'email', name: 'JuChess Resend' },
    { enabled: true, type: 'sms', name: 'Example SMS' },
  ]);

  assert.equal(capabilities.app.ready, true);
  assert.equal(capabilities.email.ready, true);
  assert.equal(capabilities.email.provider, 'JuChess Resend');
  assert.equal(capabilities.sms.ready, false);
  assert.match(capabilities.sms.reason, /verified Appwrite phone targets/i);
});

test('announcement audiences resolve active members or confirmed tournament participants', async () => {
  const calls = [];
  const tablesDB = {
    async getRow({ rowId }) {
      assert.equal(rowId, 'tournament-1');
      return { $id: rowId, status: 'upcoming' };
    },
    async listRows(input) {
      calls.push(input);
      if (input.tableId === 'profiles') {
        return { rows: [
          { $id: 'profile-1', status: 'active' },
          { $id: 'profile-2', status: 'active' },
        ] };
      }
      if (input.tableId === 'profile_private') {
        return { rows: [
          { $id: 'profile-1', accountId: 'account-1', email: 'first@example.com' },
          { $id: 'profile-2', accountId: 'account-2', email: 'second@example.com' },
        ] };
      }
      if (input.tableId === 'registrations') {
        return { rows: [
          { $id: 'r1', profileId: 'profile-1', status: 'confirmed' },
          { $id: 'r2', profileId: 'profile-2', status: 'pending' },
          { $id: 'r3', profileId: 'profile-1', status: 'confirmed' },
        ] };
      }
      return { rows: [] };
    },
  };

  assert.deepEqual(
    await resolveAnnouncementProfileIds(tablesDB, 'juchess', { audience: 'allUsers' }),
    ['profile-1', 'profile-2'],
  );
  assert.deepEqual(
    await resolveAnnouncementProfileIds(tablesDB, 'juchess', { audience: 'tournamentParticipants', tournamentId: 'tournament-1' }),
    ['profile-1'],
  );
  assert.deepEqual(
    await resolveAnnouncementProfileIds(tablesDB, 'juchess', { audience: 'specificEmails', emails: ['second@example.com'] }),
    ['profile-2'],
  );
  assert.equal(calls.length, 4);
});

test('specific announcement emails fail closed when any address is not an active player account', async () => {
  const tablesDB = {
    async listRows({ tableId }) {
      if (tableId === 'profiles') return { rows: [{ $id: 'profile-1', status: 'active' }] };
      if (tableId === 'profile_private') {
        return { rows: [{ $id: 'profile-1', accountId: 'account-1', email: 'first@example.com' }] };
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    () => resolveAnnouncementProfileIds(tablesDB, 'juchess', {
      audience: 'specificEmails',
      emails: ['first@example.com', 'missing@example.com'],
    }),
    (error) => error.statusCode === 409 && /1 email address is not connected/i.test(error.message),
  );
});

test('participant announcements reject tournaments outside the live registration lifecycle', async () => {
  const tablesDB = {
    async getRow() {
      return { $id: 'tournament-1', status: 'completed' };
    },
  };

  await assert.rejects(
    () => resolveAnnouncementProfileIds(tablesDB, 'juchess', { audience: 'tournamentParticipants', tournamentId: 'tournament-1' }),
    (error) => error.statusCode === 409 && /upcoming or active/i.test(error.message),
  );
});
