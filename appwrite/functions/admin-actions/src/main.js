import { Client, ID, TablesDB } from 'node-appwrite';

const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  adminAudit: 'admin_audit',
};

function parseBody(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') {
    return req.bodyJson;
  }

  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const text = req.bodyText ?? req.bodyRaw ?? '';
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function routeSegments(path = '/') {
  return path.split('/').filter(Boolean);
}

function badRequest(res, message, details = {}) {
  return res.json({ ok: false, error: message, ...details }, 400);
}

function notFound(res, method, path) {
  return res.json({ ok: false, error: `No admin action for ${method} ${path}` }, 404);
}

function requireFields(body, fields) {
  return fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
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

  log(`JuChess admin action ${method} ${path}`);

  if (method === 'GET' && segments.length === 0) {
    return res.json({
      ok: true,
      service: 'juchess-admin-actions',
      databaseId,
      tables: tableIds,
      routes: [
        'POST /tournaments',
        'PATCH /tournaments/:id',
        'DELETE /tournaments/:id',
        'POST /registrations/:id/confirm',
        'POST /games/:id/result',
        'POST /profiles/:id/role',
        'POST /profiles/:id/status',
        'POST /announcements',
      ],
    });
  }

  try {
    if (method === 'POST' && segments[0] === 'tournaments' && segments.length === 1) {
      const missing = requireFields(body, ['slug', 'name', 'format', 'timeControl', 'status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing required tournament fields.', { missing });
      }

      const row = await tablesDB.createRow(
        databaseId,
        tableIds.tournaments,
        ID.unique(),
        cleanObject({
          slug: body.slug,
          name: body.name,
          status: body.status,
          format: body.format,
          timeControl: body.timeControl,
          roundsTotal: body.roundsTotal,
          currentRound: body.currentRound,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          location: body.location,
          capacity: body.capacity,
          description: body.description,
          createdByProfileId: body.createdByProfileId ?? req.headers['x-appwrite-user-id'] ?? 'system',
        }),
      );

      return res.json({ ok: true, action: 'createTournament', row });
    }

    if (method === 'PATCH' && segments[0] === 'tournaments' && segments[1]) {
      const row = await tablesDB.updateRow(
        databaseId,
        tableIds.tournaments,
        segments[1],
        cleanObject({
          slug: body.slug,
          name: body.name,
          status: body.status,
          format: body.format,
          timeControl: body.timeControl,
          roundsTotal: body.roundsTotal,
          currentRound: body.currentRound,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          location: body.location,
          capacity: body.capacity,
          description: body.description,
        }),
      );

      return res.json({ ok: true, action: 'updateTournament', row });
    }

    if (method === 'DELETE' && segments[0] === 'tournaments' && segments[1]) {
      await tablesDB.deleteRow(databaseId, tableIds.tournaments, segments[1]);
      return res.json({ ok: true, action: 'deleteTournament', rowId: segments[1] });
    }

    if (method === 'POST' && segments[0] === 'registrations' && segments[1] && segments[2] === 'confirm') {
      const row = await tablesDB.updateRow(
        databaseId,
        tableIds.registrations,
        segments[1],
        cleanObject({
          status: body.status ?? 'confirmed',
          seed: body.seed,
          checkedIn: body.checkedIn,
        }),
      );

      return res.json({ ok: true, action: 'confirmRegistration', row });
    }

    if (method === 'POST' && segments[0] === 'games' && segments[1] && segments[2] === 'result') {
      const missing = requireFields(body, ['result']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing game result.', { missing });
      }

      const row = await tablesDB.updateRow(
        databaseId,
        tableIds.games,
        segments[1],
        cleanObject({
          status: body.status ?? 'completed',
          result: body.result,
          pgn: body.pgn,
          finishedAt: body.finishedAt ?? new Date().toISOString(),
        }),
      );

      return res.json({ ok: true, action: 'submitGameResult', row });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] && segments[2] === 'role') {
      const missing = requireFields(body, ['role']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing profile role.', { missing });
      }

      const row = await tablesDB.updateRow(
        databaseId,
        tableIds.profiles,
        segments[1],
        { role: body.role },
      );

      return res.json({ ok: true, action: 'updateProfileRole', row });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] && segments[2] === 'status') {
      const missing = requireFields(body, ['status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing profile status.', { missing });
      }

      const row = await tablesDB.updateRow(
        databaseId,
        tableIds.profiles,
        segments[1],
        { status: body.status },
      );

      return res.json({ ok: true, action: 'updateProfileStatus', row });
    }

    if (method === 'POST' && segments[0] === 'announcements' && segments.length === 1) {
      const missing = requireFields(body, ['title', 'body']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing announcement fields.', { missing });
      }

      const row = await tablesDB.createRow(
        databaseId,
        tableIds.announcements,
        ID.unique(),
        cleanObject({
          title: body.title,
          body: body.body,
          audience: body.audience ?? 'public',
          status: body.status ?? 'published',
          publishedAt: body.publishedAt ?? new Date().toISOString(),
          createdByProfileId: body.createdByProfileId ?? req.headers['x-appwrite-user-id'] ?? 'system',
        }),
      );

      return res.json({ ok: true, action: 'createAnnouncement', row });
    }

    return notFound(res, method, path);
  } catch (cause) {
    error(cause?.message ?? String(cause));
    return res.json({
      ok: false,
      error: 'Admin action failed.',
      detail: cause?.message ?? String(cause),
    }, 500);
  }
};
