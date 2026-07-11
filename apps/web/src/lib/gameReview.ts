import { Chess, type Color, type Square } from 'chess.js'

export type ReviewClassification =
  | 'Brilliant'
  | 'Great'
  | 'Book'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Miss'
  | 'Blunder'
  | 'Forced'

export type ReviewEngineStrength = 'quick' | 'balanced' | 'deep' | 'maximum'

export type ReviewEnginePreset = {
  depth: number
  hashMb: number
  id: ReviewEngineStrength
  label: string
}

export const reviewEnginePresets: ReviewEnginePreset[] = [
  { depth: 12, hashMb: 32, id: 'quick', label: 'Quick' },
  { depth: 16, hashMb: 64, id: 'balanced', label: 'Balanced' },
  { depth: 20, hashMb: 128, id: 'deep', label: 'Deep' },
  { depth: 24, hashMb: 128, id: 'maximum', label: 'Maximum' },
]

export const defaultReviewEngineStrength: ReviewEngineStrength = 'balanced'

export function getReviewEnginePreset(strength: ReviewEngineStrength) {
  return reviewEnginePresets.find((preset) => preset.id === strength)
    ?? reviewEnginePresets[1]
}

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
  whiteExpectedScore?: number
}

export type PositionReview = {
  bestMove?: string
  depth: number
  evaluation: number
  lines: EngineLine[]
  mate?: number
  whiteExpectedScore?: number
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

export type PositionAnalysisResult = PositionReview & {
  bestLineSan: string[]
}

type ReviewInput = {
  fen?: string
  moves?: string[]
  pgn?: string
}

export type ReviewGameIdentityInput = {
  fen?: string
  id: string
  key: string
  moves: string[]
  source: string
}

export function reviewGameIdentity(game: ReviewGameIdentityInput) {
  return [game.source, game.key, game.id, game.fen || '', game.moves.join(' ')].join('\n')
}

type ReviewOptions = {
  depth?: number
  onProgress?: (completed: number, total: number) => void
  signal?: AbortSignal
}

type PositionAnalysisInput = {
  fen?: string
  moves?: string[]
}

type ClassificationInput = {
  afterEvaluation: number
  afterExpectedScore?: number
  alternateEvaluation?: number
  alternateExpectedScore?: number
  beforeEvaluation: number
  beforeExpectedScore?: number
  bestMove?: string
  isBook?: boolean
  isSacrifice?: boolean
  legalMoves: number
  mover: Color
  playedMove: string
}

const standardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const engineFile = 'vendor/stockfish/stockfish-18-lite-single.js'
const openingBookLines = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6'],
  ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g7g6'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'e4e5', 'f6d7'],
  ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6'],
  ['e2e4', 'g8f6', 'e4e5', 'f6d5', 'd2d4', 'd7d6'],
  ['e2e4', 'e7e5', 'b1c3', 'g8f6', 'f2f4', 'd7d5'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5'],
  ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'g1f3', 'g8f6', 'e2e3'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3'],
  ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4', 'c7c5', 'e2e3'],
  ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5'],
  ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'g7g6'],
] as const

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

export function parseAnalysisPosition({
  fen = standardFen,
  moves = [],
}: PositionAnalysisInput) {
  const game = new Chess(fen)

  moves.forEach((move, index) => {
    try {
      game.move(move)
    } catch {
      throw new Error(`Move ${index + 1} (${move}) is not legal in this position.`)
    }
  })

  const history = game.history({ verbose: true })
  return {
    currentFen: game.fen(),
    initialFen: fen,
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
  afterExpectedScore,
  alternateEvaluation,
  alternateExpectedScore,
  beforeEvaluation,
  beforeExpectedScore,
  bestMove,
  isBook = false,
  isSacrifice = false,
  legalMoves,
  mover,
  playedMove,
}: ClassificationInput): ReviewClassification {
  if (isBook) return 'Book'
  if (legalMoves <= 1) return 'Forced'

  const before = beforeExpectedScore ?? expectedScore(beforeEvaluation, mover)
  const after = afterExpectedScore ?? expectedScore(afterEvaluation, mover)
  const loss = Math.max(0, before - after)
  const isBest = Boolean(bestMove && playedMove === bestMove)

  if (isBest && (alternateExpectedScore !== undefined || alternateEvaluation !== undefined)) {
    const alternative = alternateExpectedScore ?? expectedScore(alternateEvaluation as number, mover)
    const uniqueness = Math.max(0, before - alternative)
    if (isSacrifice && loss <= 0.025 && uniqueness >= 0.1) return 'Brilliant'
    if (uniqueness >= 0.14) return 'Great'
  }
  if (isBest) return 'Best'
  if (loss <= 0.025) return 'Excellent'
  if (loss <= 0.075) return 'Good'
  if (loss <= 0.17) return 'Inaccuracy'
  if (before >= 0.72 && after >= 0.28 && after <= 0.62) return 'Miss'
  if (loss <= 0.3) return 'Mistake'
  return 'Blunder'
}

