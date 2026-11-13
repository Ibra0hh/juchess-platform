import { Client, ID, Query, TablesDB } from 'node-appwrite';

const tableId = 'site_analytics_batches';
const pages = new Set(['home', 'tournaments', 'tournament', 'tools', 'join-the-team', 'team', 'leaderboard', 'privacy', 'terms', 'welcome']);
const controls = new Set([
  'nav-home', 'nav-tournaments', 'nav-tools', 'nav-profile', 'nav-sign-in',
  'home-join', 'home-vision', 'home-news', 'home-feature', 'home-team', 'home-apply',
  'footer-tournaments', 'footer-tools', 'footer-join', 'footer-apply',
  'tournament-card', 'tournament-filter', 'tournament-list', 'tournament-grid',
  'tools-review', 'tools-analysis', 'tools-blank', 'tools-find-games', 'tools-load-more', 'tools-start-review',
  'intro-piece', 'intro-enter',
]);

export function validateBatch(input) {
  if (!Array.isArray(input) || !input.length || input.length > 32) throw new Error('Invalid event batch');
  return input.map((entry) => {
    if (!Array.isArray(entry) || !pages.has(entry[1]) || !['narrow', 'wide'].includes(entry[2])) throw new Error('Invalid page');
    const [kind, page, device, first, second, third] = entry;
    if (kind === 'v' && entry.length === 4 && (first === 0 || first === 1)) return [kind, page, device, first];
    if (kind === 'c' && entry.length === 6 && (first === null || controls.has(first))
        && ((second === null && third === null && first !== null) || (
          Number.isInteger(second) && second >= 0 && second < 12 && Number.isInteger(third) && third >= 0 && third < 16
        ))) {
      return [kind, page, device, first, second, third];
    }
    throw new Error('Invalid event');
  });
}

export function createHandler(env, getTables) {
  return async ({ req, res }) => {
    const reply = (body, status = 200) => res.json(body, status, { 'cache-control': 'no-store' });
    const scheduled = req.headers['x-appwrite-trigger'] === 'schedule';
    const databaseId = env.JUCHESS_DATABASE_ID || 'juchess';
    if (!scheduled && req.method === 'GET' && req.path === '/') return reply({ ok: true });
    if (!scheduled && (req.method !== 'POST' || req.path !== '/collect')) return reply({ ok: false }, 404);
    let events;
    if (!scheduled) {
      try {
        if (typeof req.bodyText !== 'string' || req.bodyText.length > 4096) return reply({ ok: false }, 413);
        events = validateBatch(JSON.parse(req.bodyText));
      } catch {
        return reply({ ok: false }, 400);
      }
    }
    try {
      const tables = getTables(req.headers['x-appwrite-key']);
      if (scheduled) {
        const expiresBefore = new Date(Date.now() - 30 * 86400000).toISOString();
        for (let i = 0; i < 50; i++) {
          const result = await tables.deleteRows({
            databaseId, tableId,
            queries: [Query.lessThan('$createdAt', expiresBefore), Query.limit(100)],
          });
          if (result.rows.length < 100) break;
        }
      } else {
        await tables.createRow({
          databaseId, tableId, rowId: ID.unique(), data: { events: JSON.stringify(events) }, permissions: [],
        });
      }
      return reply({ ok: true });
    } catch {
      return reply({ ok: false }, 503);
    }
  };
}

export default createHandler(process.env, (key) => new TablesDB(new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(key)));
