import { Account, Client, ID, Permission, Query, Role, TablesDB, Teams, Users } from 'node-appwrite';

const tableIds = {
  adminProfiles: 'admin_profiles',
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

const adminTeamIds = {
  superAdmins: 'admin_super_admins',
  staff: 'admin_staff',
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

function normalizeBracketSnapshot(value) {
  if (value === undefined || value === null || value === '') return null;
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  try {
    const parsed = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!['single', 'double'].includes(parsed.type)) return null;
    return serialized;
  } catch {
    return null;
  }
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

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
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

function actorProfileId(req, body, actor) {
  return body.actorProfileId || actor?.$id || req.headers['x-appwrite-user-id'] || 'system';
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

async function loadAdminProfile(tablesDB, databaseId, accountId) {
  if (!accountId) return null;

  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.adminProfiles,
    queries: [Query.equal('accountId', accountId), Query.limit(1)],
    total: false,
  });

  return response.rows[0] ?? null;
}

async function getAuthenticatedAccountId(req) {
  const jwt = req.headers['juchess-admin-jwt'] || req.headers['x-appwrite-user-jwt'];
  if (!jwt) {
    throw new HttpError(401, 'Admin session is required.');
  }

  const userClient = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);

  const account = new Account(userClient);
  try {
    const user = await account.get();
    return user.$id;
  } catch {
    throw new HttpError(401, 'Admin session is required.');
  }
}

async function requireAdminActor(req, tablesDB, databaseId) {
  const accountId = await getAuthenticatedAccountId(req);
  const profile = await loadAdminProfile(tablesDB, databaseId, accountId);
  if (!profile) {
    throw new HttpError(403, 'This account is not registered for the admin panel.');
  }

  if (profile.status !== 'active') {
    throw new HttpError(403, 'This admin account is suspended.');
  }

  if (!['superAdmin', 'admin', 'organizer'].includes(profile.role)) {
    throw new HttpError(403, 'This admin role is not allowed.');
  }

  return profile;
}

function requireSuperAdmin(actor) {
  if (actor.role !== 'superAdmin') {
    throw new HttpError(403, 'Only a super admin can manage admin access.');
  }
}

