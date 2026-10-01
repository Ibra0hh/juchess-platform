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
    channels: ['app', 'email'],
  });

  assert.throws(() => normalizeAnnouncementInput({ title: '', message: 'Body', channels: ['app'] }), /title/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: '', channels: ['app'] }), /message/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', channels: [] }), /at least one/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', channels: ['fax'] }), /supported/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'tournamentParticipants', channels: ['email'] }), /choose an upcoming or active tournament/i);
  assert.throws(() => normalizeAnnouncementInput({ title: 'Title', message: 'Body', audience: 'tournamentParticipants', tournamentId: 't1', channels: ['app'] }), /targeted website/i);
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
        return { rows: [{ $id: 'profile-1' }, { $id: 'profile-2' }] };
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
  assert.equal(calls.length, 2);
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
