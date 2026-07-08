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
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
}

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
]

const tournaments = [
  tournament('seed_tour_knockout', {
    slug: 'single-elimination',
    name: 'Single elimination',
    status: 'active',
    format: 'Single elimination',
    timeControl: '10+0 Blitz',
    roundsTotal: 4,
    currentRound: 3,
    startsAt: '2026-07-01T15:00:00.000Z',
    endsAt: '2026-07-10T18:00:00.000Z',
    location: 'Hall A',
    capacity: 16,
    description: 'Single elimination test tournament.',
  }),
  tournament('seed_tour_double_elim', {
    slug: 'double-elimination',
    name: 'Double elimination',
    status: 'active',
    format: 'Double elimination',
    timeControl: '5+3 Blitz',
    roundsTotal: 6,
    currentRound: 5,
    startsAt: '2026-07-03T15:00:00.000Z',
    endsAt: '2026-07-10T18:00:00.000Z',
    location: 'Hall A',
    capacity: 16,
    description: 'Double elimination test tournament.',
  }),
  tournament('seed_tour_swiss', {
    slug: 'swiss',
    name: 'Swiss',
    status: 'active',
    format: 'Swiss',
    timeControl: '15+10 Rapid',
    roundsTotal: 7,
    currentRound: 4,
    startsAt: '2026-06-14T13:00:00.000Z',
    endsAt: '2026-07-12T17:00:00.000Z',
    location: 'Student Union Hall B',
    capacity: 32,
    description: 'Swiss test tournament.',
  }),
  tournament('seed_tour_arena', {
    slug: 'arena',
    name: 'Arena',
    status: 'active',
    format: 'Arena',
    timeControl: '5+0 Blitz',
    roundsTotal: 1,
    currentRound: 1,
    startsAt: '2026-07-03T15:00:00.000Z',
    endsAt: '2026-07-03T17:00:00.000Z',
    location: 'Club Room',
    capacity: 48,
    description: 'Arena test tournament.',
  }),
  tournament('seed_tour_multistage', {
    slug: 'multi-stage',
    name: 'Multi-stage',
    status: 'active',
    format: 'Multi-stage',
    timeControl: '10+5 Rapid',
    roundsTotal: 5,
    currentRound: 3,
    startsAt: '2026-07-05T14:00:00.000Z',
    endsAt: '2026-07-25T18:00:00.000Z',
    location: 'Library Seminar Room 2',
    capacity: 24,
    description: 'Stage one pool play followed by a stage two playoff bracket.',
  }),
  tournament('seed_tour_completed', {
    slug: 'round-robin',
    name: 'Round robin',
    status: 'active',
    format: 'Round robin',
    timeControl: '25+10 Rapid',
    roundsTotal: 5,
    currentRound: 5,
    startsAt: '2026-07-05T13:00:00.000Z',
    endsAt: '2026-07-19T17:00:00.000Z',
    location: 'Library Seminar Room 2',
    capacity: 12,
    description: 'Round robin test tournament.',
  }),
  tournament('seed_tour_double_round_robin', {
    slug: 'double-round-robin',
    name: 'Double round robin',
    status: 'active',
    format: 'Double round robin',
    timeControl: '90+30 Classical',
    roundsTotal: 10,
    currentRound: 1,
    startsAt: '2026-07-12T13:00:00.000Z',
    endsAt: '2026-07-30T17:00:00.000Z',
    location: 'Library Seminar Room 2',
    capacity: 6,
    description: 'Double round robin test tournament.',
  }),
  tournament('seed_tour_league', {
    slug: 'league',
    name: 'League',
    status: 'active',
    format: 'League',
    timeControl: '10+5 Rapid',
    roundsTotal: 7,
    currentRound: 4,
    startsAt: '2026-07-02T13:00:00.000Z',
    endsAt: '2026-08-20T17:00:00.000Z',
    location: 'Hall B',
    capacity: 8,
    description: 'League test tournament.',
  }),
  tournament('seed_tour_team', {
    slug: 'team',
    name: 'Team',
    status: 'active',
    format: 'Team',
    timeControl: '10+0 Rapid',
    roundsTotal: 3,
    currentRound: 2,
    startsAt: '2026-07-09T13:00:00.000Z',
    endsAt: '2026-07-23T17:00:00.000Z',
    location: 'Hall A',
    capacity: 16,
    description: 'Team test tournament.',
  }),
]

const registrations = [
  ...registrationsFor('ko', 'seed_tour_knockout', players.slice(0, 16)),
  ...registrationsFor('de', 'seed_tour_double_elim', players.slice(0, 12)),
  ...registrationsFor('swiss', 'seed_tour_swiss', players.slice(0, 12)),
  ...registrationsFor('arena', 'seed_tour_arena', players.slice(0, 10)),
  ...registrationsFor('multi', 'seed_tour_multistage', players.slice(0, 16)),
  ...registrationsFor('winter', 'seed_tour_completed', players.slice(0, 12)),
  ...registrationsFor('drr', 'seed_tour_double_round_robin', players.slice(0, 6)),
  ...registrationsFor('league', 'seed_tour_league', players.slice(0, 8)),
  ...registrationsFor('team', 'seed_tour_team', players.slice(0, 16)),
]

