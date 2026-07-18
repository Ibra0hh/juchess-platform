// Tests for the pure tournament-engine functions inside admin-actions.
//
// `src/main.js` is an Appwrite function: it imports node-appwrite at module
// scope and default-exports a request handler. To test the pure logic without a
// live Appwrite, we read the source, swap the SDK import for inert stubs, append
// an export list, and import the rewritten module from a temp file.
//
// Run: npm test  (inside appwrite/functions/admin-actions)
import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { Chess } from 'chess.js'

const here = dirname(fileURLToPath(import.meta.url))

const EXPORTED = [
  'bracketSizeFor',
  'bracketStageName',
  'openingKnockoutPairs',
  'buildKnockoutStructure',
  'knockoutGameRoundMap',
  'knockoutResolver',
  'buildSwissPairings',
  'balancePairingColors',
  'buildRoundRobinSchedule',
  'splitSeededPairings',
  'buildKnockoutSnapshot',
  'seededKnockoutOrder',
  'publishedParticipantIds',
  'assertPublishedParticipantSet',
  'swissRoundsTotal',
  'validateTournamentRoundCount',
  'validateTournamentPlayMode',
  'validateTournamentOnlinePlatform',
  'isJuChessHostedTournament',
  'parseHostedTimeControl',
  'hostedTimeClass',
  'firstMoveGraceMs',
  'isTournamentActivation',
  'tournamentLifecycleUpdate',
  'shouldRefreshHostedSchedule',
  'hostedGameSchedule',
  'hostedGameDeadline',
  'initializedHostedClockMs',
  'hostedResultFor',
  'hostedClockForMove',
  'hostedClockSnapshot',
  'multiStageStageOneRounds',
  'isGameDecided',
  'decisiveWinnerProfileId',
  'knockoutRoundForGame',
  'assertResultAllowed',
  'normalizePhysicalBoards',
  'buildProcedureAssignments',
  'createTournamentGames',
  'startTournamentIfNeeded',
  'configureTournamentProcedure',
  'startProcedureGame',
  'updateGamePgn',
  'submitGameResult',
  'submitHostedTournamentMove',
  'syncHostedGameTimeout',
  'selectActiveHostedGame',
  'isDeletableTournamentStatus',
  'assertTournamentStatusTransition',
  'deleteTournamentRows',
  'listRowsPaginated',
  'listRowsByIds',
  'assertPlayersCanBeDeleted',
  'assertParticipantCanBeAdded',
  'isCompletePlayerProfile',
]

const SDK_STUB = `
const stub = () => { throw new Error('appwrite SDK called in a pure-logic test') };
const Account = stub, Client = stub, Messaging = stub, TablesDB = stub, Teams = stub, Users = stub;
const ID = { unique: () => 'stub' };
const Permission = { read: (role) => \`read(\"\${role}\")\` };
const Role = { any: () => 'any', user: (accountId) => \`user:\${accountId}\` };
const Query = { cursorAfter: () => 'query', equal: () => 'query', limit: () => 'query', notEqual: () => 'query', or: () => 'query' };
`

function loadEngine() {
  const source = readFileSync(join(here, '..', 'src', 'main.js'), 'utf8')
  const importLine = source.split('\n').find((line) => line.includes("from 'node-appwrite'"))
  assert.match(importLine ?? '', /^import .* from 'node-appwrite';\r?$/, 'expected the SDK import')
  const chessImport = "import { Chess } from 'chess.js';"
  const chessModule = pathToFileURL(join(here, '..', 'node_modules', 'chess.js', 'dist', 'esm', 'chess.js')).href

  const rewritten = source
    .replace(importLine, SDK_STUB)
    .replace(chessImport, `import { Chess } from '${chessModule}';`)
    + `\nexport { ${EXPORTED.join(', ')} };\n`
  const file = join(mkdtempSync(join(tmpdir(), 'juchess-engine-')), 'engine.mjs')
  writeFileSync(file, rewritten)
  return import(pathToFileURL(file).href)
}

const engine = await loadEngine()

test('paginated table reads preserve filters and return every row', async () => {
  const calls = []
  const pages = [
    { rows: [{ $id: 'row-1' }, { $id: 'row-2' }] },
    { rows: [{ $id: 'row-3' }] },
  ]
  const tablesDB = {
    async listRows(input) {
      calls.push(input)
      return pages[calls.length - 1]
    },
  }

  const rows = await engine.listRowsPaginated(tablesDB, 'juchess', 'games', ['status-filter'], 2)

  assert.deepEqual(rows.map((row) => row.$id), ['row-1', 'row-2', 'row-3'])
  assert.equal(calls.length, 2)
  assert.equal(calls[0].queries[0], 'status-filter')
  assert.equal(calls[0].total, false)
  assert.equal(calls[1].queries[0], 'status-filter')
})

test('ID-scoped reads deduplicate and batch large lookups', async () => {
  const calls = []
  const tablesDB = {
    async listRows(input) {
      calls.push(input)
      return { rows: [{ $id: `batch-${calls.length}` }] }
    },
  }

  const rows = await engine.listRowsByIds(
    tablesDB,
    'juchess',
    'profiles',
    ['profile-1', 'profile-1', 'profile-2', 'profile-3'],
    2,
  )

  assert.deepEqual(rows.map((row) => row.$id), ['batch-1', 'batch-2'])
  assert.equal(calls.length, 2)
  assert.equal(calls.every((call) => call.total === false), true)
})

test('fair-play heartbeats use one stable Appwrite-safe row per game, player, and session', () => {
  const first = engine.fairPlayHeartbeatRowId('game-1', 'player-1', 'session-1')
  const repeated = engine.fairPlayHeartbeatRowId('game-1', 'player-1', 'session-1')
  const otherSession = engine.fairPlayHeartbeatRowId('game-1', 'player-1', 'session-2')

  assert.equal(first, repeated)
  assert.notEqual(first, otherSession)
  assert.match(first, /^fph_[a-f0-9]{32}$/)
  assert.ok(first.length <= 36)
})

test('fair-play summary scoring stays bounded and preserves the latest signal time', () => {
  const [summary] = engine.fairPlaySummaries({
    player: {
      profileId: 'player',
      events: 9,
      hiddenCount: 8,
      hiddenDurationMs: 500_000,
      fullscreenExits: 3,
      disconnects: 2,
      analysisAttempts: 1,
      lastEventAt: '2026-07-18T12:00:00.000Z',
    },
  })

  assert.equal(summary.profileId, 'player')
  assert.equal(summary.riskScore, 100)
  assert.equal(summary.riskLevel, 'high')
  assert.equal(summary.lastEventAt, '2026-07-18T12:00:00.000Z')
})

test('hosted play requires a complete public and private player profile', () => {
  const profile = { displayName: 'Student Knight', university: 'University of Jordan' }
  const identity = { universityId: '0201234', phone: '+962791234567' }

  assert.equal(engine.isCompletePlayerProfile(profile, identity), true)
  assert.equal(engine.isCompletePlayerProfile(null, identity), false)
  assert.equal(engine.isCompletePlayerProfile(profile, null), false)
  assert.equal(engine.isCompletePlayerProfile({ ...profile, university: ' ' }, identity), false)
  assert.equal(engine.isCompletePlayerProfile(profile, { ...identity, phone: null }), false)
})

test('attendance reminder opens only during the final hour before an upcoming tournament', () => {
  const now = Date.parse('2026-07-12T12:00:00.000Z')
  assert.equal(engine.isAttendanceReminderDue({ status: 'upcoming', startsAt: '2026-07-12T13:00:00.000Z' }, now), true)
  assert.equal(engine.isAttendanceReminderDue({ status: 'upcoming', startsAt: '2026-07-12T13:00:00.001Z' }, now), false)
  assert.equal(engine.isAttendanceReminderDue({ status: 'active', startsAt: '2026-07-12T12:30:00.000Z' }, now), false)
  assert.equal(engine.isAttendanceReminderDue({ status: 'upcoming', startsAt: '2026-07-12T12:00:00.000Z' }, now), false)
})

test('attendance row IDs are deterministic and Appwrite-safe', () => {
  const id = engine.attendanceRowId('registration-1')
  assert.equal(id, engine.attendanceRowId('registration-1'))
  assert.match(id, /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/)
  assert.notEqual(id, engine.attendanceRowId('registration-2'))
})

