import assert from 'node:assert/strict';
import test from 'node:test';
import { createHandler, networkMarker } from '../src/main.js';

const secret = 'a1'.repeat(32);

test('network markers are private, stable, and address-specific', () => {
  const marker = networkMarker('192.0.2.20', secret);
  assert.match(marker, /^[0-9a-f]{36}$/);
  assert.equal(marker, networkMarker('::ffff:192.0.2.20', secret));
  assert.equal(networkMarker('2001:0db8:0:0:0:0:0:1', secret), networkMarker('2001:db8::1', secret));
  assert.notEqual(marker, networkMarker('192.0.2.21', secret));
  assert.notEqual(marker, networkMarker('192.0.2.20', 'a2'.repeat(32)));
  for (const value of ['', 'not-an-address', '192.0.2.20, 192.0.2.21', 'fe80::1%eth0']) {
    assert.equal(networkMarker(value, secret), null);
  }
  assert.equal(networkMarker('192.0.2.20', ''), null);
});

test('a completed network is remembered and repeats do not create extra rows', async () => {
  const rows = new Map();
  const handler = createHandler({ JUCHESS_VISITOR_INTRO_SECRET: secret }, () => ({
    getRow: async ({ rowId }) => {
      if (!rows.has(rowId)) throw { type: 'row_not_found' };
    },
    createRow: async ({ rowId, data, permissions }) => {
      if (rows.has(rowId)) throw { type: 'row_already_exists' };
      assert.deepEqual(data, { completed: true });
      assert.deepEqual(permissions, []);
      rows.set(rowId, data);
    },
  }));
  const call = (path, ip = '192.0.2.20') => handler({
    req: { path, method: 'POST', headers: { 'x-appwrite-client-ip': ip } },
    res: { json: (body, status) => ({ body, status }) },
  });
  assert.deepEqual(await call('/status'), { status: 200, body: { seen: false } });
  assert.equal(rows.size, 0);
  assert.deepEqual(await call('/complete'), { status: 200, body: { seen: true } });
  assert.deepEqual(await call('/complete'), { status: 200, body: { seen: true } });
  assert.deepEqual(await call('/status'), { status: 200, body: { seen: true } });
  assert.deepEqual(await call('/status', '192.0.2.21'), { status: 200, body: { seen: false } });
  assert.equal(rows.size, 1);
});

test('missing metadata and storage outages return unavailable without exposing details', async () => {
  const handler = createHandler({ JUCHESS_VISITOR_INTRO_SECRET: secret }, () => {
    throw new Error('storage detail');
  });
  const run = (headers) => handler({
    req: { path: '/status', method: 'POST', headers },
    res: { json: (body, status) => ({ body, status }) },
  });
  const unavailable = { status: 503, body: { error: 'unavailable' } };
  assert.deepEqual(await run({ 'x-forwarded-for': '192.0.2.20' }), unavailable);
  assert.deepEqual(await run({ 'x-appwrite-client-ip': '192.0.2.20' }), unavailable);
});
