import assert from 'node:assert/strict';
import test from 'node:test';
import { deletePlayerAccounts, retainedTournamentHistory, summarizePlayedTournaments, tournamentPlayerPlaceholder } from '../src/main.js';

test('tournament count uses distinct tournament IDs and skips unfinished games and byes', () => {
  const games = [
    { tournamentId: 't1', whiteProfileId: 'p1', blackProfileId: 'p2', result: '1-0' },
    { tournamentId: 't1', whiteProfileId: 'p2', blackProfileId: 'p1', result: '1/2-1/2' },
    { tournamentId: 't2', whiteProfileId: 'p3', blackProfileId: 'p1', result: '0-1' },
    { tournamentId: 't3', whiteProfileId: 'p1', blackProfileId: 'system_bye', result: '1-0' },
    { tournamentId: 't4', whiteProfileId: 'p1', blackProfileId: 'p4', result: '*' },
  ];
  assert.deepEqual([...summarizePlayedTournaments(games)], [['p1', 2], ['p2', 1], ['p3', 1]]);
});

test('the deleted-player placeholder keeps game and standings references without the old identity', () => {
  const games = [{ tournamentId: 'played', whiteProfileId: 'p1', blackProfileId: 'p2' }];
  const standings = [{ tournamentId: 'standing-only', profileId: 'p1' }, { tournamentId: 'played', profileId: 'p2' }];
  const history = retainedTournamentHistory(['p1', 'p3'], games, standings);
  assert.deepEqual([...history.get('p1')], ['played', 'standing-only']);
  assert.equal(history.get('p3').size, 0);
  assert.equal(history.has('p2'), false);
  const row = tournamentPlayerPlaceholder(new Date('2026-11-12T12:00:00.000Z'));
  assert.equal(row.displayName, 'Deleted player');
  assert.equal(row.status, 'suspended');
  assert.equal(row.chessComUsername, null);
  assert.equal(row.avatarFileId, null);
  assert.equal(row.deletedAt, '2026-11-12T12:00:00.000Z');
});

test('deleting a player with completed games removes the account but does not modify games or standings', async () => {
  const writes = [];
  const users = { async delete({ userId }) { writes.push(['auth', userId]); } };
  const tablesDB = {
    async deleteRow({ tableId, rowId }) { writes.push([tableId, rowId]); },
    async updateRow({ tableId, rowId, data, permissions }) {
      assert.equal(data.displayName, 'Deleted player');
      assert.deepEqual(permissions, ['read("any")']);
      writes.push([tableId, rowId]);
    },
  };
  const inputs = {
    profileIds: ['p1'],
    profiles: [{ $id: 'p1', displayName: 'Original name', $permissions: ['read("any")', 'read("user:u1")'] }],
    privateProfiles: [{ $id: 'p1', accountId: 'u1' }],
    games: [{ $id: 'g1', tournamentId: 'finished', whiteProfileId: 'p1', blackProfileId: 'p2', status: 'completed' }],
    standings: [{ $id: 's1', tournamentId: 'finished', profileId: 'p1' }],
    registrations: [
      { $id: 'r1', tournamentId: 'finished', profileId: 'p1' },
      { $id: 'r2', tournamentId: 'upcoming', profileId: 'p1' },
      { $id: 'r3', tournamentId: 'upcoming', profileId: 'p2' },
    ],
    checkIns: [],
    attendance: [{ $id: 'a1', profileId: 'p1' }],
    adminProfiles: [],
  };
  assert.deepEqual(await deletePlayerAccounts(tablesDB, 'juchess', users, inputs), { registrations: 1, checkIns: 0, attendance: 1 });
  assert.deepEqual(writes, [
    ['auth', 'u1'], ['registrations', 'r2'], ['attendance_confirmations', 'a1'],
    ['profile_private', 'p1'], ['player_website_activity', 'p1'], ['profiles', 'p1'],
  ]);
  writes.length = 0;
  await assert.rejects(deletePlayerAccounts(tablesDB, 'juchess', users, {
    ...inputs, adminProfiles: [{ accountId: 'u1' }],
  }), /has admin access/);
  assert.deepEqual(writes, []);
});
