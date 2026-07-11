import 'package:flutter_test/flutter_test.dart';
import 'package:juchess_mobile/game_review_core.dart';

void main() {
  test('PGN parsing returns SAN, UCI, and one position per ply', () {
    final parsed = MobileParsedReviewGame.fromPgn(
      '[White "Ibrahim"]\n[Black "Sara"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *',
    );

    expect(parsed.moves, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
    expect(parsed.uciMoves, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    expect(parsed.fens.length, parsed.moves.length + 1);
    expect(parsed.headers['White'], 'Ibrahim');
  });

  test('UCI scores are normalized to White perspective', () {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    final parsed = parseMobileStockfishOutput([
      'info depth 11 multipv 1 score cp 42 wdl 700 200 100 nodes 100 pv g8f6',
      'info depth 11 multipv 2 score cp 30 wdl 650 250 100 nodes 100 pv b8c6',
      'bestmove g8f6',
    ], fen);

    expect(parsed.evaluation, -0.42);
    expect(parsed.lines[1].evaluation, -0.3);
    expect(parsed.whiteExpectedScore, closeTo(0.2, 0.0001));
    expect(parsed.bestMove, 'g8f6');
  });

  test('classification detects unique best moves and blunders', () {
    expect(
      classifyMobileReviewMove(
        afterEvaluation: 0.3,
        alternateEvaluation: -1.5,
        beforeEvaluation: 0.2,
        bestMove: 'e2e4',
        legalMoves: 20,
        mover: 'w',
        playedMove: 'e2e4',
      ),
      MobileMoveClassification.great,
    );
    expect(
      classifyMobileReviewMove(
        afterEvaluation: -4,
        beforeEvaluation: 0.4,
        bestMove: 'd2d4',
        legalMoves: 20,
        mover: 'w',
        playedMove: 'f2f3',
      ),
      MobileMoveClassification.blunder,
    );
    expect(
      classifyMobileReviewMove(
        afterEvaluation: 0.1,
        beforeEvaluation: 2,
        bestMove: 'd1h5',
        legalMoves: 24,
        mover: 'w',
        playedMove: 'a2a3',
      ),
      MobileMoveClassification.miss,
    );
    expect(
      classifyMobileReviewMove(
        afterEvaluation: 1.2,
        alternateEvaluation: -1,
        beforeEvaluation: 1.1,
        bestMove: 'f3h4',
        isSacrifice: true,
        legalMoves: 28,
        mover: 'w',
        playedMove: 'f3h4',
      ),
      MobileMoveClassification.brilliant,
    );
    expect(
      classifyMobileReviewMove(
        afterEvaluation: -0.5,
        afterExpectedScore: 0.52,
        beforeEvaluation: 0.8,
        beforeExpectedScore: 0.58,
        bestMove: 'g1f3',
        legalMoves: 22,
        mover: 'w',
        playedMove: 'b1c3',
      ),
      MobileMoveClassification.good,
    );
  });

  test('opening-book sequences are recognized', () {
    expect(
      isMobileOpeningBookMove(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'], 4),
      isTrue,
    );
    expect(isMobileOpeningBookMove(['h2h4'], 0), isFalse);
  });
}
