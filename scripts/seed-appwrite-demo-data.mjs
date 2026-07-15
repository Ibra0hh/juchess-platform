import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')

const endpoint = env('APPWRITE_ENDPOINT') || env('VITE_APPWRITE_ENDPOINT') || 'https://cloud.appwrite.io/v1'
const projectId = env('APPWRITE_PROJECT_ID') || env('VITE_APPWRITE_PROJECT_ID') || 'juchess-platform'
const databaseId = env('APPWRITE_DATABASE_ID') || env('VITE_APPWRITE_DATABASE_ID') || 'juchess'
const apiKey = env('APPWRITE_API_KEY')
const actorProfileId = env('APPWRITE_SEED_ACTOR_PROFILE_ID') || 'seed_profile_01'

const tableIds = {
  profiles: 'profiles',
  profilePrivate: 'profile_private',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
}

// Loaded before the row definitions below: they call Permission/Role while the
// module body evaluates, so these bindings must already be initialized.
const { Client, Permission, Query, Role, TablesDB } = await loadAppwriteSdk()

const players = [
  player('seed_profile_01', 'Ibrahim Ahmad', 'ibrahim_ju', 'ibrahim.seed@juchess.test', 1810, '+962790000001'),
  player('seed_profile_02', 'Omar Saleh', 'omar_saleh', 'omar.seed@juchess.test', 1740, '+962790000002'),
  player('seed_profile_03', 'Leen Haddad', 'leenh', 'leen.seed@juchess.test', 1685, '+962790000003'),
  player('seed_profile_04', 'Yazan Khaled', 'ykhaled', 'yazan.seed@juchess.test', 1602, '+962790000004'),
  player('seed_profile_05', 'Sara Nasser', 'sara_n', 'sara.seed@juchess.test', 1550, '+962790000005'),
  player('seed_profile_06', 'Mohammad Al-Khatib', 'mohammad_ak', 'mohammad.seed@juchess.test', 1490, '+962790000006'),
  player('seed_profile_07', 'Rania Odeh', 'rania_o', 'rania.seed@juchess.test', 1465, '+962790000007'),
  player('seed_profile_08', 'Khaled Mansour', 'kmansour', 'khaled.seed@juchess.test', 1430, '+962790000008'),
  player('seed_profile_09', 'Tala Suleiman', 'tala_s', 'tala.seed@juchess.test', 1395, '+962790000009'),
  player('seed_profile_10', 'Hasan Qasem', 'hqasem', 'hasan.seed@juchess.test', 1370, '+962790000010'),
  player('seed_profile_11', 'Noor Barakat', 'noorb', 'noor.seed@juchess.test', 1340, '+962790000011'),
  player('seed_profile_12', 'Zaid Hamdan', 'zhamdan', 'zaid.seed@juchess.test', 1310, '+962790000012'),
  player('seed_profile_13', 'Amr Zaidan', 'amr_zaidan', 'amr.seed@juchess.test', 1295, '+962790000013'),
  player('seed_profile_14', 'Lina Shami', 'lina_shami', 'lina.seed@juchess.test', 1270, '+962790000014'),
  player('seed_profile_15', 'Fadi Rimawi', 'fadi_rimawi', 'fadi.seed@juchess.test', 1245, '+962790000015'),
  player('seed_profile_16', 'Dana Aqel', 'dana_aqel', 'dana.seed@juchess.test', 1220, '+962790000016'),
  player('seed_profile_17', 'Nour Alami', 'nour_alami', 'nour.seed@juchess.test', 1198, '+962790000017'),
  player('seed_profile_18', 'Tamer Qasem', 'tamer_qasem', 'tamer.seed@juchess.test', 1184, '+962790000018'),
  player('seed_profile_19', 'Salma Nouri', 'salma_nouri', 'salma.seed@juchess.test', 1166, '+962790000019'),
  player('seed_profile_20', 'Adam Kareem', 'adam_kareem', 'adam.seed@juchess.test', 1148, '+962790000020'),
]