/** Plays a whole knockout, resolving each round before the next is emitted. */
function playKnockout(structure, entrants, winnerOf) {
  const games = []
  for (const [structuralIndex, gameRound] of engine.knockoutGameRoundMap(structure)) {
    const resolver = engine.knockoutResolver(structure, entrants, games)
    structure.rounds[structuralIndex].matches.forEach((match, matchIndex) => {
      if (match.a === null || match.b === null) return
      const a = resolver.resolveRef(match.a)
      const b = resolver.resolveRef(match.b)
      assert.ok(a.known && b.known, `unresolvable slot in ${structure.rounds[structuralIndex].name}`)
      if (!a.profileId || !b.profileId) return
      games.push({
        round: gameRound,
        board: resolver.boardOf(structuralIndex, matchIndex),
        whiteProfileId: a.profileId,
        blackProfileId: b.profileId,
        status: 'completed',
        result: winnerOf(a.profileId, b.profileId) === a.profileId ? '1-0' : '0-1',
      })
    })
  }
  return games
}

test('seeding interleaves halves so top meets bottom', () => {
  assert.deepEqual(
    engine.seededKnockoutOrder(['1', '2', '3', '4', '5', '6', '7', '8']),
    ['1', '5', '2', '6', '3', '7', '4', '8'],
  )
})

test('bracket size rounds up to a power of two', () => {
  assert.equal(engine.bracketSizeFor(5), 8)
  assert.equal(engine.bracketSizeFor(16), 16)
  assert.equal(engine.bracketSizeFor(17), 32)
})

test('tournament deletion is restricted to draft and archived status', () => {
  assert.equal(engine.isDeletableTournamentStatus('draft'), true)
  assert.equal(engine.isDeletableTournamentStatus('archived'), true)
  assert.equal(engine.isDeletableTournamentStatus('upcoming'), false)
  assert.equal(engine.isDeletableTournamentStatus('active'), false)
  assert.equal(engine.isDeletableTournamentStatus('completed'), false)
})

test('tournament status rollback moves through adjacent lifecycle states', () => {
  assert.doesNotThrow(() => engine.assertTournamentStatusTransition('completed', 'active'))
  assert.doesNotThrow(() => engine.assertTournamentStatusTransition('active', 'upcoming'))
  assert.throws(
    () => engine.assertTournamentStatusTransition('completed', 'upcoming'),
    (error) => error.statusCode === 409 && /one step at a time/i.test(error.message),
  )
})

test('tournament deletion removes every dependent row across repeated batches', async () => {
  const rows = [
    { $id: 'game-1', tournamentId: 'target' },
    { $id: 'game-2', tournamentId: 'target' },
    { $id: 'game-3', tournamentId: 'target' },
    { $id: 'other-game', tournamentId: 'other' },
  ]
  const deleted = []
  const database = {
    async listRows() {
      return { rows: rows.filter((row) => row.tournamentId === 'target').slice(0, 2) }
    },
    async deleteRow({ rowId }) {
      const index = rows.findIndex((row) => row.$id === rowId)
      assert.notEqual(index, -1)
      rows.splice(index, 1)
      deleted.push(rowId)
    },
  }

  assert.equal(await engine.deleteTournamentRows(database, 'juchess', 'games', 'target'), 3)
  assert.deepEqual(deleted, ['game-1', 'game-2', 'game-3'])
  assert.deepEqual(rows, [{ $id: 'other-game', tournamentId: 'other' }])
})

test('player deletion protects tournament history and admin accounts', () => {
  const players = [
    { $id: 'p1', displayName: 'Player One' },
    { $id: 'p2', displayName: 'Player Two' },
  ]
  const privatePlayers = [
    { $id: 'p1', accountId: 'user-1', email: 'one@example.com' },
    { $id: 'p2', accountId: 'user-2', email: 'two@example.com' },
  ]

  assert.equal(engine.assertPlayersCanBeDeleted(['p1'], players, [], [], privatePlayers), undefined)
  assert.throws(
    () => engine.assertPlayersCanBeDeleted(
      ['p1'],
      players,
      [{ $id: 'game-1', whiteProfileId: 'p1', blackProfileId: 'p2' }],
      [],
      privatePlayers,
    ),
    (error) => error.statusCode === 409 && /game history/i.test(error.message),
  )
  assert.throws(
    () => engine.assertPlayersCanBeDeleted(
      ['p2'],
      players,
      [],
      [{ $id: 'admin-1', accountId: 'user-2' }],
      privatePlayers,
    ),
    (error) => error.statusCode === 409 && /admin access/i.test(error.message),
  )
})

test('participants can be added only before pairings and within capacity', () => {
  const registrations = [{ profileId: 'p1', status: 'confirmed', checkedIn: false, seed: 1 }]
  assert.equal(
    engine.assertParticipantCanBeAdded({ status: 'upcoming', capacity: 2 }, [], registrations, 'p2'),
    null,
  )
  assert.throws(
    () => engine.assertParticipantCanBeAdded({ status: 'upcoming', capacity: 2 }, [], registrations, 'p1'),
    (error) => error.statusCode === 409 && /already/i.test(error.message),
  )
  assert.throws(
    () => engine.assertParticipantCanBeAdded({ status: 'upcoming', capacity: 2 }, [{ $id: 'g1' }], registrations, 'p2'),
    (error) => error.statusCode === 409 && /unpublish/i.test(error.message),
  )
  assert.throws(
    () => engine.assertParticipantCanBeAdded({ status: 'upcoming', capacity: 1 }, [], registrations, 'p2'),
    (error) => error.statusCode === 409 && /capacity/i.test(error.message),
  )
  assert.throws(
    () => engine.assertParticipantCanBeAdded({ status: 'completed', capacity: 8 }, [], [], 'p2'),
    (error) => error.statusCode === 409 && /completed or archived/i.test(error.message),
  )
})

test('single elimination: 8 players produce QF, SF, Final', () => {
  const structure = engine.buildKnockoutStructure(8, false)
  assert.deepEqual(structure.rounds.map((r) => r.name), ['Quarterfinal', 'Semifinal', 'Final'])
  assert.deepEqual(structure.rounds.map((r) => r.matches.length), [4, 2, 1])
  assert.deepEqual([...engine.knockoutGameRoundMap(structure).values()], [1, 2, 3])
})

test('single elimination: byes advance without a game', () => {
  const entrants = ['a', 'b', 'c', 'd', 'e', 'f']
  const structure = engine.buildKnockoutStructure(6, false)
  const real = structure.rounds[0].matches.filter((m) => m.a !== null && m.b !== null)
  assert.equal(real.length, 2, 'six entrants means two real first-round matches')

  const games = [
    { round: 1, board: 1, whiteProfileId: 'a', blackProfileId: 'b', status: 'completed', result: '1-0' },
    { round: 1, board: 2, whiteProfileId: 'c', blackProfileId: 'd', status: 'completed', result: '1-0' },
  ]
  const resolver = engine.knockoutResolver(structure, entrants, games)
  const round2 = structure.rounds[1].matches.map((m) => [
    resolver.resolveRef(m.a).profileId,
    resolver.resolveRef(m.b).profileId,
  ])
  assert.deepEqual(round2[0], ['a', 'c'], 'winners meet')
  assert.deepEqual(round2[1], ['e', 'f'], 'bye recipients meet')
})

test('double elimination: rounds are emitted in true play order', () => {
  const structure = engine.buildKnockoutStructure(8, true)
  assert.deepEqual(
    structure.rounds.map((r) => `${r.side}:${r.name}`),
    [
      'w:W-Quarterfinal',
      'l:Semifinal Qualifier',
      'w:W-Semifinal',
      'l:Semifinal',
      'l:Final Qualifier',
      'w:W-Final',
      'l:Final',
      'f:Grand Final',
    ],
  )
})

test('double elimination: losers labels follow the qualifier scheme', () => {
  const structure = engine.buildKnockoutStructure(16, true)
  const losers = structure.losersIndices.map((i) => structure.rounds[i].name)
  assert.deepEqual(losers, [
    'Quarterfinal Qualifier',
    'Quarterfinal',
    'Semifinal Qualifier',
    'Semifinal',
    'Final Qualifier',
    'Final',
  ])
  assert.ok(!losers.some((name) => /^L-Round/.test(name)), 'no raw fallback labels')
})

