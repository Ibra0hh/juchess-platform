import { createHash, randomBytes } from 'node:crypto';
import { Account, Client, Permission, Query, Role, TablesDB } from 'node-appwrite';

// Player-facing writes. Everything a signed-in student is allowed to change
// about their own registration goes through here, so the client can never pick
// its own approval status or profileId.

const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  checkIns: 'check_ins',
  attendance: 'attendance_confirmations',
  crewApplications: 'crew_applications',
};

const OPEN_TOURNAMENT_STATUSES = ['upcoming'];
export const CREW_INTERESTS = [
  'design',
  'software',
  'events',
  'media',
  'hr',
  'partnerships',
  'finance',
  'management',
];
const EDITABLE_APPLICATION_STATUSES = ['submitted', 'withdrawn', 'rejected'];
const WITHDRAWABLE_APPLICATION_STATUSES = ['submitted', 'reviewing', 'shortlisted', 'interview'];

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

  return selectCanonicalRegistration(response.rows);
}

export function registrationRowId(tournamentId, profileId) {
  const digest = createHash('sha256')
    .update(`${tournamentId}:${profileId}`)
    .digest('hex')
    .slice(0, 32);
  return `reg_${digest}`;
}

export function attendanceRowId(registrationId) {
  const digest = createHash('sha256').update(String(registrationId)).digest('hex').slice(0, 32);
  return `att_${digest}`;
}

export function crewApplicationRowId(profileId) {
  const digest = createHash('sha256').update(String(profileId)).digest('hex').slice(0, 32);
  return `crew_${digest}`;
}

export function validateCrewApplication(input = {}) {
  const interests = Array.from(new Set(
    (Array.isArray(input.interests) ? input.interests : [])
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => CREW_INTERESTS.includes(value)),
  )).slice(0, 5);
  const skills = cleanApplicationText(input.skills, 4000);
  const contribution = cleanApplicationText(input.contribution, 4000);
  const developmentGoals = cleanApplicationText(input.developmentGoals, 2000);
  const availability = cleanApplicationText(input.availability, 512);
  const portfolioUrl = cleanApplicationText(input.portfolioUrl, 1024);

  if (!interests.length) throw new HttpError(400, 'Choose at least one area you are interested in.');
  if (skills.length < 20) throw new HttpError(400, 'Tell us a little more about your skills.');
  if (contribution.length < 20) throw new HttpError(400, 'Tell us how you would contribute to JuChess.');
  if (!availability) throw new HttpError(400, 'Choose your weekly availability.');
  if (portfolioUrl && !isSafeHttpUrl(portfolioUrl)) {
    throw new HttpError(400, 'Portfolio links must start with http:// or https://.');
  }

  return { interests, skills, contribution, developmentGoals, availability, portfolioUrl };
}

function cleanApplicationText(value, maxLength) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n').slice(0, maxLength);
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function findCrewApplication(tablesDB, databaseId, profileId) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.crewApplications,
    queries: [Query.equal('profileId', profileId), Query.limit(1)],
    total: false,
    ttl: 0,
  });
  return response.rows[0] ?? null;
}

export function attendanceWindowState(startsAtValue, nowMs = Date.now()) {
  const startsAt = Date.parse(String(startsAtValue ?? ''));
  if (!Number.isFinite(startsAt)) return 'unscheduled';
  if (nowMs >= startsAt) return 'closed';
  if (nowMs < startsAt - (60 * 60 * 1000)) return 'early';
  return 'open';
}

async function findAttendance(tablesDB, databaseId, registrationId) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId: tableIds.attendance,
    queries: [Query.equal('registrationId', registrationId), Query.limit(1)],
    total: false,
  });
  return response.rows[0] ?? null;
}

async function ensureAttendance(tablesDB, databaseId, registration, accountId) {
  const existing = await findAttendance(tablesDB, databaseId, registration.$id);
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    return await tablesDB.createRow({
      databaseId,
      tableId: tableIds.attendance,
      rowId: attendanceRowId(registration.$id),
      data: {
        tournamentId: registration.tournamentId,
        profileId: registration.profileId,
        registrationId: registration.$id,
        accountId,
        status: 'pending',
        tokenNonce: randomBytes(16).toString('hex'),
        reminderEmailStatus: 'pending',
        reminderPushStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      },
      permissions: [Permission.read(Role.user(accountId))],
    });
  } catch (cause) {
    if (!isConflict(cause)) throw cause;
    const raced = await findAttendance(tablesDB, databaseId, registration.$id);
    if (!raced) throw cause;
    return raced;
  }
}

export function selectCanonicalRegistration(rows) {
  const statusRank = { confirmed: 4, waitlisted: 3, pending: 2, cancelled: 1 };
  return [...rows].sort((left, right) => (
    (statusRank[right.status] ?? 0) - (statusRank[left.status] ?? 0)
    || String(left.$createdAt ?? '').localeCompare(String(right.$createdAt ?? ''))
  ))[0] ?? null;
}

