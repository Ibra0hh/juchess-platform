import { Chess, type Color, type Square } from 'chess.js'

export type ReviewClassification =
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder'
  | 'Forced'

export type ParsedReviewGame = {
  fens: string[]
  headers: Record<string, string>
  initialFen: string
  moves: string[]
  uciMoves: string[]
}

export type EngineLine = {
  depth: number
  evaluation: number
  mate?: number
  moves: string[]
  multiPv: number
}

export type PositionReview = {
  bestMove?: string
  depth: number
  evaluation: number
  lines: EngineLine[]
  mate?: number
}

export type ReviewedMove = {
  accuracy: number
  bestLine: string[]
  bestMove?: string
  bestMoveSan?: string
  classification: ReviewClassification
  evaluation: number
  loss: number
  san: string
  uci: string
}

export type GameReviewResult = {
  blackAccuracy: number
  depth: number
  moves: ReviewedMove[]
  positions: PositionReview[]
  whiteAccuracy: number
}

type ReviewInput = {
  fen?: string
  moves?: string[]
  pgn?: string
}

type ReviewOptions = {
  depth?: number
  onProgress?: (completed: number, total: number) => void
  signal?: AbortSignal
}

type ClassificationInput = {
  afterEvaluation: number
  alternateEvaluation?: number
  beforeEvaluation: number
  bestMove?: string
  legalMoves: number
  mover: Color
  playedMove: string
}

const standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const engineFile = 'vendor/stockfish/stockfish-18-lite-single.js'