test('double elimination: an undefeated favourite reaches the grand final', () => {
  const entrants = Array.from({ length: 8 }, (_, i) => `p${i + 1}`)
  const structure = engine.buildKnockoutStructure(8, true)
  const rank = (id) => Number(id.slice(1))
  const games = playKnockout(structure, entrants, (a, b) => (rank(a) <= rank(b) ? a : b))

  const grandFinalRound = engine.knockoutGameRoundMap(structure).get(structure.finalsIndices[0])
  const grandFinal = games.find((g) => g.round === grandFinalRound)
  assert.equal(grandFinal.whiteProfileId, 'p1', 'winners-bracket champion is the top seed')
  assert.notEqual(grandFinal.blackProfileId, 'p1', 'the losers champion is somebody else')
})

test('double elimination: 20 entrants complete without deadlock', () => {
  const entrants = Array.from({ length: 20 }, (_, i) => `p${i + 1}`)
  const structure = engine.buildKnockoutStructure(20, true)
  assert.equal(engine.knockoutGameRoundMap(structure).size, 14)
  // Alternate winners so the losers bracket receives an irregular pool.
  let flip = false
  const games = playKnockout(structure, entrants, (a, b) => {
    flip = !flip
    return flip ? a : b
  })
  assert.ok(games.length > 20, 'a 20-player double elimination plays more than 20 games')

  const losers = structure.losersIndices.map((i) => structure.rounds[i].name)
  assert.equal(losers[0], 'Round of 16 Qualifier')
  assert.equal(losers[losers.length - 1], 'Final')
})

test('swiss: pairs by score, rotates byes, avoids rematches', () => {
  const players = ['s1', 's2', 's3', 's4', 's5']
  const seeds = new Map(players.map((p, i) => [p, i + 1]))
  const BYE = 'system_bye'
  const games = []
  const byes = []

  for (let round = 1; round <= 3; round += 1) {
    const { pairings, byePlayerId } = engine.buildSwissPairings(players, games, seeds, BYE)
    assert.equal(pairings.length, 2, `round ${round} pairs the four non-bye players`)
    assert.ok(byePlayerId, `round ${round} gives the odd player a bye`)

    const seen = new Set()
    for (const p of pairings) {
      assert.ok(!seen.has(p.whiteProfileId) && !seen.has(p.blackProfileId), 'nobody is paired twice')
      seen.add(p.whiteProfileId)
      seen.add(p.blackProfileId)
      assert.notEqual(p.whiteProfileId, byePlayerId, 'the bye player is not also paired')
      games.push({ round, ...p, status: 'completed', result: '1-0' })
    }
    byes.push(byePlayerId)
    games.push({ round, board: 3, whiteProfileId: byePlayerId, blackProfileId: BYE, status: 'completed', result: '1-0' })
  }

  assert.equal(new Set(byes).size, 3, 'a different player sits out each round')
})

test('swiss: nobody receives a second bye while others have none', () => {
  const players = ['a', 'b', 'c']
  const seeds = new Map(players.map((p, i) => [p, i + 1]))
  const BYE = 'system_bye'
  const games = []
  const byes = []

  for (let round = 1; round <= 3; round += 1) {
    const { pairings, byePlayerId } = engine.buildSwissPairings(players, games, seeds, BYE)
    byes.push(byePlayerId)
    for (const p of pairings) games.push({ round, ...p, status: 'completed', result: '1-0' })
    games.push({ round, board: 2, whiteProfileId: byePlayerId, blackProfileId: BYE, status: 'completed', result: '1-0' })
  }

  assert.equal(new Set(byes).size, 3, 'three players, three rounds, three distinct byes')
})

test('swiss: first-round colours do not depend on player ranking', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const forwardSeeds = new Map(players.map((player, index) => [player, index + 1]))
  const reverseSeeds = new Map(players.map((player, index) => [player, players.length - index]))
  const forward = engine.buildSwissPairings(players, [], forwardSeeds, 'system_bye', { random: () => 0.25 })
  const reverse = engine.buildSwissPairings(players, [], reverseSeeds, 'system_bye', { random: () => 0.25 })

  const colorsByPair = (pairings) => new Map(pairings.map((pairing) => [
    [pairing.whiteProfileId, pairing.blackProfileId].sort().join(':'),
    pairing.whiteProfileId,
  ]))
  assert.deepEqual(colorsByPair(forward.pairings), colorsByPair(reverse.pairings))
})

test('swiss: previous colours do not force the next colour', () => {
  const players = ['a', 'b']
  const seeds = new Map([['a', 1], ['b', 2]])
  const games = [
    { round: 1, board: 1, whiteProfileId: 'a', blackProfileId: 'x', status: 'completed', result: '1/2-1/2' },
    { round: 1, board: 2, whiteProfileId: 'y', blackProfileId: 'b', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 1, whiteProfileId: 'a', blackProfileId: 'z', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 2, whiteProfileId: 'w', blackProfileId: 'b', status: 'completed', result: '1/2-1/2' },
  ]

  const { pairings } = engine.buildSwissPairings(players, games, seeds, 'system_bye', { random: () => 0.25 })
  assert.equal(pairings[0].whiteProfileId, 'a', 'a may receive White again after two consecutive Whites')
  assert.equal(pairings[0].blackProfileId, 'b')
})

test('swiss: each pairing uses an independent random colour draw', () => {
  const players = ['a', 'b', 'c', 'd']
  const seeds = new Map(players.map((player, index) => [player, index + 1]))
  const draws = [0.25, 0.75]
  const { pairings } = engine.buildSwissPairings(players, [], seeds, 'system_bye', {
    random: () => draws.shift(),
  })

  assert.equal(pairings[0].whiteProfileId, 'a')
  assert.equal(pairings[1].whiteProfileId, 'd')
  assert.equal(draws.length, 0, 'one random draw is consumed for every pairing')
})

test('swiss: random assignment allows the same colour in consecutive rounds', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const seeds = new Map(players.map((player, index) => [player, index + 1]))
  const games = []

  for (let round = 1; round <= 4; round += 1) {
    const { pairings } = engine.buildSwissPairings(players, games, seeds, 'system_bye', { random: () => 0.25 })
    assert.equal(pairings.length, 3)
    for (const pairing of pairings) {
      games.push({ round, ...pairing, status: 'completed', result: '1/2-1/2' })
    }
  }

  const p1Colors = games
    .filter((game) => game.whiteProfileId === 'p1' || game.blackProfileId === 'p1')
    .map((game) => game.whiteProfileId === 'p1' ? 'white' : 'black')
  assert.deepEqual(p1Colors, ['white', 'white', 'white', 'white'])
})

test('a drawn knockout game has no winner and cannot resolve the next round', () => {
  // Regression guard. A draw is "decided" for standings, but a bracket needs
  // somebody to advance; without the write-time rejection this deadlocks.
  const entrants = ['p1', 'p2', 'p3', 'p4']
  const structure = engine.buildKnockoutStructure(4, false)
  const games = [
    { round: 1, board: 1, whiteProfileId: 'p1', blackProfileId: 'p2', status: 'completed', result: '1/2-1/2' },
    { round: 1, board: 2, whiteProfileId: 'p3', blackProfileId: 'p4', status: 'completed', result: '1-0' },
  ]

  assert.equal(engine.isGameDecided(games[0]), true, 'a draw counts as decided')
  assert.equal(engine.decisiveWinnerProfileId(games[0]), null, 'but yields no winner')

  const resolver = engine.knockoutResolver(structure, entrants, games)
  const final = structure.rounds[structure.winnersIndices[1]].matches[0]
  assert.equal(resolver.resolveRef(final.a).known, false, 'the drawn half cannot resolve')
  assert.equal(resolver.resolveRef(final.b).profileId, 'p3', 'the decisive half resolves')
})

