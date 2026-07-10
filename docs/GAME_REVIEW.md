# Game Review & Analysis (Stockfish + Chess.com import)

Added Jul 11, 2026. Free, client-side, no server cost. Web is built; mobile is
phase 2 (plan below).

## What a player gets (web, `/analysis`)

- A dark wood board (matches the reference screenshots), eval bar, and live
  Stockfish analysis of the current position with the top engine lines.
- Load a game by pasting **PGN** or importing from a **Chess.com username**.
- **Review game** → every move labelled Brilliant / Great / Best / Excellent /
  Good / Book / Inaccuracy / Mistake / Miss / Blunder, per-side **accuracy**,
  and an **estimated rating** — the Chess.com-style recap.

## How it works (the important part)

Everything lives in `apps/web/src/lib/review/` and is **framework-agnostic and
unit-tested** (29 tests, `npm run test --workspace apps/web`), so the same brain
can drive mobile later:

| File | Responsibility |
| --- | --- |
| `evaluation.ts` | Lichess win% from centipawns/mate; eval formatting |
| `accuracy.ts` | Lichess move accuracy; harmonic-blended game accuracy; estimated Elo |
| `classification.ts` | Win%-delta → Chess.com labels, plus book/best/only-move/sacrifice special cases |
| `reviewGame.ts` | chess.js parsing + sacrifice detection, wired to engine + brain (evaluator injected → testable) |
| `engine.ts` | UCI Web Worker around Stockfish; White-POV scores; live + full-game eval |
| `chesscom.ts` | Key-free Chess.com archive API import |

### Why single-threaded Stockfish

GitHub Pages cannot send the `COOP`/`COEP` headers that multi-threaded WASM
(SharedArrayBuffer) requires. So the bundled engine
(`apps/web/public/engine/stockfish.*`, the niklasf single-threaded build) runs in
one Web Worker with no special headers. It is an older Stockfish, plenty strong
for club-level review. Depths default to 18 (live) and 12 (full-game review) to
keep it responsive; raise them for stronger analysis.

## Verified / not yet verified

- ✅ `tsc` build passes; 29/29 review unit tests pass; Chess.com API shape
  confirmed against the live endpoint; `/analysis` code-splits into its own chunk.
- ⚠️ **In-browser engine smoke test was NOT run this session** — browser
  automation was unavailable. The worker follows the standard UCI protocol
  against a known-good single-threaded build, but nobody has watched it return a
  `bestmove` in the live app yet.

### 20-second manual check

```
npm run dev:web       # then open http://localhost:5173/analysis
```

Paste a PGN (or type a Chess.com username → Import → pick a game). Expect the
eval bar to move and engine lines to appear within a second or two, then click
**Review game** and watch the recap fill in. If the eval bar never moves, open
devtools console: a worker/asset path error there is the thing to fix.

## Phase 2 — mobile (Flutter)

The Dart side is a separate build, not done yet. Plan:

1. **Engine**: add the `stockfish` pub package (bundled native Stockfish via
   FFI). It speaks the same UCI protocol as `engine.ts`, so the parsing logic
   ports directly.
2. **Brain**: port `evaluation.ts` / `accuracy.ts` / `classification.ts` to Dart
   — they are pure math with no dependencies, a near-mechanical translation, and
   the vitest cases become the Dart test cases.
3. **Chess**: the Dart `chess` package (already a mobile dependency) covers PGN
   parsing and sacrifice detection, mirroring the chess.js usage here.
4. **Chess.com import**: same public API, plain `http` GET.
5. **UI**: reuse the mobile board; add the eval bar + recap.

## Not done / honest gaps

- No opening **book** database: "Book" is a conservative heuristic (early, quiet,
  engine-approved moves). A real ECO/opening table would sharpen it.
- **Miss** and **Brilliant** are heuristic (Chess.com's exact rules are
  proprietary). They are gated conservatively to avoid false positives.
- Reviews are not persisted (no IndexedDB cache yet); each review re-runs the
  engine.
- Lichess import was intentionally left out for now (Chess.com only).