export function parseReviewGame({ fen = standardFen, moves = [], pgn }: ReviewInput): ParsedReviewGame {
  const game = new Chess()

  if (pgn?.trim()) {
    game.loadPgn(pgn, { strict: false })
  } else {
    game.load(fen)
    moves.forEach((move, index) => {
      try {
        game.move(move)
      } catch {
        throw new Error(`Move ${index + 1} (${move}) is not legal in this game.`)
      }
    })
  }

  const history = game.history({ verbose: true })
  if (!history.length) {
    throw new Error('The game does not contain any moves to review.')
  }

  const initialFen = history[0].before
  return {
    fens: [initialFen, ...history.map((move) => move.after)],
    headers: game.getHeaders(),
    initialFen,
    moves: history.map((move) => move.san),
    uciMoves: history.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`),
  }
}

export function expectedScore(evaluation: number, color: Color) {
  const bounded = Math.max(-12, Math.min(12, evaluation))
  const whiteScore = 1 / (1 + Math.exp(-1.35 * bounded))
  return color === 'w' ? whiteScore : 1 - whiteScore
}

export function moveAccuracyFromLoss(loss: number) {
  return Math.max(0, Math.min(100, 100 * Math.exp(-3.5 * Math.max(0, loss))))
}

export function classifyReviewMove({
  afterEvaluation,
  alternateEvaluation,
  beforeEvaluation,
  bestMove,
  legalMoves,
  mover,
  playedMove,
}: ClassificationInput): ReviewClassification {
  if (legalMoves <= 1) return 'Forced'

  const before = expectedScore(beforeEvaluation, mover)
  const after = expectedScore(afterEvaluation, mover)
  const loss = Math.max(0, before - after)
  const isBest = Boolean(bestMove && playedMove === bestMove)

  if (isBest && alternateEvaluation !== undefined) {
    const alternative = expectedScore(alternateEvaluation, mover)
    if (before - alternative >= 0.12) return 'Great'
  }
  if (isBest) return 'Best'
  if (loss <= 0.015) return 'Excellent'
  if (loss <= 0.05) return 'Good'
  if (loss <= 0.12) return 'Inaccuracy'
  if (loss <= 0.25) return 'Mistake'
  return 'Blunder'
}

export function parseStockfishOutput(messages: string[], fen: string): PositionReview {
  const sideMultiplier = fen.split(/\s+/)[1] === 'b' ? -1 : 1
  const latest = new Map<number, EngineLine>()
  let bestMove: string | undefined

  messages.forEach((message) => {
    if (message.startsWith('bestmove ')) {
      const candidate = message.split(/\s+/)[1]
      if (candidate && candidate !== '(none)') bestMove = candidate
      return
    }
    if (!message.startsWith('info ') || !message.includes(' score ') || !message.includes(' pv ')) return

    const depth = readUciNumber(message, 'depth')
    const multiPv = readUciNumber(message, 'multipv') ?? 1
    const cp = readUciNumber(message, 'cp')
    const rawMate = readUciNumber(message, 'mate')
    const pvIndex = message.split(/\s+/).indexOf('pv')
    if (depth === undefined || pvIndex < 0 || (cp === undefined && rawMate === undefined)) return

    const tokens = message.split(/\s+/)
    const mate = rawMate === undefined ? undefined : rawMate * sideMultiplier
    const evaluation = mate === undefined
      ? (cp as number) * sideMultiplier / 100
      : mate > 0
        ? 100
        : -100
    const line: EngineLine = {
      depth,
      evaluation,
      mate,
      moves: tokens.slice(pvIndex + 1),
      multiPv,
    }
    const previous = latest.get(multiPv)
    if (!previous || line.depth >= previous.depth) latest.set(multiPv, line)
  })

  const lines = Array.from(latest.values()).sort((a, b) => a.multiPv - b.multiPv)
  if (!lines.length) throw new Error('Stockfish returned no usable evaluation for this position.')

  return {
    bestMove,
    depth: Math.max(...lines.map((line) => line.depth)),
    evaluation: lines[0].evaluation,
    lines,
    mate: lines[0].mate,
  }
}

export class StockfishReviewEngine {
  private activeReject?: (reason?: unknown) => void
  private disposed = false
  private initialized = false
  private lineHandler: ((line: string) => void) | null = null
  private worker: Worker | null = null

  async initialize() {
    if (this.initialized) return
    if (this.disposed) throw new Error('The analysis engine has already been closed.')

    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    this.worker = new Worker(new URL(engineFile, baseUrl))
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      String(event.data)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => this.lineHandler?.(line))
    }
    this.worker.onerror = (event) => {
      this.activeReject?.(new Error(event.message || 'Stockfish failed to start.'))
    }

    await this.exchange(['uci'], (line) => line === 'uciok')
    await this.exchange([
      'setoption name MultiPV value 2',
      'setoption name Hash value 32',
      'isready',
    ], (line) => line === 'readyok')
    this.initialized = true
  }

  async newGame() {
    await this.initialize()
    await this.exchange(['ucinewgame', 'isready'], (line) => line === 'readyok')
  }

  async evaluatePosition(initialFen: string, moves: string[], fen: string, depth: number) {
    const board = new Chess(fen)
    if (board.isCheckmate()) {
      const whiteWon = board.turn() === 'b'
      return terminalPosition(whiteWon ? 1 : -1)
    }
    if (board.isDraw()) return terminalPosition(0)

    const position = initialFen === standardFen
      ? `position startpos${moves.length ? ` moves ${moves.join(' ')}` : ''}`
      : `position fen ${initialFen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`
    const messages = await this.exchange(
      [position, `go depth ${depth}`],
      (line) => line.startsWith('bestmove '),
      45_000,
    )
    return parseStockfishOutput(messages, fen)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.activeReject?.(new DOMException('Analysis cancelled.', 'AbortError'))
    this.lineHandler = null
    this.worker?.terminate()
    this.worker = null
  }

  private exchange(
    commands: string[],
    isComplete: (line: string) => boolean,
    timeoutMs = 20_000,
  ) {
    if (!this.worker) throw new Error('Stockfish is not initialized.')
    if (this.lineHandler) throw new Error('Stockfish received overlapping analysis jobs.')

    return new Promise<string[]>((resolve, reject) => {
      const messages: string[] = []
      const timer = window.setTimeout(() => {
        cleanup()
        reject(new Error('Stockfish did not answer before the analysis timeout.'))
      }, timeoutMs)
      const cleanup = () => {
        window.clearTimeout(timer)
        this.lineHandler = null
        this.activeReject = undefined
      }

      this.activeReject = (reason) => {
        cleanup()
        reject(reason)
      }
      this.lineHandler = (line) => {
        messages.push(line)
        if (!isComplete(line)) return
        cleanup()
        resolve(messages)
      }

      commands.forEach((command) => this.worker?.postMessage(command))
    })
  }
}

export async function reviewGame(
  input: ReviewInput,
  engine: StockfishReviewEngine,
  { depth = 11, onProgress, signal }: ReviewOptions = {},
): Promise<GameReviewResult> {
  const parsed = parseReviewGame(input)
  const positions: PositionReview[] = []
  await engine.newGame()

  for (let index = 0; index < parsed.fens.length; index += 1) {
    if (signal?.aborted) throw new DOMException('Analysis cancelled.', 'AbortError')
    positions.push(await engine.evaluatePosition(
      parsed.initialFen,
      parsed.uciMoves.slice(0, index),
      parsed.fens[index],
      depth,
    ))
    onProgress?.(index + 1, parsed.fens.length)
  }

  const reviewedMoves = parsed.moves.map((san, index): ReviewedMove => {
    const before = positions[index]
    const after = positions[index + 1]
    const mover = parsed.fens[index].split(/\s+/)[1] as Color
    const board = new Chess(parsed.fens[index])
    const loss = Math.max(
      0,
      expectedScore(before.evaluation, mover) - expectedScore(after.evaluation, mover),
    )
    const classification = classifyReviewMove({
      afterEvaluation: after.evaluation,
      alternateEvaluation: before.lines[1]?.evaluation,
      beforeEvaluation: before.evaluation,
      bestMove: before.bestMove,
      legalMoves: board.moves().length,
      mover,
      playedMove: parsed.uciMoves[index],
    })

    return {
      accuracy: moveAccuracyFromLoss(loss),
      bestLine: formatUciLineAsSan(parsed.fens[index], before.lines[0]?.moves ?? []),
      bestMove: before.bestMove,
      bestMoveSan: before.bestMove ? formatUciLineAsSan(parsed.fens[index], [before.bestMove])[0] : undefined,
      classification,
      evaluation: after.evaluation,
      loss: loss * 100,
      san,
      uci: parsed.uciMoves[index],
    }
  })

  return {
    blackAccuracy: playerAccuracy(reviewedMoves, 1),
    depth,
    moves: reviewedMoves,
    positions,
    whiteAccuracy: playerAccuracy(reviewedMoves, 0),
  }
}

export function formatUciLineAsSan(fen: string, moves: string[]) {
  const game = new Chess(fen)
  const san: string[] = []

  for (const uci of moves) {
    if (uci.length < 4) break
    try {
      const move = game.move({
        from: uci.slice(0, 2) as Square,
        promotion: uci.slice(4, 5) || undefined,
        to: uci.slice(2, 4) as Square,
      })
      san.push(move.san)
    } catch {
      break
    }
  }

  return san
}

function playerAccuracy(moves: ReviewedMove[], parity: 0 | 1) {
  const values = moves.filter((_move, index) => index % 2 === parity).map((move) => move.accuracy)
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function readUciNumber(message: string, key: string) {
  const tokens = message.split(/\s+/)
  const index = tokens.indexOf(key)
  if (index < 0 || index + 1 >= tokens.length) return undefined
  const value = Number.parseInt(tokens[index + 1], 10)
  return Number.isFinite(value) ? value : undefined
}

function terminalPosition(winner: -1 | 0 | 1): PositionReview {
  const evaluation = winner === 0 ? 0 : winner > 0 ? 100 : -100
  const mate = winner === 0 ? undefined : winner
  return {
    depth: 0,
    evaluation,
    lines: [{ depth: 0, evaluation, mate, moves: [], multiPv: 1 }],
    mate,
  }
}