export function isOpeningBookMove(moves: string[], index: number) {
  if (index < 0 || index >= 10 || index >= moves.length) return false
  const prefix = moves.slice(0, index + 1)
  return openingBookLines.some((line) => prefix.every((move, moveIndex) => line[moveIndex] === move))
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
    const wdl = readUciWdl(message)
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
      whiteExpectedScore: wdl
        ? sideMultiplier === 1 ? wdl.expectedScore : 1 - wdl.expectedScore
        : undefined,
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
    whiteExpectedScore: lines[0].whiteExpectedScore,
  }
}

export class StockfishReviewEngine {
  private activeReject?: (reason?: unknown) => void
  private disposed = false
  private initialized = false
  private lineHandler: ((line: string) => void) | null = null
  private readonly options: { hashMb?: number; multiPv?: number }
  private worker: Worker | null = null

  constructor(options: { hashMb?: number; multiPv?: number } = {}) {
    this.options = options
  }

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
      `setoption name MultiPV value ${this.options.multiPv ?? 2}`,
      `setoption name Hash value ${this.options.hashMb ?? 64}`,
      'setoption name UCI_ShowWDL value true',
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
      Math.max(45_000, depth * 4_000),
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

export async function analyzePosition(
  input: PositionAnalysisInput,
  engine: StockfishReviewEngine,
  depth = getReviewEnginePreset(defaultReviewEngineStrength).depth,
): Promise<PositionAnalysisResult> {
  const parsed = parseAnalysisPosition(input)
  await engine.newGame()
  const result = await engine.evaluatePosition(
    parsed.initialFen,
    parsed.uciMoves,
    parsed.currentFen,
    depth,
  )

  return {
    ...result,
    bestLineSan: formatUciLineAsSan(
      parsed.currentFen,
      result.lines[0]?.moves ?? [],
    ),
  }
}

export async function reviewGame(
  input: ReviewInput,
  engine: StockfishReviewEngine,
  { depth = getReviewEnginePreset(defaultReviewEngineStrength).depth, onProgress, signal }: ReviewOptions = {},
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
    const beforeExpected = positionExpectedScore(before, mover)
    const afterExpected = positionExpectedScore(after, mover)
    const loss = Math.max(
      0,
      beforeExpected - afterExpected,
    )
    const classification = classifyReviewMove({
      afterEvaluation: after.evaluation,
      afterExpectedScore: afterExpected,
      alternateEvaluation: before.lines[1]?.evaluation,
      alternateExpectedScore: before.lines[1]
        ? lineExpectedScore(before.lines[1], mover)
        : undefined,
      beforeEvaluation: before.evaluation,
      beforeExpectedScore: beforeExpected,
      bestMove: before.bestMove,
      isBook:
        parsed.initialFen === standardFen &&
        isOpeningBookMove(parsed.uciMoves, index),
      isSacrifice: isPotentialSacrifice(parsed.fens[index], parsed.uciMoves[index]),
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

function isPotentialSacrifice(fen: string, uci: string) {
  if (uci.length < 4) return false
  const game = new Chess(fen)
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const movingPiece = game.get(from)
  const capturedPiece = game.get(to)
  if (!movingPiece) return false

  try {
    game.move({ from, promotion: uci.slice(4, 5) || undefined, to })
  } catch {
    return false
  }

  const exposed = game.moves({ verbose: true }).some((move) => move.to === to)
  return exposed && pieceValue(movingPiece.type) - pieceValue(capturedPiece?.type) >= 2
}

function pieceValue(piece?: string) {
  if (piece === 'q') return 9
  if (piece === 'r') return 5
  if (piece === 'b' || piece === 'n') return 3
  if (piece === 'p') return 1
  return 0
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

function readUciWdl(message: string) {
  const tokens = message.split(/\s+/)
  const index = tokens.indexOf('wdl')
  if (index < 0 || index + 3 >= tokens.length) return undefined
  const wins = Number.parseInt(tokens[index + 1], 10)
  const draws = Number.parseInt(tokens[index + 2], 10)
  const losses = Number.parseInt(tokens[index + 3], 10)
  if (![wins, draws, losses].every(Number.isFinite)) return undefined
  const total = wins + draws + losses
  if (total <= 0) return undefined
  return { expectedScore: (wins + draws / 2) / total }
}

function positionExpectedScore(position: PositionReview, mover: Color) {
  const white = position.whiteExpectedScore ?? expectedScore(position.evaluation, 'w')
  return mover === 'w' ? white : 1 - white
}

function lineExpectedScore(line: EngineLine, mover: Color) {
  const white = line.whiteExpectedScore ?? expectedScore(line.evaluation, 'w')
  return mover === 'w' ? white : 1 - white
}

function terminalPosition(winner: -1 | 0 | 1): PositionReview {
  const evaluation = winner === 0 ? 0 : winner > 0 ? 100 : -100
  const mate = winner === 0 ? undefined : winner
  return {
    depth: 0,
    evaluation,
    lines: [{
      depth: 0,
      evaluation,
      mate,
      moves: [],
      multiPv: 1,
      whiteExpectedScore: winner === 0 ? 0.5 : winner > 0 ? 1 : 0,
    }],
    mate,
    whiteExpectedScore: winner === 0 ? 0.5 : winner > 0 ? 1 : 0,
  }
}