function adminTeamForRole(role) {
  return role === 'superAdmin' ? adminTeamIds.superAdmins : adminTeamIds.staff;
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const users = new Users(client);
  const teams = new Teams(client);
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
        'POST /tournaments/:id/pairings/publish',
        'POST /tournaments/:id/pairings/unpublish',
        'POST /profiles/lookup',
        'GET /admin/session',
        'GET /admin/admins',
        'POST /admin/admins',
        'POST /admin/admins/:id/status',
        'GET /blocks',
        'POST /blocks/identity',
        'POST /blocks/identity/:id/unblock',
        'POST /blocks/ip',
        'POST /blocks/ip/:id/unblock',
        'POST /registrations/:id/confirm',
        'POST /registrations/:id/status',
        'POST /games/:id/result',
        'POST /profiles/:id/role',
        'POST /profiles/:id/status',
        'POST /announcements',
      ],
    });
  }

  try {
    const actor = await requireAdminActor(req, tablesDB, databaseId);

    if (method === 'GET' && segments[0] === 'admin' && segments[1] === 'session') {
      return res.json({ ok: true, allowed: true, profile: actor });
    }

    if (method === 'POST' && segments[0] === 'profiles' && segments[1] === 'lookup') {
      const ids = Array.isArray(body.ids)
        ? Array.from(new Set(body.ids.map((id) => String(id)).filter(Boolean)))
        : [];

      if (!ids.length) {
        return res.json({ ok: true, rows: [] });
      }

      const response = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.profiles,
        queries: [Query.limit(500)],
        total: false,
      });

      return res.json({
        ok: true,
        rows: response.rows.filter((row) => ids.includes(row.$id)),
      });
    }

    if (method === 'GET' && segments[0] === 'admin' && segments[1] === 'admins' && segments.length === 2) {
      requireSuperAdmin(actor);

      const response = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.adminProfiles,
        queries: [Query.limit(500)],
        total: false,
      });

      return res.json({ ok: true, admins: response.rows.toSorted(compareCreatedAtDesc) });
    }

    if (method === 'POST' && segments[0] === 'admin' && segments[1] === 'admins' && segments.length === 2) {
      requireSuperAdmin(actor);

      const missing = requireFields(body, ['email', 'displayName', 'role']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing admin profile fields.', { missing });
      }

      if (!['superAdmin', 'admin', 'organizer'].includes(body.role)) {
        return badRequest(res, 'Unsupported admin role.');
      }

      const email = String(body.email).trim().toLowerCase();
      const displayName = String(body.displayName).trim();
      const teamId = adminTeamForRole(body.role);
      const membership = await teams.createMembership({
        teamId,
        roles: [body.role],
        email: body.accountId ? undefined : email,
        userId: body.accountId || undefined,
        name: displayName,
      });

      const accountId = membership.userId || body.accountId;
      if (!accountId) {
        throw new HttpError(500, 'Admin membership was created without an account ID.');
      }

      const row = await tablesDB.createRow({
        databaseId,
        tableId: tableIds.adminProfiles,
        rowId: ID.unique(),
        data: cleanObject({
          accountId,
          email,
          displayName,
          role: body.role,
          status: 'active',
          teamId,
          membershipId: membership.$id,
          createdByAdminId: actor.$id,
          createdAt: new Date().toISOString(),
          notes: body.notes,
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'createAdminProfile',
        targetTable: tableIds.adminProfiles,
        targetRowId: row.$id,
        payload: { email, role: body.role, teamId },
      });

      return res.json({ ok: true, action: 'createAdminProfile', row });
    }

    if (method === 'POST' && segments[0] === 'admin' && segments[1] === 'admins' && segments[2] && segments[3] === 'status') {
      requireSuperAdmin(actor);

      const missing = requireFields(body, ['status']);
      if (missing.length > 0) {
        return badRequest(res, 'Missing admin status.', { missing });
      }

      if (!['active', 'suspended'].includes(body.status)) {
        return badRequest(res, 'Unsupported admin status.');
      }

      const target = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.adminProfiles,
        rowId: segments[2],
      });

      if (target.accountId === actor.accountId && body.status === 'suspended') {
        return badRequest(res, 'A super admin cannot suspend their own admin access.');
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.adminProfiles,
        rowId: segments[2],
        data: { status: body.status },
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'updateAdminStatus',
        targetTable: tableIds.adminProfiles,
        targetRowId: row.$id,
        payload: { email: target.email, status: body.status },
      });

      return res.json({ ok: true, action: 'updateAdminStatus', row });
    }

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
          createdByProfileId: actorProfileId(req, body, actor),
          createdAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
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
          liftedByProfileId: actorProfileId(req, body, actor),
          liftedAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
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
          createdByProfileId: actorProfileId(req, body, actor),
          createdAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
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
          liftedByProfileId: actorProfileId(req, body, actor),
          liftedAt: new Date().toISOString(),
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actorProfileId(req, body, actor),
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
          createdByProfileId: body.createdByProfileId ?? actor.$id,
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
          bracketSnapshot: body.bracketSnapshot,
        }),
      });

      return res.json({ ok: true, action: 'updateTournament', row });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments[1] && segments[2] === 'pairings' && segments[3] === 'publish') {
      const tournamentId = segments[1];
      const games = Array.isArray(body.games) ? body.games : [];
      const bracketSnapshot = normalizeBracketSnapshot(body.bracketSnapshot);
      if (games.length === 0) {
        return badRequest(res, 'No pairings were provided to publish.');
      }
      if (body.bracketSnapshot !== undefined && !bracketSnapshot) {
        return badRequest(res, 'Bracket snapshot must be valid published bracket JSON.');
      }

      const invalid = games.find((game) => (
        !Number.isInteger(Number(game.round)) ||
        !Number.isInteger(Number(game.board)) ||
        !game.whiteProfileId ||
        !game.blackProfileId ||
        game.whiteProfileId === game.blackProfileId
      ));
      if (invalid) {
        return badRequest(res, 'Published pairings must include round, board, whiteProfileId and blackProfileId.');
      }

      await tablesDB.getRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
      });

      const existing = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.games,
        queries: [Query.equal('tournamentId', tournamentId), Query.limit(500)],
        total: false,
      });

      for (const row of existing.rows) {
        await tablesDB.deleteRow({
          databaseId,
          tableId: tableIds.games,
          rowId: row.$id,
        });
      }

      const rows = [];
      for (const game of games) {
        const row = await tablesDB.createRow({
          databaseId,
          tableId: tableIds.games,
          rowId: ID.unique(),
          data: cleanObject({
            tournamentId,
            round: Number(game.round),
            board: Number(game.board),
            whiteProfileId: String(game.whiteProfileId),
            blackProfileId: String(game.blackProfileId),
            status: game.status && ['scheduled', 'live'].includes(game.status) ? game.status : 'scheduled',
            result: '*',
          }),
          permissions: [Permission.read(Role.any())],
        });
        rows.push(row);
      }

      await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
        data: { currentRound: 1, bracketSnapshot },
      }).catch(() => undefined);

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'publishTournamentPairings',
        targetTable: tableIds.tournaments,
        targetRowId: tournamentId,
        payload: { games: rows.length, bracketSnapshot: Boolean(bracketSnapshot) },
      });

      return res.json({ ok: true, action: 'publishTournamentPairings', rows });
    }

    if (method === 'POST' && segments[0] === 'tournaments' && segments[1] && segments[2] === 'pairings' && segments[3] === 'unpublish') {
      const tournamentId = segments[1];

      await tablesDB.getRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
      });

      const existing = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.games,
        queries: [Query.equal('tournamentId', tournamentId), Query.limit(500)],
        total: false,
      });

      for (const row of existing.rows) {
        await tablesDB.deleteRow({
          databaseId,
          tableId: tableIds.games,
          rowId: row.$id,
        });
      }

      await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
        data: { currentRound: null, bracketSnapshot: null },
      }).catch(() => undefined);

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'unpublishTournamentPairings',
        targetTable: tableIds.tournaments,
        targetRowId: tournamentId,
        payload: { games: existing.rows.length },
      });

      return res.json({ ok: true, action: 'unpublishTournamentPairings', deleted: existing.rows.length });
    }

    if (method === 'DELETE' && segments[0] === 'tournaments' && segments[1]) {
      await tablesDB.deleteRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: segments[1],
      });
      return res.json({ ok: true, action: 'deleteTournament', rowId: segments[1] });
    }

    if (
      method === 'POST' &&
      segments[0] === 'registrations' &&
      segments[1] &&
      ['confirm', 'status'].includes(segments[2])
    ) {
      if (body.status && !['pending', 'confirmed', 'waitlisted', 'cancelled'].includes(body.status)) {
        return badRequest(res, 'Unsupported registration status.');
      }

      const nextStatus = body.status ?? 'confirmed';
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.registrations,
        rowId: segments[1],
        data: cleanObject({
          status: nextStatus,
          seed: body.seed,
          checkedIn: nextStatus === 'cancelled' ? false : body.checkedIn,
        }),
      });

      await writeAudit(tablesDB, databaseId, {
        actorProfileId: actor.$id,
        action: 'updateRegistration',
        targetTable: tableIds.registrations,
        targetRowId: row.$id,
        payload: { status: nextStatus, seed: body.seed, checkedIn: nextStatus === 'cancelled' ? false : body.checkedIn },
      });

      return res.json({ ok: true, action: 'updateRegistration', row });
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
          createdByProfileId: body.createdByProfileId ?? actor.$id,
        }),
        permissions: [Permission.read(Role.any())],
      });

      return res.json({ ok: true, action: 'createAnnouncement', row });
    }

    return notFound(res, method, path);
  } catch (cause) {
    error(cause?.message ?? String(cause));
    if (cause instanceof HttpError) {
      return res.json({
        ok: false,
        error: cause.message,
      }, cause.statusCode);
    }

    return res.json({
      ok: false,
      error: 'Admin action failed.',
      detail: cause?.message ?? String(cause),
    }, 500);
  }
};
