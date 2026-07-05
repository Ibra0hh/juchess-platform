import { Client, ID, Query, TablesDB, Users } from 'node-appwrite';

const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  adminAudit: 'admin_audit',
  identityBlocks: 'identity_blocks',
  ipBlocks: 'ip_blocks',
};

function parseBody(req) {
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') {
      return req.bodyJson;
    }
  } catch {
    // Appwrite's bodyJson getter throws when a request has no JSON body.
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

function normalizeIdentityValue(type, value) {
  if (type === 'email') return String(value ?? '').trim().toLowerCase();
  if (type === 'universityId') return String(value ?? '').trim().toLowerCase();
  if (type === 'phone') return normalizePhone(value);
  return String(value ?? '').trim();
}

function actorProfileId(req, body) {
  return body.actorProfileId || req.headers['x-appwrite-user-id'] || 'system';
}

async function writeAudit(tablesDB, databaseId, { actorProfileId, action, targetTable, targetRowId, payload }) {
  try {
    await tablesDB.createRow({
      databaseId,
      tableId: tableIds.adminAudit,
      rowId: ID.unique(),
      data: cleanObject({
        actorProfileId,
        action,
        targetTable,
        targetRowId,
        payload: payload ? JSON.stringify(payload).slice(0, 4000) : undefined,
        createdAt: new Date().toISOString(),
      }),
    });
  } catch {
    // Audit writes should not make the primary admin action fail.
  }
}

async function setProfileStatus(tablesDB, databaseId, profileId, status) {
  if (!profileId) return;
  await tablesDB.updateRow({
    databaseId,
    tableId: tableIds.profiles,
    rowId: profileId,
    data: { status },
  });
}

async function listBlockRows(tablesDB, databaseId) {
  const [identityResponse, ipResponse] = await Promise.all([
    tablesDB.listRows({
      databaseId,
      tableId: tableIds.identityBlocks,
      queries: [Query.limit(500)],
      total: false,
    }),
    tablesDB.listRows({
      databaseId,
      tableId: tableIds.ipBlocks,
      queries: [Query.limit(500)],
      total: false,
    }),
  ]);

  return {
    identityBlocks: identityResponse.rows.toSorted(compareCreatedAtDesc),
    ipBlocks: ipResponse.rows.toSorted(compareCreatedAtDesc),
  };
}

function compareCreatedAtDesc(a, b) {
  return String(b.createdAt || b.$createdAt || '').localeCompare(String(a.createdAt || a.$createdAt || ''));
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const users = new Users(client);
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
        'GET /blocks',
        'POST /blocks/identity',
        'POST /blocks/identity/:id/unblock',
        'POST /blocks/ip',
        'POST /blocks/ip/:id/unblock',
        'POST /registrations/:id/confirm',
        'POST /games/:id/result',
        'POST /profiles/:id/role',
        'POST /profiles/:id/status',
        'POST /announcements',
      ],
    });
  }

  try {
    if (method === 'GET' && segments[0] === 'blocks' && segments.length === 1) {
      const blocks = await listBlockRows(tablesDB, databaseId);
      return res.json({ ok: true, ...blocks });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'identity' && segments.length === 2) {
      const missing = requireFields(body, ['type', 'value']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing identity block fields.', { missing });
      }

      if (!['email', 'universityId', 'phone'].includes(body.type)) {
        return badRequest(res, 'Unsupported identity block type.');
      }

      const value = normalizeIdentityValue(body.type, body.value);
      if (!value) return badRequest(res, 'Block value is empty after normalization.');

      if (body.targetUserId && body.blockAccount !== false) {
        await users.updateStatus({ userId: body.targetUserId, status: false });
        await users.deleteSessions({ userId: body.targetUserId });
      }

      if (body.targetProfileId) {
        await setProfileStatus(tablesDB, databaseId, body.targetProfileId, 'suspended');
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.identityBlocks,
        rowId: ID.unique(),
        data: cleanObject({
          type: body.type,
          value,
          reason: body.reason,
          status: 'active',
          targetUserId: body.targetUserId,
          targetProfileId: body.targetProfileId,
          createdByProfileId: actorProfileId(req, body),
          createdAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body),
        action: 'blockIdentity',
        targetTable: tableIds.identityBlocks,
        targetRowId: row.$id,
        payload: { type: body.type, value, targetUserId: body.targetUserId, targetProfileId: body.targetProfileId },
      });

      return res.json({ ok: true, action: 'blockIdentity', row });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'identity' && segments[2] && segments[3] === 'unblock') {
      const block = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.identityBlocks,
        rowId: segments[2],
      });

      if (block.targetUserId && body.unblockAccount !== false) {
        await users.updateStatus({ userId: block.targetUserId, status: true });
      }

      if (block.targetProfileId) {
        await setProfileStatus(tablesDB, databaseId, block.targetProfileId, 'active');
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.identityBlocks,
        rowId: segments[2],
        data: cleanObject({
          status: 'lifted',
          liftedByProfileId: actorProfileId(req, body),
          liftedAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body),
        action: 'unblockIdentity',
        targetTable: tableIds.identityBlocks,
        targetRowId: row.$id,
        payload: { type: block.type, value: block.value, targetUserId: block.targetUserId, targetProfileId: block.targetProfileId },
      });

      return res.json({ ok: true, action: 'unblockIdentity', row });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'ip' && segments.length === 2) {
      const missing = requireFields(body, ['ipRange']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing IP block fields.', { missing });
      }

      const ipRange = String(body.ipRange).trim();
      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.ipBlocks,
        rowId: ID.unique(),
        data: cleanObject({
          ipRange,
          reason: body.reason,
          status: 'active',
          createdByProfileId: actorProfileId(req, body),
          createdAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body),
        action: 'blockIp',
        targetTable: tableIds.ipBlocks,
        targetRowId: row.$id,
        payload: { ipRange },
      });

      return res.json({ ok: true, action: 'blockIp', row });
    }

    if (method === 'POST' && segments[0] === 'blocks' && segments[1] === 'ip' && segments[2] && segments[3] === 'unblock') {
      const block = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.ipBlocks,
        rowId: segments[2],
      });

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.ipBlocks,
        rowId: segments[2],
        data: cleanObject({
          status: 'lifted',
          liftedByProfileId: actorProfileId(req, body),
          liftedAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body),
        action: 'unblockIp',
        targetTable: tableIds.ipBlocks,
        targetRowId: row.$id,
        payload: { ipRange: block.ipRange },
      });

      return res.json({ ok: true, action: 'unblockIp', row });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments.length === 1) {
      const missing = requireFields(body, ['slug', 'name', 'format', 'timeControl', 'status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing required tournament fields.', { missing });
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: ID.unique(),
        data: cleanObject({
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
      });

      return res.json({ ok: true, action: 'createTournament', row });
    }

    if (method === 'PATCH' && segments[0] === 'tournaments' && segments[1]) {
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: segments[1],
        data: cleanObject({
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
      });

      return res.json({ ok: true, action: 'updateTournament', row });
    }

    if (method === 'DELETE' && segments[0] === 'tournaments' && segments[1]) {
      await tablesDB.deleteRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: segments[1],
      });
      return res.json({ ok: true, action: 'deleteTournament', rowId: segments[1] });
    }

    if (method === 'POST' && segments[0] === 'registrations' && segments[1] && segments[2] === 'confirm') {
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.registrations,
        rowId: segments[1],
        data: cleanObject({
          status: body.status ?? 'confirmed',
          seed: body.seed,
          checkedIn: body.checkedIn,
        }),
      });

      return res.json({ ok: true, action: 'confirmRegistration', row });
    }

    if (method === 'POST' && segments[0] === 'games' && segments[1] && segments[2] === 'result') {
      const missing = requireFields(body, ['result']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing game result.', { missing });
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.games,
        rowId: segments[1],
        data: cleanObject({
          status: body.status ?? 'completed',
          result: body.result,
          pgn: body.pgn,
          finishedAt: body.finishedAt ?? new Date().toISOString(),
        }),
      });

      return res.json({ ok: true, action: 'submitGameResult', row });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] && segments[2] === 'role') {
      const missing = requireFields(body, ['role']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing profile role.', { missing });
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.profiles,
        rowId: segments[1],
        data: { role: body.role },
      });

      return res.json({ ok: true, action: 'updateProfileRole', row });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] && segments[2] === 'status') {
      const missing = requireFields(body, ['status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing profile status.', { missing });
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.profiles,
        rowId: segments[1],
        data: { status: body.status },
      });

      return res.json({ ok: true, action: 'updateProfileStatus', row });
    }

    if (method === 'POST' && segments[0] === 'announcements' && segments.length === 1) {
      const missing = requireFields(body, ['title', 'body']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing announcement fields.', { missing });
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.announcements,
        rowId: ID.unique(),
        data: cleanObject({
          title: body.title,
          body: body.body,
          audience: body.audience ?? 'public',
          status: body.status ?? 'published',
          publishedAt: body.publishedAt ?? new Date().toISOString(),
          createdByProfileId: body.createdByProfileId ?? req.headers['x-appwrite-user-id'] ?? 'system',
        }),
      });

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
