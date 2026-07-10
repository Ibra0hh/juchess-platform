// Stockfish engine wrapper (browser).
//
// Runs the single-threaded niklasf/stockfish.js build in a Web Worker and
// speaks UCI. Single-threaded means no SharedArrayBuffer, so it works on a
// static host (GitHub Pages) with no COOP/COEP headers.
//
// UCI scores are relative to the side to move; everything downstream wants
// White's point of view, so we flip scores when it's Black to move.

import type { EngineLine, PositionEval } from './evaluation'

export type EvaluateOptions = {
  depth?: number
  multiPv?: number
  /** Called with partial results as the search deepens (for live analysis). */
  onUpdate?: (position: PositionEval) => void
  signal?: AbortSignal
}

export class ChessEngine {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private listeners = new Set<(line: string) => void>()

  /** Load and hand-shake the engine. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      try {
        const base = import.meta.env.BASE_URL || '/'
        this.worker = new Worker(`${base}engine/stockfish.js`)
        this.worker.onmessage = (event) => {
          const line = typeof event.data === 'string' ? event.data : event.data?.data ?? ''
          for (const listener of this.listeners) listener(line)
        }
        this.worker.onerror = (event) => reject(new Error(event.message || 'Engine failed to load.'))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Engine failed to load.'))
        return
      }

      void this.command('uci', 'uciok')
        .then(() => this.command('isready', 'readyok'))
        .then(() => resolve())
        .catch(reject)
    })
    return this.ready
  }

  get isReady(): boolean {
    return this.worker !== null
  }

  /** Evaluate a single position; resolves with the final result. */
  async evaluatePosition(fen: string, options: EvaluateOptions = {}): Promise<PositionEval> {
    await this.init()
    const depth = options.depth ?? 16
    const multiPv = options.multiPv ?? 3
    const blackToMove = fen.split(' ')[1] === 'b'

    const linesByPv = new Map<number, EngineLine>()
    let best: PositionEval = { fen, blackToMove, lines: [] }

    const send = this.getSender()
    send(`setoption name MultiPV value ${multiPv}`)
    send(`position fen ${fen}`)

    return new Promise<PositionEval>((resolve, reject) => {
      const abort = () => {
        this.off(onLine)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      options.signal?.addEventListener('abort', abort, { once: true })

      const onLine = (line: string) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const parsed = parseInfo(line, blackToMove)
          if (parsed) {
            linesByPv.set(parsed.multipv, parsed.line)
            best = { fen, blackToMove, lines: orderedLines(linesByPv) }
            options.onUpdate?.(best)
          }
        } else if (line.startsWith('bestmove')) {
          this.off(onLine)
          options.signal?.removeEventListener('abort', abort)
          resolve(best)
        }
      }

      this.on(onLine)
      send(`go depth ${depth}`)
    })
  }

  /**
   * Evaluate every position of a game for the review pipeline. Runs positions
   * sequentially on the single worker; `onProgress` fires 0..1 as it goes.
   */
  async evaluateGame(
    fens: string[],
    options: { depth?: number; multiPv?: number; onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
  ): Promise<PositionEval[]> {
    await this.init()
    const results: PositionEval[] = []
    for (let index = 0; index < fens.length; index += 1) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const evaluation = await this.evaluatePosition(fens[index], {
        depth: options.depth ?? 12,
        multiPv: options.multiPv ?? 2,
        signal: options.signal,
      })
      results.push(evaluation)
      options.onProgress?.(index + 1, fens.length)
    }
    return results
  }

  stop(): void {
    this.getSender()('stop')
  }

  quit(): void {
    this.worker?.postMessage('quit')
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.listeners.clear()
  }

  private on(listener: (line: string) => void) {
    this.listeners.add(listener)
  }

  private off(listener: (line: string) => void) {
    this.listeners.delete(listener)
  }

  private getSender() {
    return (message: string) => this.worker?.postMessage(message)
  }

  /** Send a command and resolve once a terminal token appears in engine output. */
  private command(message: string, until: string): Promise<void> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        if (line.includes(until)) {
          this.off(listener)
          resolve()
        }
      }
      this.on(listener)
      this.worker?.postMessage(message)
    })
  }
}

function orderedLines(linesByPv: Map<number, EngineLine>): EngineLine[] {
  return [...linesByPv.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line)
}

/** Parse a UCI `info ... pv ...` line into a White-POV engine line. */
function parseInfo(line: string, blackToMove: boolean): { multipv: number; line: EngineLine } | null {
  const tokens = line.split(/\s+/)
  const pvIndex = tokens.indexOf('pv')
  if (pvIndex === -1) return null

  const read = (key: string) => {
    const at = tokens.indexOf(key)
    return at === -1 ? undefined : tokens[at + 1]
  }

  const depth = Number(read('depth') ?? 0)
  const multipv = Number(read('multipv') ?? 1)
  const pv = tokens.slice(pvIndex + 1)

  const scoreIndex = tokens.indexOf('score')
  if (scoreIndex === -1) return null
  const scoreType = tokens[scoreIndex + 1]
  const scoreValue = Number(tokens[scoreIndex + 2])
  const flip = blackToMove ? -1 : 1

  const engineLine: EngineLine =
    scoreType === 'mate'
      ? { mate: scoreValue * flip, pv, depth }
      : { cp: scoreValue * flip, pv, depth }

  return { multipv, line: engineLine }
}
