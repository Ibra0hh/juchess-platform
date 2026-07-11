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
    const fen =
        'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    final parsed = parseMobileStockfishOutput([
      'info depth 11 multipv 1 score cp 42 nodes 100 pv g8f6',
      'info depth 11 multipv 2 score cp 30 nodes 100 pv b8c6',
      'bestmove g8f6',
    ], fen);

    expect(parsed.evaluation, -0.42);
    expect(parsed.lines[1].evaluation, -0.3);
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
  });
}
