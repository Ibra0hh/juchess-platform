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
]

const SDK_STUB = `
const stub = () => { throw new Error('appwrite SDK called in a pure-logic test') };
const Account = stub, Client = stub, TablesDB = stub, Teams = stub, Users = stub;
const ID = { unique: () => 'stub' };
const Permission = { read: () => 'stub' };
const Role = { any: () => 'stub', user: () => 'stub' };
const Query = { equal: stub, limit: stub, notEqual: stub };
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

test('round counts', () => {
  assert.equal(engine.swissRoundsTotal({ roundsTotal: 0 }, 20), 6)
  assert.equal(engine.swissRoundsTotal({ roundsTotal: 9 }, 20), 9, 'an explicit count wins')
  assert.equal(engine.multiStageStageOneRounds({ roundsTotal: 5 }, 8), 2)
  assert.equal(engine.multiStageStageOneRounds({ roundsTotal: 0 }, 8), 3, 'defaults to three qualifying rounds')
})