test('knockout rounds are identified so draws can be rejected at write time', () => {
  const knockout = { format: 'Single elimination' }
  const double = { format: 'Double elimination' }
  const swiss = { format: 'Swiss' }
  const game = { round: 3 }

  assert.equal(engine.knockoutRoundForGame(knockout, game), true)
  assert.equal(engine.knockoutRoundForGame(double, game), true)
  assert.equal(engine.knockoutRoundForGame(swiss, game), false, 'Swiss draws are legal')

  // Multi-stage: draws are legal in the Swiss stage, illegal in the bracket.
  const multiStage = {
    format: 'Multi-stage',
    bracketSnapshot: JSON.stringify({ type: 'single', stageTwoFromRound: 4 }),
  }
  assert.equal(engine.knockoutRoundForGame(multiStage, { round: 3 }), false, 'stage one allows draws')
  assert.equal(engine.knockoutRoundForGame(multiStage, { round: 4 }), true, 'stage two does not')
  assert.equal(engine.knockoutRoundForGame({ format: 'Multi-stage' }, { round: 1 }), false, 'no bracket yet')
})

test('assertResultAllowed rejects a knockout draw and permits a Swiss draw', async () => {
  const stubDb = (tournament) => ({
    getRow: async () => tournament,
  })
  const drawnGame = { tournamentId: 't1', round: 2 }

  await assert.rejects(
    () => engine.assertResultAllowed(stubDb({ format: 'Double elimination' }), 'juchess', drawnGame, '1/2-1/2'),
    (error) => {
      assert.equal(error.statusCode, 400)
      assert.match(error.message, /tie-break/i)
      return true
    },
    'a drawn knockout game must be refused',
  )

  await assert.doesNotReject(
    () => engine.assertResultAllowed(stubDb({ format: 'Swiss' }), 'juchess', drawnGame, '1/2-1/2'),
    'Swiss draws are legal',
  )

  await assert.doesNotReject(
    () => engine.assertResultAllowed(stubDb({ format: 'Single elimination' }), 'juchess', drawnGame, '1-0'),
    'decisive knockout results pass through',
  )
})