function isConflict(error) {
  return error?.code === 409 || error?.response?.code === 409;
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
      routes: [
        'POST /registrations',
        'POST /registrations/:id/cancel',
        'POST /registrations/:id/attendance',
        'GET /recruitment/application',
        'POST /recruitment/application',
        'POST /recruitment/application/withdraw',
      ],
    });
  }

  try {
    const { accountId, profile } = await requirePlayer(req, tablesDB, databaseId);

    if (segments[0] === 'recruitment' && segments[1] === 'application' && segments.length === 2) {
      if (method === 'GET') {
        const row = await findCrewApplication(tablesDB, databaseId, profile.$id);
        return res.json({ ok: true, action: 'loadCrewApplication', row });
      }

      if (method === 'POST') {
        const application = validateCrewApplication(body);
        const existing = await findCrewApplication(tablesDB, databaseId, profile.$id);
        if (existing && !EDITABLE_APPLICATION_STATUSES.includes(existing.status)) {
          throw new HttpError(409, 'This application is already being reviewed and can no longer be edited.');
        }

        const now = new Date().toISOString();
        const data = {
          ...application,
          status: 'submitted',
          submittedAt: now,
          updatedAt: now,
        };
        const row = existing
          ? await tablesDB.updateRow({
            databaseId,
            tableId: tableIds.crewApplications,
            rowId: existing.$id,
            data,
          })
          : await tablesDB.createRow({
            databaseId,
            tableId: tableIds.crewApplications,
            rowId: crewApplicationRowId(profile.$id),
            data: {
              profileId: profile.$id,
              accountId,
              ...data,
            },
            permissions: [Permission.read(Role.user(accountId))],
          });
        return res.json({ ok: true, action: existing ? 'resubmitCrewApplication' : 'submitCrewApplication', row });
      }
    }

    if (method === 'POST' && segments[0] === 'recruitment' && segments[1] === 'application' && segments[2] === 'withdraw') {
      const existing = await findCrewApplication(tablesDB, databaseId, profile.$id);
      if (!existing) throw new HttpError(404, 'No crew application was found for this account.');
      if (!WITHDRAWABLE_APPLICATION_STATUSES.includes(existing.status)) {
        throw new HttpError(409, 'This application can no longer be withdrawn.');
      }
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.crewApplications,
        rowId: existing.$id,
        data: { status: 'withdrawn', updatedAt: new Date().toISOString() },
      });
      return res.json({ ok: true, action: 'withdrawCrewApplication', row });
    }

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
      let row;
      if (existing) {
        row = await tablesDB.updateRow({
          databaseId,
          tableId: tableIds.registrations,
          rowId: existing.$id,
          data,
        });
      } else {
        try {
          row = await tablesDB.createRow({
            databaseId,
            tableId: tableIds.registrations,
            rowId: registrationRowId(tournamentId, profile.$id),
            data: { tournamentId, profileId: profile.$id, ...data },
            permissions: [Permission.read(Role.user(accountId))],
          });
        } catch (cause) {
          if (!isConflict(cause)) throw cause;
          row = await findRegistration(tablesDB, databaseId, tournamentId, profile.$id);
          if (!row) throw cause;
          return res.json({ ok: true, action: 'registerForTournament', row, unchanged: true });
        }
      }

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

      const attendance = await findAttendance(tablesDB, databaseId, registration.$id);
      if (attendance) {
        await tablesDB.deleteRow({ databaseId, tableId: tableIds.attendance, rowId: attendance.$id });
      }

      // Clean up an obsolete pass created by an older deployment.
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

    if (method === 'POST' && segments[0] === 'registrations' && segments[1] && segments[2] === 'attendance') {
      const status = String(body.status ?? '');
      if (!['confirmed', 'declined'].includes(status)) {
        return res.json({ ok: false, error: 'Choose Yes or No to answer the attendance question.' }, 400);
      }

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
        return res.json({ ok: false, error: 'You can answer only for your own registration.' }, 403);
      }
      if (registration.status !== 'confirmed') {
        return res.json({ ok: false, error: 'The organizer must accept this registration first.' }, 409);
      }

      const tournament = await tablesDB.getRow({
        databaseId,
        tableId: tableIds.tournaments,
        rowId: registration.tournamentId,
      });
      const attendance = await ensureAttendance(tablesDB, databaseId, registration, accountId);
      const windowState = attendanceWindowState(tournament.startsAt);
      if (windowState === 'unscheduled') {
        return res.json({ ok: false, error: 'The organizer has not scheduled the tournament start time yet.' }, 409);
      }
      if (windowState === 'closed') {
        return res.json({ ok: false, error: 'Attendance confirmation closed when the tournament started.' }, 409);
      }
      if (windowState === 'early' && !attendance.reminderSentAt) {
        return res.json({ ok: false, error: 'Attendance confirmation opens one hour before the tournament.' }, 409);
      }

      const now = new Date().toISOString();
      const row = await tablesDB.updateRow({
        databaseId,
        tableId: tableIds.attendance,
        rowId: attendance.$id,
        data: {
          status,
          respondedAt: now,
          responseSource: body.source === 'app' ? 'app' : 'web',
          updatedAt: now,
        },
      });
      return res.json({ ok: true, action: 'respondToAttendance', row });
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
