import { Chess } from 'chess.js'

export type TablebaseCategory =
  | 'win'
  | 'unknown'
  | 'syzygy-win'
  | 'maybe-win'
  | 'cursed-win'
  | 'draw'
  | 'blessed-loss'
  | 'maybe-loss'
  | 'syzygy-loss'
  | 'loss'

export type TablebaseMove = {
  category: TablebaseCategory
  dtm: number | null
  dtz: number | null
  san: string
  uci: string
}

export type TablebaseProbe = {
  category: TablebaseCategory
  dtm: number | null
  dtz: number | null
  exact: boolean
  moves: TablebaseMove[]
  pieceCount: number
  sideToMove: 'white' | 'black'
  winner: 'white' | 'black' | 'draw' | 'unknown'
}

type ProbeOptions = {
  fetcher?: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
}

const endpoint = 'https://tablebase.lichess.org/standard'
const successfulProbeCache = new Map<string, TablebaseProbe>()

export function isTablebaseEligible(fen: string) {
  try {
    const game = new Chess(fen)
    return pieceCount(game.fen()) <= 7
  } catch {
    return false
  }
}

export async function probeTablebase(fen: string, options: ProbeOptions = {}) {
  if (!isTablebaseEligible(fen)) return null
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new DOMException('Tablebase request cancelled.', 'AbortError')
  }
  const normalizedFen = new Chess(fen).fen()
  const cached = successfulProbeCache.get(normalizedFen)
  if (cached) return cached

  const controller = new AbortController()
  const handleAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', handleAbort, { once: true })
  const timer = globalThis.setTimeout(() => {
    controller.abort(new DOMException('Tablebase request timed out.', 'TimeoutError'))
  }, options.timeoutMs ?? 6_000)

  try {
    const response = await (options.fetcher ?? fetch)(
      `${endpoint}?fen=${encodeURIComponent(normalizedFen)}`,
      { signal: controller.signal },
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Tablebase request failed: HTTP ${response.status}`)
    const payload = await response.json() as {
      category?: TablebaseCategory
      dtm?: number | null
      dtz?: number | null
      moves?: TablebaseMove[]
    }
    if (!payload.category || !Array.isArray(payload.moves)) {
      throw new Error('Tablebase returned an invalid response.')
    }

    const sideToMove = normalizedFen.split(/\s+/)[1] === 'b' ? 'black' : 'white'
    const probe: TablebaseProbe = {
      category: payload.category,
      dtm: numberOrNull(payload.dtm),
      dtz: numberOrNull(payload.dtz),
      exact: isExactCategory(payload.category),
      moves: payload.moves,
      pieceCount: pieceCount(normalizedFen),
      sideToMove,
      winner: tablebaseWinner(payload.category, sideToMove),
    }
    successfulProbeCache.set(normalizedFen, probe)
    return probe
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', handleAbort)
  }
}

export function tablebaseWinner(
  category: TablebaseCategory,
  sideToMove: 'white' | 'black',
): TablebaseProbe['winner'] {
  if (category === 'draw' || category === 'cursed-win' || category === 'blessed-loss') return 'draw'
  if (category === 'win') return sideToMove
  if (category === 'loss') return sideToMove === 'white' ? 'black' : 'white'
  return 'unknown'
}

function isExactCategory(category: TablebaseCategory) {
  return category === 'win'
    || category === 'loss'
    || category === 'draw'
    || category === 'cursed-win'
    || category === 'blessed-loss'
}

function pieceCount(fen: string) {
  return (fen.split(' ')[0].match(/[prnbqk]/gi) ?? []).length
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
