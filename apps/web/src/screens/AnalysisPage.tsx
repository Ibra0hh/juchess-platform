import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChessEngine } from '../lib/review/engine'
import { formatEval, positionWinPercent, type PositionEval } from '../lib/review/evaluation'
import { parsePgn, reviewGame, type GameReview } from '../lib/review/reviewGame'
import {
  CLASSIFICATION_META,
  CLASSIFICATION_ORDER,
  type Classification,
} from '../lib/review/classification'
import { loadChessComGames, ChessComError, type ImportedGame } from '../lib/review/chesscom'
import './AnalysisPage.css'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// Unicode glyphs; CSS colours them light/dark on the wood board.
const GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

function AnalysisPage() {
  const engineRef = useRef<ChessEngine | null>(null)
  const [fens, setFens] = useState<string[]>([START_FEN])
  const [sans, setSans] = useState<string[]>([])
  const [ply, setPly] = useState(0)
  const [livePos, setLivePos] = useState<PositionEval | null>(null)
  const [review, setReview] = useState<GameReview | null>(null)
  const [reviewProgress, setReviewProgress] = useState<number | null>(null)
  const [pgnText, setPgnText] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<ImportedGame[]>([])

  // One engine for the page's lifetime.
  useEffect(() => {
    const engine = new ChessEngine()
    engineRef.current = engine
    engine.init().catch(() => setLoadError('The analysis engine could not start in this browser.'))
    return () => engine.quit()
  }, [])

  const fen = fens[ply] ?? START_FEN

  // Live-analyse the current position whenever it changes.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const controller = new AbortController()
    setLivePos(null)
    engine
      .evaluatePosition(fen, { depth: 18, multiPv: 3, signal: controller.signal, onUpdate: setLivePos })
      .catch(() => undefined)
    return () => controller.abort()
  }, [fen])

  const loadPgn = useCallback((pgn: string) => {
    try {
      const parsed = parsePgn(pgn)
      setFens(parsed.fens)
      setSans(parsed.history.map((move) => move.san))
      setPly(0)
      setReview(null)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'That PGN could not be read.')
    }
  }, [])

  async function handleImport() {
    setImporting(true)
    setLoadError(null)
    setImported([])
    try {
      setImported(await loadChessComGames(username, 20))
    } catch (error) {
      setLoadError(error instanceof ChessComError ? error.message : 'Chess.com import failed.')
    } finally {
      setImporting(false)
    }
  }

  async function runReview() {
    const engine = engineRef.current
    if (!engine || fens.length < 2) return
    setReviewProgress(0)
    try {
      const result = await reviewGame(pgnFromState(), (positionFens) =>
        engine.evaluateGame(positionFens, {
          depth: 12,
          multiPv: 2,
          onProgress: (done, total) => setReviewProgress(done / total),
        }),
      )
      setReview(result)
    } catch {
      setLoadError('Review could not be completed.')
    } finally {
      setReviewProgress(null)
    }
  }

  // Rebuild a PGN from the loaded SANs for the review pipeline.
  const pgnFromState = useCallback(() => {
    if (pgnText.trim()) return pgnText
    let out = ''
    for (let i = 0; i < sans.length; i += 1) {
      if (i % 2 === 0) out += `${i / 2 + 1}. `
      out += `${sans[i]} `
    }
    return out.trim()
  }, [pgnText, sans])

  const classificationByPly = useMemo(() => {
    const map = new Map<number, Classification>()
    review?.moves.forEach((move) => map.set(move.ply, move.classification))
    return map
  }, [review])

  const currentClassification = ply > 0 ? classificationByPly.get(ply) : undefined
  const lastMoveSquares = useMemo(() => lastMove(fens[ply - 1], fen), [fens, ply, fen])
  const whiteWin = livePos ? positionWinPercent(livePos) : 50

  return (
    <div className="analysis-screen">
      <div className="analysis-main">
        <div>
          <Link to="/home" className="analysis-back">← Back to JuChess</Link>
          <div className="board-area">
            <div className="eval-bar" title="Evaluation">
              <div className="eval-bar-white" style={{ height: `${whiteWin}%` }} />
              <span className={`eval-bar-label ${whiteWin < 50 ? 'black' : ''}`}>
                {livePos ? formatEval(livePos) : ''}
              </span>
            </div>
            <div className="board-wrap">
              <Board fen={fen} lastMove={lastMoveSquares} classification={currentClassification} />
              <div className="board-toolbar">
                <button type="button" onClick={() => setPly(0)} disabled={ply === 0}>⏮</button>
                <button type="button" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>◀</button>
                <button type="button" onClick={() => setPly((p) => Math.min(fens.length - 1, p + 1))} disabled={ply >= fens.length - 1}>▶</button>
                <button type="button" onClick={() => setPly(fens.length - 1)} disabled={ply >= fens.length - 1}>⏭</button>
              </div>
            </div>
          </div>
        </div>

        <div className="analysis-panel">
          <EnginePanel livePos={livePos} />
          <LoadPanel
            pgnText={pgnText}
            setPgnText={setPgnText}
            onLoadPgn={() => loadPgn(pgnText)}
            username={username}
            setUsername={setUsername}
            onImport={handleImport}
            importing={importing}
            imported={imported}
            onPickImported={(game) => { setPgnText(game.pgn); loadPgn(game.pgn) }}
            error={loadError}
          />
          {sans.length > 0 ? (
            <div className="panel-block">
              <div className="panel-title">Moves</div>
              <MoveList sans={sans} ply={ply} onJump={setPly} classificationByPly={classificationByPly} />
              <button
                type="button"
                className="load-btn"
                style={{ marginTop: 12, width: '100%' }}
                onClick={runReview}
                disabled={reviewProgress !== null}
              >
                {reviewProgress !== null ? `Reviewing… ${Math.round(reviewProgress * 100)}%` : 'Review game'}
              </button>
              {reviewProgress !== null ? (
                <div className="review-bar"><span style={{ width: `${reviewProgress * 100}%` }} /></div>
              ) : null}
            </div>
          ) : null}
          {review ? <Recap review={review} /> : null}
        </div>
      </div>
    </div>
  )
}

