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

const here = dirname(fileURLToPath(import.meta.url))

const EXPORTED = [
  'bracketSizeFor',
  'bracketStageName',
  'openingKnockoutPairs',
  'buildKnockoutStructure',
  'knockoutGameRoundMap',
  'knockoutResolver',
  'buildSwissPairings',
  'seededKnockoutOrder',
  'swissRoundsTotal',
  'multiStageStageOneRounds',
  'isGameDecided',
  'decisiveWinnerProfileId',
  'knockoutRoundForGame',
  'assertResultAllowed',
  'normalizePhysicalBoards',
  'buildProcedureAssignments',
  'createTournamentGames',
  'configureTournamentProcedure',
  'startProcedureGame',
  'submitGameResult',
]

const SDK_STUB = `
const stub = () => { throw new Error('appwrite SDK called in a pure-logic test') };
const Account = stub, Client = stub, TablesDB = stub, Teams = stub, Users = stub;
const ID = { unique: () => 'stub' };
const Permission = { read: () => 'stub' };
const Role = { any: () => 'stub', user: () => 'stub' };
const Query = { equal: () => 'query', limit: () => 'query', notEqual: () => 'query' };
`

function loadEngine() {
  const source = readFileSync(join(here, '..', 'src', 'main.js'), 'utf8')
  const importLine = source.split('\n')[0]
  assert.match(importLine, /^import .* from 'node-appwrite';$/, 'expected the SDK import on line 1')

  const rewritten = source.replace(importLine, SDK_STUB) + `\nexport { ${EXPORTED.join(', ')} };\n`
  const file = join(mkdtempSync(join(tmpdir(), 'juchess-engine-')), 'engine.mjs')
  writeFileSync(file, rewritten)
  return import(pathToFileURL(file).href)
}

const engine = await loadEngine()

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

test('swiss: the drawn initial colour follows pairing-number parity', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const seeds = new Map(players.map((player, index) => [player, index + 1]))
  const { pairings } = engine.buildSwissPairings(players, [], seeds, 'system_bye', { initialColor: 'black' })

  for (const pairing of pairings) {
    const higher = seeds.get(pairing.whiteProfileId) < seeds.get(pairing.blackProfileId)
      ? pairing.whiteProfileId
      : pairing.blackProfileId
    const expected = seeds.get(higher) % 2 === 1 ? 'black' : 'white'
    assert.equal(
      pairing.whiteProfileId === higher ? 'white' : 'black',
      expected,
      `pairing number ${seeds.get(higher)} receives its prescribed first-round colour`,
    )
  }
})

test('swiss: two consecutive Whites force Black and two Blacks force White', () => {
  const players = ['a', 'b']
  const seeds = new Map([['a', 1], ['b', 2]])
  const games = [
    { round: 1, board: 1, whiteProfileId: 'a', blackProfileId: 'x', status: 'completed', result: '1/2-1/2' },
    { round: 1, board: 2, whiteProfileId: 'y', blackProfileId: 'b', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 1, whiteProfileId: 'a', blackProfileId: 'z', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 2, whiteProfileId: 'w', blackProfileId: 'b', status: 'completed', result: '1/2-1/2' },
  ]

  const { pairings } = engine.buildSwissPairings(players, games, seeds, 'system_bye', { initialColor: 'white' })
  assert.equal(pairings[0].whiteProfileId, 'b')
  assert.equal(pairings[0].blackProfileId, 'a')
})

test('swiss: equal colour preferences are granted to the higher-ranked player', () => {
  const players = ['a', 'b']
  const seeds = new Map([['a', 1], ['b', 2]])
  const games = [
    { round: 1, board: 1, whiteProfileId: 'a', blackProfileId: 'x1', status: 'completed', result: '1/2-1/2' },
    { round: 1, board: 2, whiteProfileId: 'b', blackProfileId: 'y1', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 1, whiteProfileId: 'x2', blackProfileId: 'a', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 2, whiteProfileId: 'y2', blackProfileId: 'b', status: 'completed', result: '1/2-1/2' },
    { round: 3, board: 1, whiteProfileId: 'a', blackProfileId: 'x3', status: 'completed', result: '1/2-1/2' },
    { round: 3, board: 2, whiteProfileId: 'b', blackProfileId: 'y3', status: 'completed', result: '1/2-1/2' },
  ]

  const { pairings } = engine.buildSwissPairings(players, games, seeds, 'system_bye', { initialColor: 'white' })
  assert.equal(pairings[0].whiteProfileId, 'b')
  assert.equal(pairings[0].blackProfileId, 'a', 'higher-ranked a receives its shared Black preference')
})

test('swiss: equal preferences use the most recent opposite-colour history', () => {
  const players = ['a', 'b']
  const seeds = new Map([['a', 1], ['b', 2]])
  const games = [
    { round: 1, board: 1, whiteProfileId: 'a', blackProfileId: 'x1', status: 'completed', result: '1/2-1/2' },
    { round: 1, board: 2, whiteProfileId: 'y1', blackProfileId: 'b', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 1, whiteProfileId: 'x2', blackProfileId: 'a', status: 'completed', result: '1/2-1/2' },
    { round: 2, board: 2, whiteProfileId: 'b', blackProfileId: 'y2', status: 'completed', result: '1/2-1/2' },
    { round: 3, board: 1, whiteProfileId: 'a', blackProfileId: 'x3', status: 'completed', result: '1/2-1/2' },
    { round: 3, board: 2, whiteProfileId: 'b', blackProfileId: 'y3', status: 'completed', result: '1/2-1/2' },
  ]

  const { pairings } = engine.buildSwissPairings(players, games, seeds, 'system_bye', { initialColor: 'white' })
  assert.equal(pairings[0].whiteProfileId, 'a', 'a alternates from its most recent opposite-colour round')
  assert.equal(pairings[0].blackProfileId, 'b')
})

test('swiss: four rounds stay colour-balanced without three identical colours in a row', () => {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const seeds = new Map(players.map((player, index) => [player, index + 1]))
  const games = []

  for (let round = 1; round <= 4; round += 1) {
    const { pairings } = engine.buildSwissPairings(players, games, seeds, 'system_bye', { initialColor: 'white' })
    assert.equal(pairings.length, 3)
    for (const pairing of pairings) {
      games.push({ round, ...pairing, status: 'completed', result: '1/2-1/2' })
    }
  }

  for (const player of players) {
    const colors = games
      .filter((game) => game.whiteProfileId === player || game.blackProfileId === player)
      .map((game) => game.whiteProfileId === player ? 'white' : 'black')
    const whites = colors.filter((color) => color === 'white').length
    const blacks = colors.length - whites
    assert.ok(Math.abs(whites - blacks) <= 2, `${player} remains within the FIDE colour-difference limit`)
    for (let index = 2; index < colors.length; index += 1) {
      assert.ok(
        !(colors[index] === colors[index - 1] && colors[index] === colors[index - 2]),
        `${player} never receives the same colour three times in succession`,
      )
    }
  }
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
    getRow: async () => ({ $id: 't1', currentRound: 1, physicalBoards: 2 }),
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

test('round counts', () => {
  assert.equal(engine.swissRoundsTotal({ roundsTotal: 0 }, 20), 6)
  assert.equal(engine.swissRoundsTotal({ roundsTotal: 9 }, 20), 9, 'an explicit count wins')
  assert.equal(engine.multiStageStageOneRounds({ roundsTotal: 5 }, 8), 2)
  assert.equal(engine.multiStageStageOneRounds({ roundsTotal: 0 }, 8), 3, 'defaults to three qualifying rounds')
})
