import assert from 'node:assert/strict';
import test from 'node:test';
import { createHandler, validateBatch } from '../src/main.js';

test('accepts anonymous page and bounded click records only', () => {
  const batch = [
    ['v', 'home', 'wide', 1],
    ['c', 'home', 'wide', 'home-vision', 11, 15],
    ['c', 'tournaments', 'narrow', null, 0, 0],
    ['c', 'home', 'wide', 'nav-tools', null, null],
  ];
  assert.deepEqual(validateBatch(batch), batch);
  for (const entry of [
    ['v', 'profile', 'wide', 1],
    ['v', 'tournament/secret-id', 'wide', 0],
    ['v', 'home', 'wide', 1, 'member@example.com'],
    ['c', 'home', 'wide', 'someone@example.com', 0, 0],
    ['c', 'home', 'wide', 'nav-tools', 12, 16],
    ['c', 'home', 'wide', null, null, null],
    ['c', 'home', 'wide', 'nav-tools', 1, 1, 'extraneous'],
  ]) assert.throws(() => validateBatch([entry]), /Invalid/);
  assert.throws(() => validateBatch(Array(33).fill(batch[0])), /Invalid/);
});

test('public function writes only validated batch data to the private table and exposes no report', async () => {
  const writes = [];
  const run = createHandler({}, () => ({
    async createRow(row) { writes.push(row); },
    async deleteRows() { assert.fail('not callable by public path'); },
  }));
  const execute = (method, path, input) => run({
    req: { method, path, bodyText: JSON.stringify(input), headers: { 'x-appwrite-user-id': 'ignored' } },
    res: { json: (body, status) => ({ body, status }) },
  });
  assert.equal((await execute('GET', '/analytics')).status, 404);
  assert.equal((await execute('POST', '/purge', [])).status, 404);
  assert.equal((await execute('POST', '/collect', [['v', 'home', 'wide', 1, 'not allowed']])).status, 400);
  assert.deepEqual(writes, []);
  const batch = [['v', 'home', 'wide', 1], ['c', 'home', 'wide', 'nav-tools', 3, 6]];
  assert.equal((await execute('POST', '/collect', batch)).status, 200);
  assert.equal(writes[0].tableId, 'site_analytics_batches');
  assert.deepEqual(writes[0].permissions, []);
  assert.deepEqual(writes[0].data, { events: JSON.stringify(batch) });
});

test('scheduled cleanup targets only batches older than the rolling retention window', async () => {
  const calls = [];
  const run = createHandler({}, () => ({
    async deleteRows(options) { calls.push(options); return { rows: [] }; },
  }));
  const result = await run({
    req: { headers: { 'x-appwrite-trigger': 'schedule' } },
    res: { json: (body, status) => ({ body, status }) },
  });
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tableId, 'site_analytics_batches');
  const cutoff = JSON.parse(calls[0].queries[0]);
  assert.equal(cutoff.attribute, '$createdAt');
  assert.ok(Math.abs(Date.parse(cutoff.values[0]) - (Date.now() - 30 * 86400000)) < 10000);
});
