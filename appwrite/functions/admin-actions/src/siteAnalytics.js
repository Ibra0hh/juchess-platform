import { Query } from 'node-appwrite';

const tableId = 'site_analytics_batches';
const reportLimit = 20000;

function add(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

export async function loadSiteAnalytics(tables, databaseId, days, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const pages = new Map();
  let cursor, scanned = 0, visits = 0, views = 0, clicks = 0;
  let truncated = false;
  for (;;) {
    const { rows } = await tables.listRows({
      databaseId, tableId,
      queries: [
        Query.greaterThanEqual('$createdAt', since), Query.orderDesc('$createdAt'),
        Query.select(['$id', 'events']), Query.limit(200), ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false, ttl: 0,
    });
    for (const row of rows) {
      if (++scanned > reportLimit) { truncated = true; break; }
      let batch;
      try { batch = JSON.parse(row.events); } catch { continue; }
      if (!Array.isArray(batch)) continue;
      for (const entry of batch) {
        if (!Array.isArray(entry)) continue;
        const [kind, page, device, first, x, y] = entry;
        if (!pages.has(page)) pages.set(page, { page, views: 0, visits: 0, clicks: 0, controls: new Map(), devices: { narrow: new Map(), wide: new Map() } });
        const summary = pages.get(page);
        if (kind === 'v') {
          summary.views++;
          views++;
          if (first === 1) { summary.visits++; visits++; }
        } else if (kind === 'c' && Object.hasOwn(summary.devices, device)) {
          summary.clicks++;
          clicks++;
          if (first) add(summary.controls, first);
          if (Number.isInteger(x) && Number.isInteger(y)) add(summary.devices[device], y * 12 + x);
        }
      }
    }
    if (truncated || rows.length < 200) break;
    const next = rows.at(-1).$id;
    if (!next || next === cursor) throw new Error('Analytics pagination did not advance.');
    cursor = next;
  }
  const summaries = [...pages.values()].map(({ devices, controls, ...row }) => ({
    ...row,
    controls: [...controls].sort((a, b) => b[1] - a[1]),
    heat: { narrow: [...devices.narrow], wide: [...devices.wide] },
  })).sort((a, b) => b.views - a.views || b.clicks - a.clicks);
  return { days, visits, views, clicks, pages: summaries, truncated };
}
