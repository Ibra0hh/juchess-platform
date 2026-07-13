# Third-Party Notices

## Stockfish and Stockfish.js

JuChess uses Stockfish to evaluate chess positions for Game Review.

- Stockfish source: https://github.com/official-stockfish/Stockfish
- Browser build source: https://github.com/nmrugg/stockfish.js
- Browser build release: https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0
- Flutter wrapper source: https://github.com/ArjanAswal/Stockfish
- License: GNU General Public License version 3

The distributed engine license is included with the browser assets and with the
Flutter package. JuChess does not modify the Stockfish engine.

## Lichess Chess Openings

JuChess includes a generated, lazily loaded opening-name index based on the
Lichess chess-openings dataset.

- Source: https://github.com/lichess-org/chess-openings
- License: CC0 1.0 Universal / public domain dedication
- Included data: ECO codes, English opening names, move sequences, and derived
  standard-position keys

## Lichess Tablebase API

JuChess analysis can query the public Lichess tablebase HTTP API for supported
standard-chess endgames. No lila-tablebase server source is bundled into JuChess.

- API documentation: https://github.com/lichess-org/lila-tablebase#http-api
- Endpoint: https://tablebase.lichess.org/standard

## Chesskit Reference Boundary

Chesskit was reviewed only to understand the high-level product flow of a local
chess engine, per-position analysis, and post-processing into a game review.
No Chesskit source files, UI components, constants, or assets are included in
JuChess. JuChess has its own UCI adapter, scoring formula, thresholds, data
model, and user interface.
