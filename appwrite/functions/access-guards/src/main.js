import { Client, Query, TablesDB } from 'node-appwrite';

const tableIds = {
  profiles: 'profiles',
  profilePrivate: 'profile_private',
  identityBlocks: 'identity_blocks',
  ipBlocks: 'ip_blocks',
};

function parseBody(req) {
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  } catch {}

  if (req.body && typeof req.body === 'object') return req.body;

  const text = req.bodyText ?? req.bodyRaw ?? '';
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function routeSegments(path = '/') {
  return path.split('/').filter(Boolean);
}

export function normalizePhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const compact = raw.replace(/[^\d+]/g, '');
  if (compact.startsWith('+962')) return `+962${compact.slice(4).replace(/\D/g, '')}`;
  if (compact.startsWith('00962')) return `+962${compact.slice(5).replace(/\D/g, '')}`;
  if (compact.startsWith('962')) return `+962${compact.slice(3).replace(/\D/g, '')}`;

  const digits = compact.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+962${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `+962${digits}`;
  return raw;
}

export function normalizeCandidates(body) {
  const candidates = [];
  const email = String(body.email ?? '').trim().toLowerCase();
  const universityId = String(body.universityId ?? '').trim().toLowerCase();
  const phone = normalizePhone(body.phone);

  if (email) candidates.push({ type: 'email', value: email });
  if (universityId) candidates.push({ type: 'universityId', value: universityId });
  if (phone) candidates.push({ type: 'phone', value: phone });

  return candidates;
}

export function mergeCandidates(...groups) {
  const merged = new Map();
  for (const candidate of groups.flat()) {
    if (!candidate?.type || !candidate?.value) continue;
    merged.set(`${candidate.type}:${candidate.value}`, candidate);
  }
  return [...merged.values()];
}

async function loadStoredCandidates(tablesDB, databaseId, accountId) {
  if (!accountId) return [];

  try {
    const response = await tablesDB.listRows({
      databaseId,
      tableId: tableIds.profilePrivate,
      queries: [Query.equal('accountId', accountId), Query.limit(1)],
      total: false,
    });
    if (response.rows[0]) return normalizeCandidates(response.rows[0]);
  } catch {
    // Additive-deployment compatibility while profile_private is introduced.
  }

  try {
    const legacy = await tablesDB.listRows({
      databaseId,
      tableId: tableIds.profiles,
      queries: [Query.equal('accountId', accountId), Query.limit(1)],
      total: false,
    });
    return legacy.rows[0] ? normalizeCandidates(legacy.rows[0]) : [];
  } catch {
    return [];
  }
}

function getRequestIp(req) {
  const headers = req.headers ?? {};
  const raw =
    headers['x-forwarded-for'] ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    headers['client-ip'] ||
    headers['x-appwrite-user-ip'] ||
    '';

  return String(raw).split(',')[0].trim();
}

function ipv4ToInt(ip) {
  const parts = String(ip).split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts.reduce((sum, part) => (sum << 8) + part, 0) >>> 0;
}

function ipMatchesRange(ip, range) {
  const trimmed = String(range ?? '').trim();
  if (!ip || !trimmed) return false;
  if (ip === trimmed) return true;
  if (!trimmed.includes('/')) return false;

  const [network, prefixText] = trimmed.split('/');
  const prefix = Number(prefixText);
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  if (ipInt === null || networkInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

async function listRows(tablesDB, databaseId, tableId, fields) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId,
    queries: [Query.select(fields), Query.limit(500)],
    total: false,
  });

  return response.rows;
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const databaseId = process.env.JUCHESS_DATABASE_ID ?? 'juchess';
  const method = req.method.toUpperCase();
  const segments = routeSegments(req.path || '/');
  const body = parseBody(req);

  if (method === 'GET' && segments.length === 0) {
    return res.json({ ok: true, service: 'juchess-access-guards', routes: ['POST /check'] });
  }

  if (method !== 'POST' || segments[0] !== 'check') {
    return res.json({ ok: false, error: `No access guard route for ${method} ${req.path || '/'}` }, 404);
  }

  try {
    const startedAt = Date.now();
    log('Access guard check started.');
    const requestIp = getRequestIp(req);
    const accountId = String(req.headers?.['x-appwrite-user-id'] ?? '').trim();
    const [identityBlocks, ipBlocks, storedCandidates] = await Promise.all([
      listRows(tablesDB, databaseId, tableIds.identityBlocks, ['type', 'value', 'reason', 'status']),
      listRows(tablesDB, databaseId, tableIds.ipBlocks, ['ipRange', 'reason', 'status']),
      loadStoredCandidates(tablesDB, databaseId, accountId),
    ]);

    log(`Access guard data loaded in ${Date.now() - startedAt}ms.`);

    // Before sign-up there is no authenticated account, so submitted values
    // are the only candidates. Authenticated checks also include the canonical
    // owner-only identity row and cannot evade a block by omitting body fields.
    const candidates = mergeCandidates(normalizeCandidates(body), storedCandidates);
    const identityMatch = identityBlocks.find((block) => (
      block.status === 'active' &&
      candidates.some((candidate) => candidate.type === block.type && candidate.value === block.value)
    ));

    if (identityMatch) {
      log(`Blocked request by ${identityMatch.type} identity rule.`);
      return res.json({
        ok: true,
        allowed: false,
        blockType: 'identity',
        identityType: identityMatch.type,
        reason: identityMatch.reason || 'This player is blocked by club administration.',
      });
    }

    const ipMatch = ipBlocks.find((block) => block.status === 'active' && ipMatchesRange(requestIp, block.ipRange));
    if (ipMatch) {
      log('Blocked request by network rule.');
      return res.json({
        ok: true,
        allowed: false,
        blockType: 'ip',
        reason: ipMatch.reason || 'This network is blocked by club administration.',
      });
    }

    log(`Access guard check completed in ${Date.now() - startedAt}ms.`);
    return res.json({ ok: true, allowed: true });
  } catch (cause) {
    error('Access guard verification failed.');
    return res.json({
      ok: false,
      allowed: false,
      error: 'Access guard failed.',
      reason: 'Access could not be verified right now.',
    }, 500);
  }
};