const privatePlayers = players.map((profile) => profile.privateRow)

const tournamentPlayerCounts = {
  seed_tour_swiss: 6,
  seed_tour_completed: 16,
  seed_tour_double_round_robin: 18,
  seed_tour_knockout: 16,
  seed_tour_double_elim: 20,
  seed_tour_multistage: 18,
  seed_tour_team: 16,
  seed_tour_arena: 20,
}

const tournaments = [
  tournament('seed_tour_swiss', {
    slug: 'swiss',
    name: 'Swiss',
    status: 'upcoming',
    format: 'Swiss',
    timeControl: '15+10 Rapid',
    roundsTotal: 4,
    currentRound: null,
    startsAt: '2026-07-20T13:00:00.000Z',
    endsAt: '2026-08-10T17:00:00.000Z',
    location: 'Student Union Hall B',
    capacity: tournamentPlayerCounts.seed_tour_swiss,
    description: 'Swiss test tournament.',
  }),
  tournament('seed_tour_completed', {
    slug: 'round-robin',
    name: 'Round robin',
    status: 'upcoming',
    format: 'Round robin',
    timeControl: '10+5 Rapid',
    roundsTotal: 15,
    currentRound: null,
    startsAt: '2026-07-22T13:00:00.000Z',
    endsAt: '2026-08-05T17:00:00.000Z',
    location: 'Engineering Lounge',
    capacity: tournamentPlayerCounts.seed_tour_completed,
    description: 'Round robin test tournament.',
  }),
  tournament('seed_tour_double_round_robin', {
    slug: 'double-round-robin',
    name: 'Double round robin',
    status: 'upcoming',
    format: 'Double round robin',
    timeControl: '25+10 Classical',
    roundsTotal: 34,
    currentRound: null,
    startsAt: '2026-07-24T13:00:00.000Z',
    endsAt: '2026-08-21T17:00:00.000Z',
    location: 'Library Seminar Room 2',
    capacity: tournamentPlayerCounts.seed_tour_double_round_robin,
    description: 'Double round robin test tournament.',
  }),
  tournament('seed_tour_knockout', {
    slug: 'single-elimination',
    name: 'Single elimination',
    status: 'upcoming',
    format: 'Single elimination',
    timeControl: '10+0 Blitz',
    roundsTotal: 4,
    currentRound: null,
    startsAt: '2026-07-26T15:00:00.000Z',
    endsAt: '2026-08-02T18:00:00.000Z',
    location: 'Hall A',
    capacity: tournamentPlayerCounts.seed_tour_knockout,
    description: 'Single elimination test tournament.',
  }),
  tournament('seed_tour_double_elim', {
    slug: 'double-elimination',
    name: 'Double elimination',
    status: 'upcoming',
    format: 'Double elimination',
    timeControl: '5+3 Blitz',
    roundsTotal: 14,
    currentRound: null,
    startsAt: '2026-07-28T15:00:00.000Z',
    endsAt: '2026-08-08T18:00:00.000Z',
    location: 'Hall A',
    capacity: tournamentPlayerCounts.seed_tour_double_elim,
    description: 'Double elimination test tournament.',
  }),
  tournament('seed_tour_multistage', {
    slug: 'multi-stage',
    name: 'Multi-stage',
    status: 'upcoming',
    format: 'Multi-stage',
    timeControl: '10+5 Rapid',
    roundsTotal: 5,
    currentRound: null,
    startsAt: '2026-07-30T14:00:00.000Z',
    endsAt: '2026-08-20T18:00:00.000Z',
    location: 'Library Seminar Room 2',
    capacity: tournamentPlayerCounts.seed_tour_multistage,
    description: 'Multi-stage test tournament.',
  }),
  tournament('seed_tour_team', {
    slug: 'team',
    name: 'Team',
    status: 'upcoming',
    format: 'Team',
    timeControl: '10+0 Rapid',
    roundsTotal: 3,
    currentRound: null,
    startsAt: '2026-08-01T13:00:00.000Z',
    endsAt: '2026-08-15T17:00:00.000Z',
    location: 'Hall A',
    capacity: tournamentPlayerCounts.seed_tour_team,
    description: 'Team test tournament.',
  }),
  tournament('seed_tour_arena', {
    slug: 'arena',
    name: 'Arena',
    status: 'upcoming',
    format: 'Arena',
    timeControl: '5+0 Blitz',
    roundsTotal: 1,
    currentRound: null,
    startsAt: '2026-08-03T15:00:00.000Z',
    endsAt: '2026-08-03T17:00:00.000Z',
    location: 'Club Room',
    capacity: tournamentPlayerCounts.seed_tour_arena,
    description: 'Arena test tournament.',
  }),
]