const games = [
  game('seed_game_ko_r16_01', 'seed_tour_knockout', 1, 1, 'seed_profile_01', 'seed_profile_12', 'completed', '1-0', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0'),
  game('seed_game_ko_r16_02', 'seed_tour_knockout', 1, 2, 'seed_profile_10', 'seed_profile_05', 'completed', '0-1', '1. d4 d5 2. c4 e6 3. Nc3 Nf6 0-1'),
  game('seed_game_ko_qf_01', 'seed_tour_knockout', 2, 1, 'seed_profile_01', 'seed_profile_05', 'live', '*', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *'),
  game('seed_game_ko_qf_02', 'seed_tour_knockout', 2, 2, 'seed_profile_03', 'seed_profile_04', 'scheduled', '*', ''),
  game('seed_game_swiss_r4_01', 'seed_tour_swiss', 4, 1, 'seed_profile_01', 'seed_profile_02', 'live', '*', '1. d4 Nf6 2. c4 e6 *'),
  game('seed_game_swiss_r4_02', 'seed_tour_swiss', 4, 2, 'seed_profile_03', 'seed_profile_04', 'scheduled', '*', ''),
  game('seed_game_multi_s2_01', 'seed_tour_multistage', 3, 1, 'seed_profile_01', 'seed_profile_07', 'live', '*', '1. c4 e5 2. Nc3 Nf6 *'),
  game('seed_game_arena_01', 'seed_tour_arena', 1, 1, 'seed_profile_08', 'seed_profile_09', 'scheduled', '*', ''),
  game('seed_game_rr_01', 'seed_tour_completed', 5, 1, 'seed_profile_02', 'seed_profile_03', 'completed', '1/2-1/2', '1. Nf3 d5 2. g3 c5 1/2-1/2'),
  game('seed_game_drr_01', 'seed_tour_double_round_robin', 1, 1, 'seed_profile_01', 'seed_profile_06', 'scheduled', '*', ''),
  game('seed_game_league_01', 'seed_tour_league', 4, 1, 'seed_profile_02', 'seed_profile_08', 'live', '*', '1. e4 c5 2. Nf3 d6 *'),
  game('seed_game_team_01', 'seed_tour_team', 2, 1, 'seed_profile_01', 'seed_profile_09', 'live', '*', '1. d4 d5 2. c4 c6 *'),
]

const standings = [
  standing('seed_std_swiss_01', 'seed_tour_swiss', 'seed_profile_01', 1, 3.5, 12.5, 4, 3, 1, 0),
  standing('seed_std_swiss_02', 'seed_tour_swiss', 'seed_profile_03', 2, 3, 11, 4, 3, 0, 1),
  standing('seed_std_swiss_03', 'seed_tour_swiss', 'seed_profile_02', 3, 2.5, 10.5, 4, 2, 1, 1),
  standing('seed_std_arena_01', 'seed_tour_arena', 'seed_profile_08', 1, 0, 0, 0, 0, 0, 0),
  standing('seed_std_multi_01', 'seed_tour_multistage', 'seed_profile_01', 1, 4, 15, 5, 4, 0, 1),
  standing('seed_std_multi_02', 'seed_tour_multistage', 'seed_profile_07', 2, 3.5, 13.5, 5, 3, 1, 1),
  standing('seed_std_rr_01', 'seed_tour_completed', 'seed_profile_02', 1, 4, 12, 5, 4, 0, 1),
  standing('seed_std_drr_01', 'seed_tour_double_round_robin', 'seed_profile_01', 1, 0, 0, 0, 0, 0, 0),
  standing('seed_std_league_01', 'seed_tour_league', 'seed_profile_02', 1, 9, 14, 4, 3, 0, 1),
  standing('seed_std_team_01', 'seed_tour_team', 'seed_profile_01', 1, 6, 10, 2, 2, 0, 0),
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
  },
]

const plan = [
  [tableIds.profiles, players, 'accountId'],
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

const { Client, Query, TablesDB } = await loadAppwriteSdk()
const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const tablesDB = new TablesDB(client)

for (const [tableId, rows, uniqueField] of plan) {
  for (const row of rows) {
    const written = await upsertRow(tableId, row, uniqueField)
    console.log(`${written.action} ${tableId}/${written.rowId}`)
  }
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
    })
    return { action: 'updated', rowId: existingRowId }
  }

  await tablesDB.createRow({
    databaseId,
    tableId,
    rowId: row.rowId,
    data: row.data,
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
  return {
    rowId,
    data: {
      accountId: `${rowId}_account`,
      displayName,
      universityId,
      email,
      phone,
      rating,
      role: 'member',
      status: 'active',
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
      checkInCode: `${prefix.toUpperCase()}${String(index + 1).padStart(2, '0')}`,
      checkedIn: status === 'confirmed',
    },
  }))
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
