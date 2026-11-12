import assert from 'node:assert/strict';
import test from 'node:test';
import { recordPlayerWebsiteVisit } from '../src/main.js';

test('signed-in website visits create only one entry per UTC day and prune older dates', async () => {
  let row;
  let writes = 0;
  const db = {
    async getRow(options) {
      assert.equal(options.rowId, 'profile');
      assert.equal(options.tableId, 'player_website_activity');
      if (!row) throw Object.assign(new Error('missing'), { type: 'row_not_found' });
      return row;
    },
    async createRow({ data, permissions }) {
      assert.deepEqual(permissions, []);
      row = data;
      writes++;
    },
    async updateRow({ data }) { row = data; writes++; },
  };
  const visit = (time) => recordPlayerWebsiteVisit(db, 'juchess', 'profile', new Date(time));
  await visit('2026-10-10T00:00:01Z');
  await visit('2026-10-10T23:00:01Z');
  assert.equal(writes, 1);
  await visit('2026-11-10T01:00:01Z');
  await visit('2026-11-11T01:00:01Z');
  assert.deepEqual(row, { visitDates: ['2026-11-10', '2026-11-11'], lastVisitedAt: '2026-11-11T01:00:01.000Z' });
  assert.equal(writes, 3);
});