const registrations = [
  ...registrationsFor('swiss', 'seed_tour_swiss', players.slice(0, tournamentPlayerCounts.seed_tour_swiss)),
  ...registrationsFor('winter', 'seed_tour_completed', players.slice(0, tournamentPlayerCounts.seed_tour_completed)),
  ...registrationsFor('drr', 'seed_tour_double_round_robin', players.slice(0, tournamentPlayerCounts.seed_tour_double_round_robin)),
  ...registrationsFor('ko', 'seed_tour_knockout', players.slice(0, tournamentPlayerCounts.seed_tour_knockout)),
  ...registrationsFor('de', 'seed_tour_double_elim', players.slice(0, tournamentPlayerCounts.seed_tour_double_elim)),
  ...registrationsFor('multi', 'seed_tour_multistage', players.slice(0, tournamentPlayerCounts.seed_tour_multistage)),
  ...registrationsFor('team', 'seed_tour_team', players.slice(0, tournamentPlayerCounts.seed_tour_team)),
  ...registrationsFor('arena', 'seed_tour_arena', players.slice(0, tournamentPlayerCounts.seed_tour_arena)),
]

const games = []

const standings = [
  ...standingsFor('swiss', 'seed_tour_swiss', players.slice(0, tournamentPlayerCounts.seed_tour_swiss)),
  ...standingsFor('rr', 'seed_tour_completed', players.slice(0, tournamentPlayerCounts.seed_tour_completed)),
  ...standingsFor('drr', 'seed_tour_double_round_robin', players.slice(0, tournamentPlayerCounts.seed_tour_double_round_robin)),
  ...standingsFor('ko', 'seed_tour_knockout', players.slice(0, tournamentPlayerCounts.seed_tour_knockout)),
  ...standingsFor('de', 'seed_tour_double_elim', players.slice(0, tournamentPlayerCounts.seed_tour_double_elim)),
  ...standingsFor('multi', 'seed_tour_multistage', players.slice(0, tournamentPlayerCounts.seed_tour_multistage)),
  ...standingsFor('team', 'seed_tour_team', players.slice(0, tournamentPlayerCounts.seed_tour_team)),
  ...standingsFor('arena', 'seed_tour_arena', players.slice(0, tournamentPlayerCounts.seed_tour_arena)),
]

const seededTournamentIds = tournaments.map((row) => row.rowId)

const deprecatedRows = [
  [tableIds.tournaments, 'seed_tour_league'],
  [tableIds.games, 'seed_game_league_01'],
  [tableIds.games, 'seed_game_ko_r16_01'],
  [tableIds.games, 'seed_game_ko_r16_02'],
  [tableIds.games, 'seed_game_ko_qf_01'],
  [tableIds.games, 'seed_game_ko_qf_02'],
  [tableIds.games, 'seed_game_swiss_r4_01'],
  [tableIds.games, 'seed_game_swiss_r4_02'],
  [tableIds.games, 'seed_game_multi_s2_01'],
  [tableIds.games, 'seed_game_swiss_r1_01'],
  [tableIds.games, 'seed_game_swiss_r1_02'],
  [tableIds.games, 'seed_game_rr_01'],
  [tableIds.games, 'seed_game_drr_01'],
  [tableIds.games, 'seed_game_ko_r1_01'],
  [tableIds.games, 'seed_game_ko_r1_02'],
  [tableIds.games, 'seed_game_de_r1_01'],
  [tableIds.games, 'seed_game_multi_s1_01'],
  [tableIds.games, 'seed_game_team_01'],
  [tableIds.games, 'seed_game_arena_01'],
  [tableIds.standings, 'seed_std_league_01'],
  ...Array.from({ length: 8 }, (_, index) => [
    tableIds.registrations,
    `seed_reg_league_${String(index + 1).padStart(2, '0')}`,
  ]),
]

