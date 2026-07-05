import { Client, Query, TablesDB } from 'node-appwrite';

const tableIds = {
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

function normalizePhone(value) {
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

function normalizeCandidates(body) {
  const candidates = [];
  const email = String(body.email ?? '').trim().toLowerCase();
  const universityId = String(body.universityId ?? '').trim().toLowerCase();
  const phone = normalizePhone(body.phone);

  if (email) candidates.push({ type: 'email', value: email });
  if (universityId) candidates.push({ type: 'universityId', value: universityId });
  if (phone) candidates.push({ type: 'phone', value: phone });

  return candidates;
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

async function listRows(tablesDB, databaseId, tableId) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId,
    queries: [Query.limit(500)],
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
    const requestIp = getRequestIp(req);
    const [identityBlocks, ipBlocks] = await Promise.all([
      listRows(tablesDB, databaseId, tableIds.identityBlocks),
      listRows(tablesDB, databaseId, tableIds.ipBlocks),
    ]);

    const candidates = normalizeCandidates(body);
    const identityMatch = identityBlocks.find((block) => (
      block.status === 'active' &&
      candidates.some((candidate) => candidate.type === block.type && candidate.value === block.value)
    ));

    if (identityMatch) {
      log(`Blocked identity ${identityMatch.type}:${identityMatch.value}`);
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
      log(`Blocked IP ${requestIp} by ${ipMatch.ipRange}`);
      return res.json({
        ok: true,
        allowed: false,
        blockType: 'ip',
        reason: ipMatch.reason || 'This network is blocked by club administration.',
      });
    }

    return res.json({ ok: true, allowed: true });
  } catch (cause) {
    error(cause?.message ?? String(cause));
    return res.json({
      ok: false,
      allowed: false,
      error: 'Access guard failed.',
      reason: 'Access could not be verified right now.',
      detail: cause?.message ?? String(cause),
    }, 500);
  }
};
