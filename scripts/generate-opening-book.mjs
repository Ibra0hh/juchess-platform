import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Chess } from 'chess.js'

const sourceBase = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master'
const outputPath = resolve('apps/web/public/data/chess-openings.json')
const files = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']

const positions = Object.create(null)
const sequences = Object.create(null)
const positionOrigins = new Map()
let openingCount = 0

for (const file of files) {
  const response = await fetch(`${sourceBase}/${file}`)
  if (!response.ok) throw new Error(`Could not download ${file}: HTTP ${response.status}`)
  const rows = (await response.text()).trim().split(/\r?\n/).slice(1)

  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t')
    if (!eco || !name || !pgn) continue

    const game = new Chess()
    game.loadPgn(pgn)
    const uci = game.history({ verbose: true })
      .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
      .join(' ')
    const identity = [eco, name]
    const key = positionKey(game.fen())

    const existing = positionOrigins.get(key)
    if (existing && (existing.identity[0] !== eco || existing.identity[1] !== name)) {
      sequences[existing.uci] = existing.identity
      sequences[uci] = identity
    } else if (!existing) {
      positions[key] = identity
      positionOrigins.set(key, { identity, uci })
    }
    openingCount += 1
  }
}

const payload = {
  license: 'CC0-1.0',
  openingCount,
  positions,
  sequences,
  source: 'https://github.com/lichess-org/chess-openings',
  version: 1,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, JSON.stringify(payload))
console.log(`Generated ${openingCount} openings at ${outputPath}`)

function positionKey(fen) {
  return fen.split(/\s+/).slice(0, 4).join(' ')
}