function EnginePanel({ livePos }: { livePos: PositionEval | null }) {
  const best = livePos?.lines[0]
  const evalStr = livePos ? formatEval(livePos) : '…'
  const positive = evalStr.startsWith('-') ? false : true
  return (
    <div className="panel-block">
      <div className="panel-title">Analysis · Stockfish</div>
      <div className="engine-eval-row">
        <span className={`engine-eval ${positive ? 'plus' : 'minus'}`}>{evalStr}</span>
        <span className="engine-meta">{best ? `depth ${best.depth}` : 'starting engine…'}</span>
      </div>
      {livePos?.lines.slice(0, 3).map((line, index) => (
        <div className="engine-line" key={index}>
          <span className="lscore">{line.mate !== undefined ? `M${Math.abs(line.mate)}` : `${(line.cp ?? 0) >= 0 ? '+' : ''}${((line.cp ?? 0) / 100).toFixed(2)}`}</span>
          {line.pv.slice(0, 10).join(' ')}
        </div>
      ))}
    </div>
  )
}

function LoadPanel(props: {
  pgnText: string
  setPgnText: (value: string) => void
  onLoadPgn: () => void
  username: string
  setUsername: (value: string) => void
  onImport: () => void
  importing: boolean
  imported: ImportedGame[]
  onPickImported: (game: ImportedGame) => void
  error: string | null
}) {
  return (
    <div className="panel-block">
      <div className="panel-title">Load a game</div>
      <div className="load-row">
        <input
          placeholder="Chess.com username"
          value={props.username}
          onChange={(event) => props.setUsername(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && props.onImport()}
        />
        <button type="button" className="load-btn" onClick={props.onImport} disabled={props.importing}>
          {props.importing ? '…' : 'Import'}
        </button>
      </div>
      {props.imported.length > 0 ? (
        <div className="import-list">
          {props.imported.map((game) => (
            <button type="button" className="import-item" key={game.id} onClick={() => props.onPickImported(game)}>
              {game.whiteName} vs {game.blackName} · {game.result}
              <small>{game.timeClass} · {game.date}</small>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className="load-textarea"
        placeholder="…or paste PGN here"
        value={props.pgnText}
        onChange={(event) => props.setPgnText(event.target.value)}
      />
      <button type="button" className="load-btn" style={{ marginTop: 8, width: '100%' }} onClick={props.onLoadPgn}>
        Load PGN
      </button>
      {props.error ? <div className="load-error">{props.error}</div> : null}
    </div>
  )
}

function MoveList({
  sans,
  ply,
  onJump,
  classificationByPly,
}: {
  sans: string[]
  ply: number
  onJump: (ply: number) => void
  classificationByPly: Map<number, Classification>
}) {
  const cell = (movePly: number) => {
    const san = sans[movePly - 1]
    if (!san) return <div key={`e${movePly}`} />
    const cls = classificationByPly.get(movePly)
    const meta = cls ? CLASSIFICATION_META[cls] : undefined
    return (
      <button
        type="button"
        key={`m${movePly}`}
        className={`move-cell${ply === movePly ? ' current' : ''}`}
        onClick={() => onJump(movePly)}
      >
        {meta ? <span className="msym" style={{ color: meta.color }}>{meta.symbol}</span> : null}
        {san}
      </button>
    )
  }

  const rows = []
  for (let i = 0; i < sans.length; i += 2) {
    rows.push(
      <div className="move-num" key={`n${i}`}>{i / 2 + 1}.</div>,
      cell(i + 1),
      cell(i + 2),
    )
  }
  return <div className="move-list">{rows}</div>
}

function Recap({ review }: { review: GameReview }) {
  return (
    <div className="panel-block">
      <div className="panel-title">Game review</div>
      <div className="recap-head">
        <div />
        <div className="recap-acc">
          <div className="num">{review.white.accuracy.toFixed(1)}</div>
          <div className="lbl">Accuracy</div>
          <div className="who">White</div>
        </div>
        <div className="recap-acc">
          <div className="num">{review.black.accuracy.toFixed(1)}</div>
          <div className="lbl">Accuracy</div>
          <div className="who">Black</div>
        </div>
      </div>
      {CLASSIFICATION_ORDER.map((key) => {
        const meta = CLASSIFICATION_META[key]
        return (
          <div className="recap-row" key={key}>
            <div className="w">{review.white.counts[key]}</div>
            <div className="mid">
              <span className="recap-chip" style={{ background: meta.color }}>{meta.symbol}</span>
              <span className="recap-label">{meta.label}</span>
            </div>
            <div className="b">{review.black.counts[key]}</div>
          </div>
        )
      })}
      <div className="est-elo">
        Estimated rating — White {review.white.estimatedElo} · Black {review.black.estimatedElo}
      </div>
    </div>
  )
}

function Board({
  fen,
  lastMove,
  classification,
}: {
  fen: string
  lastMove: [string, string] | null
  classification?: Classification
}) {
  const board = fenToBoard(fen)
  const meta = classification ? CLASSIFICATION_META[classification] : undefined
  return (
    <div className="chessboard">
      {board.map((row, rankIndex) =>
        row.map((piece, fileIndex) => {
          const square = `${'abcdefgh'[fileIndex]}${8 - rankIndex}`
          const isLight = (rankIndex + fileIndex) % 2 === 0
          const isLast = lastMove?.includes(square)
          const showBadge = meta && lastMove && square === lastMove[1]
          return (
            <div className={`sq ${isLight ? 'light' : 'dark'}${isLast ? ' last-move' : ''}`} key={square}>
              {showBadge ? <span className="badge" style={{ background: meta!.color }}>{meta!.symbol}</span> : null}
              {piece ? (
                <span className={`piece ${piece === piece.toUpperCase() ? 'w' : 'b'}`}>{GLYPH[piece]}</span>
              ) : null}
            </div>
          )
        }),
      )}
    </div>
  )
}

// ---- small FEN helpers ----
function fenToBoard(fen: string): (string | null)[][] {
  const placement = fen.split(' ')[0]
  return placement.split('/').map((rank) => {
    const row: (string | null)[] = []
    for (const char of rank) {
      if (/\d/.test(char)) {
        for (let i = 0; i < Number(char); i += 1) row.push(null)
      } else {
        row.push(char)
      }
    }
    return row
  })
}

// Infer the from/to squares between two positions by diffing occupied squares.
function lastMove(prevFen: string | undefined, currentFen: string): [string, string] | null {
  if (!prevFen) return null
  const prev = squareMap(prevFen)
  const curr = squareMap(currentFen)
  let from: string | null = null
  let to: string | null = null
  for (const square of new Set([...Object.keys(prev), ...Object.keys(curr)])) {
    if (prev[square] && !curr[square]) from = square
    else if (curr[square] && curr[square] !== prev[square]) to = square
  }
  return from && to ? [from, to] : null
}

function squareMap(fen: string): Record<string, string> {
  const board = fenToBoard(fen)
  const map: Record<string, string> = {}
  board.forEach((row, rankIndex) =>
    row.forEach((piece, fileIndex) => {
      if (piece) map[`${'abcdefgh'[fileIndex]}${8 - rankIndex}`] = piece
    }),
  )
  return map
}

export default AnalysisPage