test('procedure: eight games use three physical boards over three waves', () => {
  const games = Array.from({ length: 8 }, (_, index) => ({
    round: 1,
    board: index + 1,
    whiteProfileId: `w${index + 1}`,
    blackProfileId: `b${index + 1}`,
  }))
  const planned = engine.buildProcedureAssignments(games, 3)

  assert.deepEqual(planned.map((game) => game.procedureWave), [1, 1, 1, 2, 2, 2, 3, 3])
  assert.deepEqual(planned.map((game) => game.physicalBoard), [1, 2, 3, 1, 2, 3, 1, 2])
  assert.deepEqual(planned.map((game) => game.queuePosition), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('procedure: each round receives an independent board plan and byes use no board', () => {
  const games = [
    { round: 1, board: 8, whiteProfileId: 'a', blackProfileId: 'b' },
    { round: 1, board: 12, whiteProfileId: 'c', blackProfileId: 'd' },
    { round: 1, board: 13, whiteProfileId: 'e', blackProfileId: 'system_bye' },
    { round: 2, board: 20, whiteProfileId: 'a', blackProfileId: 'c' },
  ]
  const planned = engine.buildProcedureAssignments(games, 1)

  assert.deepEqual(
    planned.map(({ procedureWave, physicalBoard, queuePosition }) => ({ procedureWave, physicalBoard, queuePosition })),
    [
      { procedureWave: 1, physicalBoard: 1, queuePosition: 1 },
      { procedureWave: 2, physicalBoard: 1, queuePosition: 2 },
      { procedureWave: undefined, physicalBoard: undefined, queuePosition: undefined },
      { procedureWave: 1, physicalBoard: 1, queuePosition: 1 },
    ],
  )
})

test('procedure: created games stay scheduled until the manager starts them', async () => {
  const writes = []
  const tablesDB = {
    createRow: async ({ data }) => {
      writes.push(data)
      return { $id: `g${writes.length}`, ...data }
    },
  }
  const games = Array.from({ length: 4 }, (_, index) => ({
    round: 1,
    board: index + 1,
    whiteProfileId: `w${index + 1}`,
    blackProfileId: `b${index + 1}`,
  }))

  await engine.createTournamentGames(tablesDB, 'juchess', 't1', games, 2)
  assert.ok(writes.every((game) => game.status === 'scheduled'))
  assert.ok(writes.every((game) => game.startedAt === undefined))
  assert.deepEqual(writes.map((game) => game.physicalBoard), [1, 2, 1, 2])
})

test('live moves: undoing to the initial position clears the stored PGN', async () => {
  const updates = []
  const tablesDB = {
    getRow: async () => ({ $id: 'g1', status: 'live', pgn: '1. e4' }),
    updateRow: async ({ data }) => {
      updates.push(data)
      return { $id: 'g1', status: 'live', ...data }
    },
  }

  const row = await engine.updateGamePgn(tablesDB, 'juchess', 'g1', '')
  assert.equal(row.pgn, '')
  assert.deepEqual(updates, [{ pgn: '' }])
})

test('procedure: configuring legacy live games requeues matches beyond board capacity', async () => {
  const games = Array.from({ length: 4 }, (_, index) => ({
    $id: `g${index + 1}`,
    tournamentId: 't1',
    round: 1,
    board: index + 1,
    whiteProfileId: `w${index + 1}`,
    blackProfileId: `b${index + 1}`,
    status: 'live',
  }))
  const updates = new Map()
  const tablesDB = {
    getRow: async () => ({ $id: 't1', status: 'active', currentRound: 1, physicalBoards: 2 }),
    listRows: async () => ({ rows: games }),
    updateRow: async ({ tableId, rowId, data }) => {
      if (tableId === 'games') updates.set(rowId, data)
      return { $id: rowId, ...data }
    },
  }

  await engine.configureTournamentProcedure(tablesDB, 'juchess', 't1', 2)
  assert.equal(updates.get('g1').status, undefined)
  assert.equal(updates.get('g2').status, undefined)
  assert.equal(updates.get('g3').status, 'scheduled')
  assert.equal(updates.get('g4').status, 'scheduled')
})

test('procedure: venue planning is blocked before the tournament is active', async () => {
  const tablesDB = {
    getRow: async () => ({ $id: 't1', status: 'upcoming', currentRound: 1, physicalBoards: 2 }),
  }

  await assert.rejects(
    () => engine.configureTournamentProcedure(tablesDB, 'juchess', 't1', 2),
    (error) => error.statusCode === 409 && /only while.*active/i.test(error.message),
  )
})

test('procedure: start changes one assigned game to live and rejects an occupied board', async () => {
  const game = {
    $id: 'g1',
    tournamentId: 't1',
    round: 1,
    queuePosition: 1,
    physicalBoard: 1,
    status: 'scheduled',
    whiteProfileId: 'w1',
    blackProfileId: 'b1',
  }
  const tournament = { $id: 't1', status: 'active', physicalBoards: 2 }
  const updates = []
  const tablesDB = {
    getRow: async ({ tableId }) => tableId === 'games' ? game : tournament,
    listRows: async () => ({ rows: [game] }),
    updateRow: async ({ data }) => {
      updates.push(data)
      return { ...game, ...data }
    },
  }

  const started = await engine.startProcedureGame(tablesDB, 'juchess', 'g1', 1)
  assert.equal(started.status, 'live')
  assert.equal(started.physicalBoard, 1)
  assert.ok(started.startedAt)

  tablesDB.listRows = async () => ({
    rows: [game, { $id: 'g2', tournamentId: 't1', status: 'live', physicalBoard: 1 }],
  })
  await assert.rejects(
    () => engine.startProcedureGame(tablesDB, 'juchess', 'g1', 1),
    (error) => error.statusCode === 409 && /already in use/i.test(error.message),
  )
})

test('procedure: a future round cannot start before the current round finishes', async () => {
  const game = {
    $id: 'g2',
    tournamentId: 't1',
    round: 2,
    queuePosition: 1,
    physicalBoard: 1,
    status: 'scheduled',
    whiteProfileId: 'w1',
    blackProfileId: 'b1',
  }
  const tournament = { $id: 't1', status: 'active', currentRound: 1, physicalBoards: 2 }
  const tablesDB = {
    getRow: async ({ tableId }) => tableId === 'games' ? game : tournament,
  }

  await assert.rejects(
    () => engine.startProcedureGame(tablesDB, 'juchess', 'g2', 1),
    (error) => error.statusCode === 409 && /only round 1/i.test(error.message),
  )
})

test('procedure: a queued game cannot receive a result before Start', async () => {
  const tablesDB = {
    getRow: async () => ({
      $id: 'g1',
      tournamentId: 't1',
      round: 1,
      status: 'scheduled',
      result: '*',
    }),
  }

  await assert.rejects(
    () => engine.submitGameResult(tablesDB, 'juchess', 'g1', { result: '1-0' }),
    (error) => error.statusCode === 409 && /start this game/i.test(error.message),
  )
})

test('procedure: a finished result cannot be submitted twice', async () => {
  const game = {
    $id: 'g1',
    tournamentId: 't1',
    round: 1,
    status: 'completed',
    result: '1-0',
  }
  const tablesDB = {
    getRow: async ({ tableId }) => tableId === 'games' ? game : { $id: 't1', status: 'active' },
  }

  await assert.rejects(
    () => engine.submitGameResult(tablesDB, 'juchess', 'g1', { result: '1-0' }),
    (error) => error.statusCode === 409 && /already finished/i.test(error.message),
  )
})

test('completed procedure can correct a finished result without advancing rounds', async () => {
  let savedGame = {
    $id: 'g1',
    tournamentId: 't1',
    round: 1,
    board: 1,
    whiteProfileId: 'p1',
    blackProfileId: 'p2',
    status: 'completed',
    result: '1-0',
    startedAt: '2026-07-10T10:00:00.000Z',
    finishedAt: '2026-07-10T10:30:00.000Z',
  }
  const tournament = { $id: 't1', status: 'completed', format: 'Swiss' }
  const registrations = [
    { $id: 'r1', tournamentId: 't1', profileId: 'p1', status: 'confirmed', seed: 1 },
    { $id: 'r2', tournamentId: 't1', profileId: 'p2', status: 'confirmed', seed: 2 },
  ]
  const tablesDB = {
    getRow: async ({ tableId }) => tableId === 'games' ? savedGame : tournament,
    listRows: async ({ tableId }) => ({
      rows: tableId === 'games' ? [savedGame] : tableId === 'registrations' ? registrations : [],
    }),
    updateRow: async ({ tableId, data }) => {
      if (tableId === 'games') savedGame = { ...savedGame, ...data }
      return tableId === 'games' ? savedGame : data
    },
    createRow: async ({ data }) => data,
  }

  const corrected = await engine.submitGameResult(tablesDB, 'juchess', 'g1', {
    result: '0-1',
    status: 'completed',
  })
  assert.equal(corrected.result, '0-1')
  assert.equal(corrected.finishedAt, '2026-07-10T10:30:00.000Z')
})

test('activation requires the opening pairings to be published first', async () => {
  const tablesDB = {
    getRow: async () => ({ $id: 't1', status: 'upcoming', format: 'Swiss' }),
    listRows: async ({ tableId }) => ({
      rows: tableId === 'registrations'
        ? [
            { $id: 'r1', tournamentId: 't1', profileId: 'p1', status: 'confirmed', seed: 1 },
            { $id: 'r2', tournamentId: 't1', profileId: 'p2', status: 'confirmed', seed: 2 },
          ]
        : [],
    }),
  }

  await assert.rejects(
    () => engine.startTournamentIfNeeded(tablesDB, 'juchess', 't1', { status: 'active' }),
    (error) => error.statusCode === 409 && /publish the opening pairings/i.test(error.message),
  )
})

test('activation preserves the exact published games and bracket snapshot', async () => {
  const bracketSnapshot = JSON.stringify({ version: 1, entrants: ['p1', 'p2'] })
  const games = [{
    $id: 'g1',
    tournamentId: 't1',
    round: 1,
    board: 1,
    whiteProfileId: 'p1',
    blackProfileId: 'p2',
    status: 'scheduled',
    result: '*',
  }]
  const registrations = [
    { $id: 'r1', tournamentId: 't1', profileId: 'p1', status: 'confirmed', seed: 1 },
    { $id: 'r2', tournamentId: 't1', profileId: 'p2', status: 'confirmed', seed: 2 },
  ]
  const tablesDB = {
    getRow: async () => ({ $id: 't1', status: 'completed', format: 'Swiss', currentRound: 5, bracketSnapshot }),
    listRows: async ({ tableId }) => ({ rows: tableId === 'games' ? games : registrations }),
  }

  const activation = await engine.startTournamentIfNeeded(tablesDB, 'juchess', 't1', { status: 'active' })
  assert.deepEqual(activation.createdGames, [])
  assert.equal(activation.currentRound, 5)
  assert.equal(activation.roundsTotal, 1)
  assert.equal(activation.bracketSnapshot, bracketSnapshot)
})

test('published pairings must contain exactly the confirmed participants', () => {
  const registrations = ['p1', 'p2', 'p3', 'p4'].map((profileId) => ({ profileId }))
  const validGames = [
    { whiteProfileId: 'p1', blackProfileId: 'p2' },
    { whiteProfileId: 'p3', blackProfileId: 'p4' },
  ]

  assert.doesNotThrow(() => (
    engine.assertPublishedParticipantSet({ format: 'Swiss' }, validGames, registrations)
  ))
  assert.throws(
    () => engine.assertPublishedParticipantSet(
      { format: 'Swiss' },
      [{ whiteProfileId: 'p1', blackProfileId: 'p2' }],
      registrations,
    ),
    (error) => error.statusCode === 409 && /no longer match/i.test(error.message),
  )
})

test('pairing publication rejects duplicate boards and repeated players in a round', () => {
  const registrations = ['p1', 'p2', 'p3', 'p4'].map((profileId) => ({ profileId }))
  const tournament = { format: 'Swiss' }
  const valid = [
    { round: 1, board: 1, whiteProfileId: 'p1', blackProfileId: 'p2', status: 'scheduled', result: '*' },
    { round: 1, board: 2, whiteProfileId: 'p3', blackProfileId: 'p4', status: 'scheduled', result: '*' },
  ]

  assert.doesNotThrow(() => engine.assertPublishedPairingStructure(tournament, valid, registrations))
  assert.throws(
    () => engine.assertPublishedPairingStructure(tournament, [valid[0], { ...valid[1], board: 1 }], registrations),
    /duplicate board/i,
  )
  assert.throws(
    () => engine.assertPublishedPairingStructure(tournament, [valid[0], { ...valid[1], whiteProfileId: 'p1' }], registrations),
    /more than once/i,
  )
  assert.throws(
    () => engine.assertPublishedPairingStructure(tournament, [{ ...valid[0], round: 0 }, valid[1]], registrations),
    /positive whole numbers/i,
  )
})

test('round-robin publication requires the complete opponent matrix', () => {
  const players = ['p1', 'p2', 'p3', 'p4']
  const registrations = players.map((profileId) => ({ profileId }))
  const schedule = engine.buildRoundRobinSchedule(players, false, { initialColor: 'white' })
    .map((game) => ({ ...game, status: 'scheduled', result: '*' }))

  assert.doesNotThrow(() => engine.assertPublishedPairingStructure(
    { format: 'Round Robin' },
    schedule,
    registrations,
  ))
  assert.throws(
    () => engine.assertPublishedPairingStructure({ format: 'Round Robin' }, schedule.slice(0, -1), registrations),
    /complete expected round and game matrix|exactly once/i,
  )

  const double = engine.buildRoundRobinSchedule(players, true, { initialColor: 'white' })
    .map((game) => ({ ...game, status: 'scheduled', result: '*' }))
  double[double.length / 2] = {
    ...double[double.length / 2],
    whiteProfileId: double[0].whiteProfileId,
    blackProfileId: double[0].blackProfileId,
  }
  assert.throws(
    () => engine.assertPublishedPairingStructure({ format: 'Double Round Robin' }, double, registrations),
    /more than once|rematches must reverse|opponent pair/i,
  )
})

test('knockout publication is bound to the canonical bracket entrant order', () => {
  const entrants = ['p1', 'p2', 'p3', 'p4']
  const registrations = entrants.map((profileId) => ({ profileId }))
  const structure = engine.buildKnockoutStructure(entrants.length, false)
  const games = engine.openingKnockoutPairs(entrants.length).map((pair, index) => ({
    round: 1,
    board: index + 1,
    whiteProfileId: entrants[pair.a.e],
    blackProfileId: entrants[pair.b.e],
    status: 'scheduled',
    result: '*',
  }))
  const names = new Map(entrants.map((id) => [id, id]))
  const bracketSnapshot = engine.buildKnockoutSnapshot(
    structure,
    entrants,
    games,
    names,
    { format: 'Single Elimination' },
  )

  assert.doesNotThrow(() => engine.assertPublishedPairingStructure(
    { format: 'Single Elimination', bracketSnapshot },
    games,
    registrations,
  ))
  assert.throws(
    () => engine.assertPublishedPairingStructure(
      { format: 'Single Elimination', bracketSnapshot },
      [{ ...games[0], blackProfileId: 'p3' }, games[1]],
      registrations,
    ),
    /more than once|do not match/i,
  )
})

test('atomic pairing replacement rolls back instead of reporting a partial publish', async () => {
  const transactionUpdates = []
  const tablesDB = {
    createTransaction: async () => ({ $id: 'tx1' }),
    deleteRows: async () => ({ rows: [] }),
    createRow: async ({ rowId, data, permissions }) => ({ $id: rowId, ...data, $permissions: permissions }),
    updateRow: async () => { throw Object.assign(new Error('metadata write failed'), { code: 500 }) },
    updateTransaction: async (input) => { transactionUpdates.push(input); return input },
  }

  await assert.rejects(
    () => engine.replaceTournamentPairingsAtomically(
      tablesDB,
      'juchess',
      { $id: 't1', format: 'Swiss', timeControl: '5+0', playMode: 'inPerson', physicalBoards: 3 },
      [{ round: 1, board: 1, whiteProfileId: 'p1', blackProfileId: 'p2' }],
      null,
    ),
    /metadata write failed/,
  )
  assert.deepEqual(transactionUpdates, [{ transactionId: 'tx1', rollback: true }])
})

test('atomic pairing replacement stages game rows and tournament metadata before commit', async () => {
  const calls = []
  const tablesDB = {
    createTransaction: async (input) => { calls.push(['createTransaction', input]); return { $id: 'tx1' } },
    deleteRows: async (input) => { calls.push(['deleteRows', input]); return { rows: [] } },
    createRow: async (input) => { calls.push(['createRow', input]); return { $id: input.rowId, ...input.data } },
    updateRow: async (input) => { calls.push(['updateRow', input]); return { $id: input.rowId, ...input.data } },
    updateTransaction: async (input) => { calls.push(['updateTransaction', input]); return input },
  }

  const result = await engine.replaceTournamentPairingsAtomically(
    tablesDB,
    'juchess',
    { $id: 't1', format: 'Swiss', timeControl: '5+0', playMode: 'inPerson', physicalBoards: 3 },
    [{ round: 1, board: 1, whiteProfileId: 'p1', blackProfileId: 'p2' }],
    null,
  )

  assert.equal(result.rows.length, 1)
  assert.equal(result.roundsTotal, 1)
  const createCall = calls.find(([name]) => name === 'createRow')[1]
  assert.equal(createCall.transactionId, 'tx1')
  assert.equal(createCall.data.tournamentId, 't1')
  assert.deepEqual(createCall.permissions, ['read("any")'])
  const metadataCall = calls.find(([name]) => name === 'updateRow')[1]
  assert.equal(metadataCall.transactionId, 'tx1')
  assert.equal(metadataCall.data.currentRound, 1)
  assert.deepEqual(calls.at(-1), ['updateTransaction', { transactionId: 'tx1', commit: true }])
})

test('atomic pairing replacement rejects schedules above the verified transaction ceiling', async () => {
  const games = Array.from({ length: 97 }, (_, index) => ({
    round: index + 1,
    board: 1,
    whiteProfileId: `white-${index}`,
    blackProfileId: `black-${index}`,
  }))
  let transactionStarted = false

  await assert.rejects(
    () => engine.replaceTournamentPairingsAtomically(
      { createTransaction: async () => { transactionStarted = true; return { $id: 'tx1' } } },
      'juchess',
      { $id: 't1', format: 'Swiss', timeControl: '5+0', playMode: 'inPerson', physicalBoards: 1 },
      games,
      null,
    ),
    /at most 96/i,
  )
  assert.equal(transactionStarted, false)
})

test('admin authorization requires a confirmed membership in the role team', () => {
  const membership = {
    userId: 'account-1',
    teamId: 'admin_super_admins',
    confirm: true,
    joined: '2026-07-18T10:00:00.000Z',
  }
  assert.equal(engine.isConfirmedAdminMembership(membership, 'account-1', 'admin_super_admins'), true)
  assert.equal(engine.isConfirmedAdminMembership({ ...membership, confirm: false }, 'account-1', 'admin_super_admins'), false)
  assert.equal(engine.isConfirmedAdminMembership(membership, 'other-account', 'admin_super_admins'), false)
  assert.equal(engine.isConfirmedAdminMembership(membership, 'account-1', 'admin_staff'), false)
})

test('competition-defining fields are detected independently from descriptive edits', () => {
  const current = {
    format: 'Swiss',
    timeControl: '5+0 Blitz',
    playMode: 'online',
    onlinePlatform: 'juchess',
    roundsTotal: 5,
  }
  assert.deepEqual(engine.changedCompetitionFields(current, { name: 'New title' }), [])
  assert.deepEqual(engine.changedCompetitionFields(current, { format: 'Round Robin' }), ['format'])
  assert.deepEqual(engine.changedCompetitionFields(current, { roundsTotal: 7 }), ['roundsTotal'])
})

test('tournament location links allow only HTTP and HTTPS URLs', () => {
  assert.equal(engine.normalizeTournamentLocationUrl(undefined), undefined)
  assert.equal(engine.normalizeTournamentLocationUrl(''), null)
  assert.equal(engine.normalizeTournamentLocationUrl(' https://maps.app.goo.gl/example '), 'https://maps.app.goo.gl/example')
  assert.throws(() => engine.normalizeTournamentLocationUrl('maps.google.com/place'), /starting with https:\/\//)
  assert.throws(() => engine.normalizeTournamentLocationUrl('javascript:alert(1)'), /starting with https:\/\//)
})

test('round counts', () => {
  assert.equal(engine.swissRoundsTotal({ roundsTotal: 0 }, 20), 6)
  assert.equal(engine.swissRoundsTotal({ roundsTotal: 9 }, 20), 9, 'an explicit count wins')
  assert.equal(engine.multiStageStageOneRounds({ roundsTotal: 5 }, 8), 2)
  assert.equal(engine.multiStageStageOneRounds({ roundsTotal: 0 }, 8), 3, 'defaults to three qualifying rounds')
  assert.equal(Math.max(...engine.buildRoundRobinSchedule(Array.from({ length: 16 }, (_, i) => `p${i}`), false).map((game) => game.round)), 15)
  assert.equal(Math.max(...engine.buildRoundRobinSchedule(Array.from({ length: 18 }, (_, i) => `p${i}`), true).map((game) => game.round)), 34)
})

test('Swiss tournament setup requires an explicit valid round count', () => {
  assert.equal(engine.validateTournamentRoundCount('Swiss', 7), 7)
  assert.equal(engine.validateTournamentRoundCount('Round robin', undefined), undefined)
  assert.throws(
    () => engine.validateTournamentRoundCount('Swiss', undefined),
    /require a round count between 1 and 50/,
  )
  assert.throws(
    () => engine.validateTournamentRoundCount('Swiss', 2.5),
    /require a round count between 1 and 50/,
  )
})

test('tournament mode accepts only in-person or online play', () => {
  assert.equal(engine.validateTournamentPlayMode('inPerson'), 'inPerson')
  assert.equal(engine.validateTournamentPlayMode('online'), 'online')
  assert.throws(
    () => engine.validateTournamentPlayMode('hybrid'),
    /must be inPerson or online/,
  )
})

test('online tournaments require one supported platform', () => {
  assert.equal(engine.validateTournamentOnlinePlatform('online', 'juchess'), 'juchess')
  assert.equal(engine.validateTournamentOnlinePlatform('online', 'chessCom'), 'chessCom')
  assert.equal(engine.validateTournamentOnlinePlatform('inPerson', undefined), undefined)
  assert.equal(engine.isJuChessHostedTournament({ playMode: 'online', onlinePlatform: 'juchess' }), true)
  assert.equal(engine.isJuChessHostedTournament({ playMode: 'online', onlinePlatform: 'lichess' }), false)
  assert.throws(
    () => engine.validateTournamentOnlinePlatform('online', 'other'),
    /Choose Chess.com, Lichess, or JuChess/,
  )
})

test('hosted clock deducts only the running side and preserves the increment', () => {
  const control = engine.parseHostedTimeControl('5+3 Blitz')
  assert.deepEqual(control, { initialMs: 300000, incrementMs: 3000 })
  const clock = engine.hostedClockForMove({
    status: 'live',
    whiteTimeMs: 280000,
    blackTimeMs: 290000,
    turnStartedAt: '2026-07-12T10:00:00.000Z',
  }, { timeControl: '5+3 Blitz' }, 'w', Date.parse('2026-07-12T10:00:04.500Z'))
  assert.equal(clock.whiteTimeMs, 275500)
  assert.equal(clock.blackTimeMs, 290000)
  assert.equal(clock.incrementMs, 3000)
  assert.equal(clock.moverClockKey, 'whiteTimeMs')
})

test('hosted first-move grace follows the public time class defaults and supports an override', () => {
  assert.equal(engine.hostedTimeClass('1+0'), 'bullet')
  assert.equal(engine.hostedTimeClass('5+3'), 'blitz')
  assert.equal(engine.hostedTimeClass('15+10'), 'rapid')
  assert.equal(engine.firstMoveGraceMs({ timeControl: '1+0' }), 15000)
  assert.equal(engine.firstMoveGraceMs({ timeControl: '5+0' }), 20000)
  assert.equal(engine.firstMoveGraceMs({ timeControl: '15+10' }), 60000)
  assert.equal(engine.firstMoveGraceMs({ timeControl: '5+0', firstMoveGraceSeconds: 45 }), 45000)
})

test('hosted deadlines distinguish the first-move grace from the running chess clock', () => {
  const now = Date.parse('2026-07-12T10:00:00.000Z')
  const tournament = { status: 'active', startsAt: '2026-07-12T12:00:00.000Z', timeControl: '5+0' }
  const schedule = engine.hostedGameSchedule(tournament, now)
  assert.equal(schedule.scheduledStartAt, '2026-07-12T10:00:20.000Z')
  assert.equal(schedule.firstMoveDeadlineAt, '2026-07-12T10:00:40.000Z')
  assert.equal(
    engine.hostedGameSchedule({ ...tournament, status: 'upcoming' }, now).scheduledStartAt,
    '2026-07-12T12:00:20.000Z',
  )
  assert.equal(engine.hostedGameDeadline({
    status: 'scheduled',
    scheduledStartAt: schedule.scheduledStartAt,
    firstMoveDeadlineAt: schedule.firstMoveDeadlineAt,
  }, tournament, now), Date.parse(schedule.firstMoveDeadlineAt))
  assert.equal(engine.hostedGameDeadline({
    status: 'live',
    pgn: '1. e4',
    whiteTimeMs: 300000,
    blackTimeMs: 275000,
    turnStartedAt: '2026-07-12T10:01:00.000Z',
  }, tournament, now), Date.parse('2026-07-12T10:05:35.000Z'))
})

test('active tournament edits do not reactivate or erase lifecycle state', () => {
  const current = { status: 'active', currentRound: 4, bracketSnapshot: '{"round":4}' }
  const patch = { status: 'active', startsAt: '2026-07-12T12:00:00.000Z' }
  assert.equal(engine.isTournamentActivation(current, patch), false)
  assert.deepEqual(engine.tournamentLifecycleUpdate(current, patch), {
    currentRound: undefined,
    bracketSnapshot: undefined,
  })

  const upcoming = { status: 'upcoming', currentRound: 1 }
  const activation = { currentRound: 2, bracketSnapshot: '{"round":2}' }
  assert.equal(engine.isTournamentActivation(upcoming, { status: 'active' }), true)
  assert.deepEqual(engine.tournamentLifecycleUpdate(upcoming, { status: 'active' }, activation), {
    currentRound: 2,
    bracketSnapshot: '{"round":2}',
  })
})

test('hosted schedules refresh on activation, time edits, and legacy future starts', () => {
  const now = Date.parse('2026-07-12T10:00:00.000Z')
  const current = {
    status: 'active',
    startsAt: '2026-07-12T12:00:00.000Z',
    timeControl: '5+0 Blitz',
  }
  const next = { ...current }
  assert.equal(engine.shouldRefreshHostedSchedule(current, next, {}, [], now), false)
  assert.equal(engine.shouldRefreshHostedSchedule(
    { ...current, status: 'upcoming' },
    next,
    { status: 'active' },
    [],
    now,
  ), true)
  assert.equal(engine.shouldRefreshHostedSchedule(
    current,
    { ...next, startsAt: '2026-07-12T13:00:00.000Z' },
    { startsAt: '2026-07-12T13:00:00.000Z' },
    [],
    now,
  ), true)
  assert.equal(engine.shouldRefreshHostedSchedule(
    current,
    next,
    {},
    [{ status: 'scheduled', scheduledStartAt: '2026-07-12T12:00:00.000Z' }],
    now,
  ), true)
  assert.equal(engine.shouldRefreshHostedSchedule(
    current,
    next,
    {},
    [{ status: 'scheduled', scheduledStartAt: '2026-07-12T10:00:20.000Z' }],
    now,
  ), false)
})

test('admin profile DTO joins private identity without retaining legacy public PII', () => {
  const row = engine.mergeAdminProfile({
    $id: 'p1',
    displayName: 'Player One',
    status: 'active',
    accountId: 'legacy-user',
    email: 'legacy@example.com',
    universityId: 'legacy-id',
    phone: 'legacy-phone',
  }, {
    $id: 'p1',
    accountId: 'private-user',
    email: 'private@example.com',
    universityId: 'private-id',
    phone: '+962790000000',
  })

  assert.deepEqual(row, {
    $id: 'p1',
    displayName: 'Player One',
    status: 'active',
    accountId: 'private-user',
    email: 'private@example.com',
    universityId: 'private-id',
    phone: '+962790000000',
  })
})

test('profile status permissions expose only active rows publicly and never allow owner updates', () => {
  assert.deepEqual(engine.publicProfilePermissions('active', 'user-1'), [
    'read("any")',
    'read("user:user-1")',
  ])
  assert.deepEqual(engine.publicProfilePermissions('pending', 'user-1'), ['read("user:user-1")'])
  assert.deepEqual(engine.publicProfilePermissions('suspended', 'user-1'), ['read("user:user-1")'])
  assert.equal(engine.publicProfilePermissions('active', 'user-1').some((value) => value.startsWith('update(')), false)
})

test('scheduled hosted clocks repair legacy zero values without overwriting positive time', () => {
  assert.equal(engine.initializedHostedClockMs(undefined, 900_000), 900_000)
  assert.equal(engine.initializedHostedClockMs(0, 900_000), 900_000)
  assert.equal(engine.initializedHostedClockMs(-1, 900_000), 900_000)
  assert.equal(engine.initializedHostedClockMs(452_345.7, 900_000), 452_346)
})

test('scheduled hosted game starts White clock and exposes a canonical clock snapshot', async () => {
  const game = {
    $id: 'g-start',
    tournamentId: 't-start',
    whiteProfileId: 'white',
    blackProfileId: 'black',
    status: 'scheduled',
    result: '*',
    moveVersion: 0,
    scheduledStartAt: '2026-07-12T10:00:00.000Z',
  }
  const tournament = {
    $id: 't-start',
    status: 'active',
    playMode: 'online',
    onlinePlatform: 'juchess',
    timeControl: '5+0 Blitz',
  }
  let saved = game
  const tablesDB = {
    updateRow: async ({ data }) => {
      saved = { ...saved, ...data }
      return saved
    },
  }

  const now = Date.parse('2026-07-12T10:00:05.000Z')
  const outcome = await engine.syncHostedGameTimeout(tablesDB, 'juchess', game, tournament, now)
  assert.equal(outcome.expired, false)
  assert.equal(outcome.started, true)
  assert.equal(outcome.row.status, 'live')
  assert.equal(outcome.row.whiteTimeMs, 295000)
  assert.equal(outcome.row.blackTimeMs, 300000)
  assert.equal(outcome.row.turnStartedAt, '2026-07-12T10:00:05.000Z')

  const clock = engine.hostedClockSnapshot(outcome.row, tournament, now + 1000)
  assert.deepEqual(clock, {
    blackTimeMs: 300000,
    observedAtMs: now + 1000,
    turn: 'white',
    whiteTimeMs: 294000,
  })
})

test('hosted chess derives decisive and drawn terminal results', () => {
  const mate = new Chess()
  mate.move('f3')
  mate.move('e5')
  mate.move('g4')
  mate.move('Qh4#')
  assert.equal(engine.hostedResultFor(mate), '0-1')

  const draw = new Chess('7k/5Q2/7K/8/8/8/8/8 b - - 0 1')
  assert.equal(draw.isStalemate(), true)
  assert.equal(engine.hostedResultFor(draw), '1/2-1/2')
})

test('hosted move alternates players and clocks while advancing the canonical revision', async () => {
  let game = {
    $id: 'g1',
    tournamentId: 't1',
    whiteProfileId: 'white',
    blackProfileId: 'black',
    status: 'scheduled',
    result: '*',
    moveVersion: 0,
    round: 1,
  }
  const tournament = {
    $id: 't1',
    status: 'active',
    playMode: 'online',
    onlinePlatform: 'juchess',
    timeControl: '5+3 Blitz',
    format: 'Swiss',
  }
  const tablesDB = {
    getRow: async ({ tableId }) => tableId === 'games' ? game : tournament,
    updateRow: async ({ data }) => {
      game = { ...game, ...data }
      return game
    },
  }

  const outcome = await engine.submitHostedTournamentMove(
    tablesDB,
    'juchess',
    'g1',
    { san: 'e4', expectedVersion: 0 },
    { $id: 'white' },
  )
  assert.equal(outcome.move, 'e4')
  assert.equal(outcome.row.status, 'live')
  assert.equal(outcome.row.moveVersion, 1)
  assert.match(outcome.row.pgn, /1\. e4/)
  assert.ok(outcome.row.whiteTimeMs > 302000 && outcome.row.whiteTimeMs <= 303000)
  assert.equal(outcome.row.blackTimeMs, 300000)
  assert.equal(outcome.clock.turn, 'black')
  const whiteAfterFirstMove = outcome.row.whiteTimeMs

  const reply = await engine.submitHostedTournamentMove(
    tablesDB,
    'juchess',
    'g1',
    { san: 'e5', expectedVersion: 1 },
    { $id: 'black' },
  )
  assert.equal(reply.move, 'e5')
  assert.equal(reply.row.status, 'live')
  assert.equal(reply.row.moveVersion, 2)
  assert.match(reply.row.pgn, /1\. e4 e5/)
  assert.equal(reply.row.whiteTimeMs, whiteAfterFirstMove)
  assert.ok(reply.row.blackTimeMs > 302000 && reply.row.blackTimeMs <= 303000)
  assert.equal(reply.clock.turn, 'white')

  await assert.rejects(
    () => engine.submitHostedTournamentMove(tablesDB, 'juchess', 'g1', { san: 'e4', expectedVersion: 2 }, { $id: 'black' }),
    (error) => error.statusCode === 409 && /not your turn/i.test(error.message),
  )
  await assert.rejects(
    () => engine.submitHostedTournamentMove(tablesDB, 'juchess', 'g1', { san: 'e4', expectedVersion: 1 }, { $id: 'spectator' }),
    (error) => error.statusCode === 403 && /assigned players/i.test(error.message),
  )
})

test('hosted move stops the mover clock at request receipt before database processing', async () => {
  let game = {
    $id: 'g-latency',
    tournamentId: 't-latency',
    whiteProfileId: 'white',
    blackProfileId: 'black',
    status: 'live',
    result: '*',
    moveVersion: 0,
    round: 1,
    whiteTimeMs: 300_000,
    blackTimeMs: 300_000,
    turnStartedAt: '2026-07-13T10:00:00.000Z',
  }
  const tournament = {
    $id: 't-latency',
    status: 'active',
    playMode: 'online',
    onlinePlatform: 'juchess',
    timeControl: '5+0 Blitz',
    format: 'Swiss',
  }
  const tablesDB = {
    getRow: async ({ tableId }) => tableId === 'games' ? game : tournament,
    updateRow: async ({ data }) => {
      game = { ...game, ...data }
      return game
    },
  }

  const receivedAtMs = Date.parse('2026-07-13T10:00:01.250Z')
  const outcome = await engine.submitHostedTournamentMove(
    tablesDB,
    'juchess',
    game.$id,
    { san: 'e4', expectedVersion: 0 },
    { $id: 'white' },
    receivedAtMs,
  )

  assert.equal(outcome.row.whiteTimeMs, 298_750)
  assert.equal(outcome.row.lastMoveAt, '2026-07-13T10:00:01.250Z')
  assert.equal(outcome.row.turnStartedAt, '2026-07-13T10:00:01.250Z')
})

test('active game selection keeps the player on the current board until it finishes', () => {
  const assignments = [
    { game: { $id: 'new-board', status: 'live' }, tournament: { $id: 't2' } },
    { game: { $id: 'current-board', status: 'live' }, tournament: { $id: 't1' } },
  ]

  assert.equal(
    engine.selectActiveHostedGame(assignments, 'current-board').game.$id,
    'current-board',
  )
  assert.equal(
    engine.selectActiveHostedGame(assignments, 'finished-board').game.$id,
    'new-board',
  )
  assert.equal(engine.selectActiveHostedGame([], 'current-board'), null)
})

test('round robin: every planned round has balanced color assignments', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const schedule = engine.buildRoundRobinSchedule(players, false, { initialColor: 'white' })
  const history = new Map(players.map((player) => [player, []]))

  for (const game of schedule) {
    history.get(game.whiteProfileId).push('white')
    history.get(game.blackProfileId).push('black')
  }

  assert.equal(schedule.length, 15)
  for (const colors of history.values()) {
    const whites = colors.filter((color) => color === 'white').length
    const blacks = colors.filter((color) => color === 'black').length
    assert.ok(Math.abs(whites - blacks) <= 1, `unbalanced history: ${colors.join(',')}`)
    assert.doesNotMatch(colors.join(''), /(white){3}|(black){3}/)
  }
})

test('double round robin: every rematch reverses White and Black', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const schedule = engine.buildRoundRobinSchedule(players, true, { initialColor: 'black' })
  const firstCycle = schedule.filter((game) => game.round <= 5)
  const secondCycle = schedule.filter((game) => game.round > 5)

  assert.equal(schedule.length, 30)
  for (const game of firstCycle) {
    const reverse = secondCycle.find((candidate) => (
      candidate.round === game.round + 5
      && candidate.whiteProfileId === game.blackProfileId
      && candidate.blackProfileId === game.whiteProfileId
    ))
    assert.ok(reverse, `missing color-reversed rematch for round ${game.round}, board ${game.board}`)
  }
})

test('generic first round changes colors with the drawn initial color', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const whiteDraw = engine.splitSeededPairings(players, { initialColor: 'white' })
  const blackDraw = engine.splitSeededPairings(players, { initialColor: 'black' })

  assert.deepEqual(
    blackDraw.map((game) => [game.whiteProfileId, game.blackProfileId]),
    whiteDraw.map((game) => [game.blackProfileId, game.whiteProfileId]),
  )
})

test('knockout snapshot uses the persisted game colors', () => {
  const entrants = ['p1', 'p2', 'p3', 'p4']
  const structure = engine.buildKnockoutStructure(entrants.length, false)
  const resolver = engine.knockoutResolver(structure, entrants, [])
  const firstRoundIndex = structure.winnersIndices[0]
  const firstMatch = structure.rounds[firstRoundIndex].matches[0]
  const structuralWhite = resolver.resolveRef(firstMatch.a).profileId
  const structuralBlack = resolver.resolveRef(firstMatch.b).profileId
  const game = {
    round: 1,
    board: resolver.boardOf(firstRoundIndex, 0),
    whiteProfileId: structuralBlack,
    blackProfileId: structuralWhite,
    status: 'scheduled',
    result: '*',
  }
  const names = new Map(entrants.map((profileId) => [profileId, `Name ${profileId}`]))
  const snapshot = JSON.parse(engine.buildKnockoutSnapshot(
    structure,
    entrants,
    [game],
    names,
    { format: 'Single elimination' },
  ))

  assert.equal(snapshot.rounds[0].matches[0].whiteProfileId, structuralBlack)
  assert.equal(snapshot.rounds[0].matches[0].blackProfileId, structuralWhite)
  assert.equal(snapshot.rounds[0].matches[0].white, `Name ${structuralBlack}`)
})
