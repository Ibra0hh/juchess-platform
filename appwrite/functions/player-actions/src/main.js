import { Account, Client, ID, Permission, Query, Role, TablesDB } from 'node-appwrite';

// Player-facing writes. Everything a signed-in student is allowed to change
// about their own registration goes through here, so the client can never pick
// its own status, profileId, or check-in code.

const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  checkIns: 'check_ins',
};

const OPEN_TOURNAMENT_STATUSES = ['upcoming', 'active'];

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
    // Appwrite's bodyJson getter throws when the request carries no JSON body.
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

async function requirePlayer(req, tablesDB, databaseId) {
  const jwt = req.headers['juchess-player-jwt'] || req.headers['x-appwrite-user-jwt'];
  if (!jwt) throw new HttpError(401, 'Sign in to manage your registration.');

  const userClient = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);

  let accountId;
  try {
    const user = await new Account(userClient).get();
    accountId = user.$id;
  } catch {
    throw new HttpError(401, 'Sign in to manage your registration.');
  }

  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.profiles,
    queries: [Query.equal('accountId', accountId), Query.limit(1)],
    total: false,
  });

  const profile = response.rows[0];
  if (!profile) throw new HttpError(403, 'No club profile exists for this account.');
  if (profile.status === 'suspended') throw new HttpError(403, 'This account is blocked by club administration.');

  return { accountId, profile };
}

async function findRegistration(tablesDB, databaseId, tournamentId, profileId) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.registrations,
    queries: [
      Query.equal('tournamentId', tournamentId),
      Query.equal('profileId', profileId),
      Query.limit(10),
    ],
    total: false,
  });

  return response.rows.find((row) => row.status !== 'cancelled') ?? response.rows[0] ?? null;
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

  log(`JuChess player action ${method} ${path}`);

  if (method === 'GET' && segments.length === 0) {
    return res.json({
      ok: true,
      service: 'juchess-player-actions',
      routes: ['POST /registrations', 'POST /registrations/:id/cancel'],
    });
  }

  try {
    const { accountId, profile } = await requirePlayer(req, tablesDB, databaseId);

    // Register for a tournament. The server decides profileId and status.
    if (method === 'POST' && segments[0] === 'registrations' && segments.length === 1) {
      const tournamentId = String(body.tournamentId ?? '').trim();
      if (!tournamentId) return res.json({ ok: false, error: 'A tournament is required.' }, 400);

      let tournament;
      try {
        tournament = await tablesDB.getRow({
          databaseId,
          tableId: tableIds.tournaments,
          rowId: tournamentId,
        });
      } catch {
        return res.json({ ok: false, error: 'That tournament does not exist.' }, 404);
      }

      if (!OPEN_TOURNAMENT_STATUSES.includes(tournament.status)) {
        return res.json({ ok: false, error: 'Registration is closed for this tournament.' }, 400);
      }

      const existing = await findRegistration(tablesDB, databaseId, tournamentId, profile.$id);
      if (existing && existing.status !== 'cancelled') {
        return res.json({ ok: true, action: 'registerForTournament', row: existing, unchanged: true });
      }

      const data = { status: 'pending', checkedIn: false };
      const row = existing
        ? await tablesDB.updateRow({
          databaseId,
          tableId: tableIds.registrations,
          rowId: existing.$id,
          data,
        })
        : await tablesDB.createRow({
          databaseId,
          tableId: tableIds.registrations,
          rowId: ID.unique(),
          data: { tournamentId, profileId: profile.$id, ...data },
          permissions: [Permission.read(Role.user(accountId))],
        });

      return res.json({ ok: true, action: 'registerForTournament', row });
    }

    // Cancel your own registration. Ownership is checked server-side.
    if (method === 'POST' && segments[0] === 'registrations' && segments[1] && segments[2] === 'cancel') {
      let registration;
      try {
        registration = await tablesDB.getRow({
          databaseId,
          tableId: tableIds.registrations,
          rowId: segments[1],
        });
      } catch {
        return res.json({ ok: false, error: 'That registration does not exist.' }, 404);
      }

      if (registration.profileId !== profile.$id) {
        return res.json({ ok: false, error: 'You can only cancel your own registration.' }, 403);
      }

      // Once the event starts, pairings and brackets are frozen around this
      // player. Withdrawing must go through an organizer, who can award the
      // forfeits the schedule needs.
      try {
        const tournament = await tablesDB.getRow({
          databaseId,
          tableId: tableIds.tournaments,
          rowId: registration.tournamentId,
        });
        if (tournament.status !== 'upcoming') {
          return res.json({
            ok: false,
            error: 'This tournament has already started. Ask an organizer to withdraw you.',
          }, 400);
        }
      } catch {
        // A missing tournament row should not trap the player in a dead event.
      }

      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.registrations,
        rowId: registration.$id,
        data: { status: 'cancelled', checkedIn: false },
      });

      // A cancelled player must not keep a usable check-in pass.
      const codes = await tablesDB.listRows({
        databaseId,
        tableId: tableIds.checkIns,
        queries: [
          Query.equal('tournamentId', registration.tournamentId),
          Query.equal('profileId', profile.$id),
          Query.limit(10),
        ],
        total: false,
      });
      for (const code of codes.rows) {
        await tablesDB.deleteRow({ databaseId, tableId: tableIds.checkIns, rowId: code.$id });
      }

      return res.json({ ok: true, action: 'cancelRegistration', row });
    }

    return res.json({ ok: false, error: `No player action for ${method} ${path}` }, 404);
  } catch (caught) {
    if (caught instanceof HttpError) {
      return res.json({ ok: false, error: caught.message }, caught.statusCode);
    }
    error(`JuChess player action failed: ${caught.message}`);
    return res.json({ ok: false, error: 'Something went wrong. Please try again.' }, 500);
  }
};
