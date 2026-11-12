import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { Client, TablesDB } from 'node-appwrite';

export function networkMarker(address, secret) {
  const ip = typeof address === 'string' ? address.trim() : '';
  const version = isIP(ip);
  if (!version || ip.includes('%') || !/^[a-f0-9]{64}$/.test(secret ?? '')) return null;
  let normalized = version === 4 ? ip : new URL(`http://[${ip}]/`).hostname;
  const mapped = /^\[::ffff:([a-f\d]{1,4}):([a-f\d]{1,4})\]$/.exec(normalized);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    normalized = [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(normalized).digest('hex').slice(0, 36);
}

export function createHandler(env, getTables) {
  return async ({ req, res }) => {
    const reply = (body, status = 200) => res.json(body, status, { 'cache-control': 'no-store' });
    if (req.method !== 'POST' || !['/status', '/complete'].includes(req.path)) {
      return reply({ error: 'not-found' }, 404);
    }
    const rowId = networkMarker(req.headers['x-appwrite-client-ip'], env.JUCHESS_VISITOR_INTRO_SECRET);
    if (!rowId) return reply({ error: 'unavailable' }, 503);

    const row = { databaseId: 'juchess', tableId: 'visitor_intro', rowId };
    try {
      const tables = getTables(req.headers['x-appwrite-key']);
      if (req.path === '/status') {
        try {
          await tables.getRow(row);
        } catch (failure) {
          if (failure.type === 'row_not_found') return reply({ seen: false });
          throw failure;
        }
      } else {
        try {
          await tables.createRow({ ...row, data: { completed: true }, permissions: [] });
        } catch (failure) {
          if (failure.type !== 'row_already_exists') throw failure;
        }
      }
      return reply({ seen: true });
    } catch {
      return reply({ error: 'unavailable' }, 503);
    }
  };
}

export default createHandler(process.env, (key) => new TablesDB(new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(key)));
