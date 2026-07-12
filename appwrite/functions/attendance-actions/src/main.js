import { createHash } from 'node:crypto';
import { Client, Query, TablesDB } from 'node-appwrite';

const tableIds = {
  attendance: 'attendance_confirmations',
  tournaments: 'tournaments',
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseBody(req) {
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  } catch {
    // Appwrite's bodyJson getter throws for an empty request body.
  }
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

export function hashAttendanceToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function isInvitationExpired(row, nowMs = Date.now()) {
  const expiresAt = Date.parse(String(row.tokenExpiresAt ?? ''));
  return !Number.isFinite(expiresAt) || nowMs >= expiresAt;
}

async function findInvitation(tablesDB, databaseId, token) {
  const normalized = String(token ?? '').trim();
  if (normalized.length < 20 || normalized.length > 200) {
    throw new HttpError(404, 'This attendance link is invalid or has expired.');
  }

  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.attendance,
    queries: [Query.equal('tokenHash', hashAttendanceToken(normalized)), Query.limit(2)],
    total: false,
  });
  if (response.rows.length !== 1) {
    throw new HttpError(404, 'This attendance link is invalid or has expired.');
  }
  return response.rows[0];
}

async function invitationPayload(tablesDB, databaseId, row, nowMs = Date.now()) {
  const tournament = await tablesDB.getRow({
    databaseId,
    tableId: tableIds.tournaments,
    rowId: row.tournamentId,
  }).catch(() => null);
  const expired = isInvitationExpired(row, nowMs);
  return {
    status: row.status,
    expired,
    canRespond: !expired && ['pending', 'confirmed', 'declined'].includes(row.status),
    respondedAt: row.respondedAt ?? null,
    tournament: tournament ? {
      id: tournament.$id,
      slug: tournament.slug ?? tournament.$id,
      name: tournament.name ?? 'JuChess tournament',
      startsAt: tournament.startsAt ?? null,
    } : null,
  };
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const tablesDB = new TablesDB(client);
  const databaseId = process.env.JUCHESS_DATABASE_ID ?? 'juchess';
  const method = req.method.toUpperCase();
  const path = req.path || '/';
  const segments = routeSegments(path);
  const body = parseBody(req);

  if (method === 'GET' && segments.length === 0) {
    return res.json({
      ok: true,
      service: 'juchess-attendance-actions',
      routes: ['POST /resolve', 'POST /respond'],
    });
  }

  try {
    if (method === 'POST' && segments[0] === 'resolve') {
      const row = await findInvitation(tablesDB, databaseId, body.token);
      return res.json({ ok: true, invitation: await invitationPayload(tablesDB, databaseId, row) });
    }

    if (method === 'POST' && segments[0] === 'respond') {
      const status = String(body.status ?? '');
      if (!['confirmed', 'declined'].includes(status)) {
        throw new HttpError(400, 'Choose Yes or No to answer the attendance question.');
      }

      const row = await findInvitation(tablesDB, databaseId, body.token);
      if (isInvitationExpired(row)) {
        throw new HttpError(410, 'This attendance link has expired. The organizer can still see that no response was received.');
      }

      const now = new Date().toISOString();
      const updated = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.attendance,
        rowId: row.$id,
        data: {
          status,
          respondedAt: now,
          responseSource: 'email',
          updatedAt: now,
        },
      });

      log(`Attendance ${status} from email link for ${updated.registrationId}.`);
      return res.json({ ok: true, invitation: await invitationPayload(tablesDB, databaseId, updated) });
    }

    return res.json({ ok: false, error: `No attendance action for ${method} ${path}` }, 404);
  } catch (caught) {
    if (!(caught instanceof HttpError)) error(caught?.message ?? String(caught));
    return res.json({
      ok: false,
      error: caught instanceof HttpError ? caught.message : 'The attendance link could not be processed.',
    }, caught instanceof HttpError ? caught.statusCode : 500);
  }
};