const deprecatedTournamentRowIds = [
  'championship',
  'ju-blitz-knockout',
  'summer-bullet-arena',
  'masters-six',
  'winter-classical-2026',
]

const announcements = [
  {
    rowId: 'seed_announcement_01',
    data: {
      title: 'Seeded club data is live',
      body: 'This announcement was inserted through the Appwrite seed script and uses the real announcements table.',
      audience: 'public',
      status: 'published',
      publishedAt: '2026-07-08T12:00:00.000Z',
      createdByProfileId: actorProfileId,
    },
    permissions: [Permission.read(Role.any())],
  },
]

const plan = [
  [tableIds.profiles, players],
  [tableIds.profilePrivate, privatePlayers, 'profileId'],
  [tableIds.tournaments, tournaments, 'slug'],
  [tableIds.registrations, registrations],
  [tableIds.games, games],
  [tableIds.standings, standings],
  [tableIds.announcements, announcements],
]

if (dryRun) {
  printPlan()
  process.exit(0)
}

if (!apiKey) {
  console.error('APPWRITE_API_KEY is required to seed real Appwrite data. Run with --dry-run to inspect the payload.')
  process.exit(1)
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const tablesDB = new TablesDB(client)

for (const tournamentId of seededTournamentIds) {
  for (const tableId of [tableIds.registrations, tableIds.games, tableIds.standings]) {
    await deleteRowsByTournament(tableId, tournamentId)
  }
}

for (const [tableId, rows, uniqueField] of plan) {
  for (const row of rows) {
    const written = await upsertRow(tableId, row, uniqueField)
    console.log(`${written.action} ${tableId}/${written.rowId}`)
  }
}

for (const [tableId, rowId] of deprecatedRows) {
  await deleteRowIfExists(tableId, rowId)
}

for (const rowId of deprecatedTournamentRowIds) {
  await deleteTournamentTree(rowId)
}

console.log('Seed complete.')

async function upsertRow(tableId, row, uniqueField) {
  const existingRowId = await findExistingRowId(tableId, row, uniqueField)
  if (existingRowId) {
    await tablesDB.updateRow({
      databaseId,
      tableId,
      rowId: existingRowId,
      data: row.data,
      permissions: row.permissions,
    })
    return { action: 'updated', rowId: existingRowId }
  }

  await tablesDB.createRow({
    databaseId,
    tableId,
    rowId: row.rowId,
    data: row.data,
    permissions: row.permissions,
  })
  return { action: 'created', rowId: row.rowId }
}

async function findExistingRowId(tableId, row, uniqueField) {
  try {
    const existing = await tablesDB.getRow({
      databaseId,
      tableId,
      rowId: row.rowId,
    })
    return existing.$id
  } catch (error) {
    if (!isMissingRow(error)) throw error
  }

  if (!uniqueField || row.data[uniqueField] === undefined) return null

  const response = await tablesDB.listRows({
    databaseId,
    tableId,
    queries: [Query.equal(uniqueField, row.data[uniqueField]), Query.limit(1)],
    total: false,
  })

  return response.rows[0]?.$id ?? null
}

async function deleteRowIfExists(tableId, rowId) {
  try {
    await tablesDB.deleteRow({ databaseId, tableId, rowId })
    console.log(`deleted ${tableId}/${rowId}`)
  } catch (error) {
    if (!isMissingRow(error)) throw error
  }
}

async function deleteTournamentTree(tournamentId) {
  for (const tableId of [tableIds.registrations, tableIds.games, tableIds.standings]) {
    await deleteRowsByTournament(tableId, tournamentId)
  }

  await deleteRowIfExists(tableIds.tournaments, tournamentId)
}

async function deleteRowsByTournament(tableId, tournamentId) {
  const response = await tablesDB.listRows({
    databaseId,
    tableId,
    queries: [Query.equal('tournamentId', tournamentId), Query.limit(500)],
    total: false,
  })

  for (const row of response.rows) {
    await deleteRowIfExists(tableId, row.$id)
  }
}

async function loadAppwriteSdk() {
  try {
    return await import('node-appwrite')
  } catch {
    const localSdkPath = path.join(
      repoRoot,
      'appwrite',
      'functions',
      'admin-actions',
      'node_modules',
      'node-appwrite',
      'dist',
      'index.mjs',
    )

    if (!existsSync(localSdkPath)) {
      throw new Error('node-appwrite is not installed. Run npm install inside appwrite/functions/admin-actions first.')
    }

    return import(pathToFileURL(localSdkPath).href)
  }
}

function player(rowId, displayName, universityId, email, rating, phone) {
  const accountId = `${rowId}_account`
  return {
    rowId,
    data: {
      displayName,
      university: 'University of Jordan',
      rating,
      role: 'member',
      status: 'active',
    },
    permissions: [Permission.read(Role.any())],
    privateRow: {
      rowId,
      data: {
        profileId: rowId,
        accountId,
        email,
        universityId,
        phone,
      },
      permissions: [Permission.read(Role.user(accountId))],
    },
  }
}

function tournament(rowId, data) {
  return {
    rowId,
    data: {
      ...data,
      createdByProfileId: actorProfileId,
    },
  }
}

function registrationsFor(prefix, tournamentId, profileRows, status = 'confirmed') {
  return profileRows.map((profileRow, index) => ({
    rowId: `seed_reg_${prefix}_${String(index + 1).padStart(2, '0')}`,
    data: {
      tournamentId,
      profileId: profileRow.rowId,
      status,
      seed: index + 1,
      // Legacy fields stay empty. Attendance lives in a private confirmation
      // row and is never inferred from public registration data.
      checkInCode: null,
      checkedIn: false,
    },
  }))
}

function standingsFor(prefix, tournamentId, profileRows) {
  return profileRows.map((profileRow, index) => (
    standing(
      `seed_std_${prefix}_${String(index + 1).padStart(2, '0')}`,
      tournamentId,
      profileRow.rowId,
      index + 1,
      0,
      0,
      0,
      0,
      0,
      0,
    )
  ))
}

function game(rowId, tournamentId, round, board, whiteProfileId, blackProfileId, status, result, pgn) {
  return {
    rowId,
    data: clean({
      tournamentId,
      round,
      board,
      whiteProfileId,
      blackProfileId,
      status,
      result,
      pgn,
      startedAt: status === 'scheduled' ? undefined : '2026-07-08T12:00:00.000Z',
      finishedAt: status === 'completed' ? '2026-07-08T13:00:00.000Z' : undefined,
    }),
    permissions: [Permission.read(Role.any())],
  }
}

function standing(rowId, tournamentId, profileId, rank, points, tieBreak, played, wins, draws, losses) {
  return {
    rowId,
    data: {
      tournamentId,
      profileId,
      rank,
      points,
      tieBreak,
      played,
      wins,
      draws,
      losses,
    },
  }
}

function clean(value) {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined))
}

function env(name) {
  return process.env[name]?.trim()
}

function isMissingRow(error) {
  return error?.code === 404 || /not found/i.test(String(error?.message ?? error))
}

function printPlan() {
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Project: ${projectId}`)
  console.log(`Database: ${databaseId}`)
  for (const [tableId, rows] of plan) {
    console.log(`${tableId}: ${rows.length} rows`)
  }
}
