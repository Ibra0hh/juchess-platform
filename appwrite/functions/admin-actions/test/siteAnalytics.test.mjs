import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSiteAnalytics } from '../src/siteAnalytics.js';
import { adminAreaForRoute, requireAdminArea } from '../src/main.js';

test('analytics reports require an admin role', () => {
  const area = adminAreaForRoute(['analytics']);
  assert.equal(area, 'analytics');
  assert.doesNotThrow(() => requireAdminArea({ role: 'admin' }, area));
  assert.doesNotThrow(() => requireAdminArea({ role: 'superAdmin' }, area));
  assert.throws(() => requireAdminArea({ role: 'organizer' }, area), (error) => error.statusCode === 403);
});

test('report counts anonymous tab starts and views, separates layouts, and counts keyboard clicks without heat zones', async () => {
  const report = await loadSiteAnalytics({
    async listRows({ tableId, queries }) {
      assert.equal(tableId, 'site_analytics_batches');
      assert.deepEqual(JSON.parse(queries[0]).values, ['2026-11-06T12:00:00.000Z']);
      return { rows: [{ events: JSON.stringify([
        ['v', 'home', 'wide', 1],
        ['v', 'tournaments', 'wide', 0],
        ['c', 'home', 'wide', 'nav-tools', 1, 2],
        ['c', 'home', 'narrow', 'nav-tools', 1, 2],
        ['c', 'home', 'wide', 'nav-tools', null, null],
        ['c', 'home', 'wide', null, 1, 2],
      ]) }] };
    },
  }, 'juchess', 7, new Date('2026-11-13T12:00:00Z'));
  assert.deepEqual([report.visits, report.views, report.clicks], [1, 2, 4]);
  assert.deepEqual(report.pages[0].controls, [['nav-tools', 3]]);
  assert.deepEqual(report.pages[0].heat, { wide: [[25, 2]], narrow: [[25, 1]] });
});
