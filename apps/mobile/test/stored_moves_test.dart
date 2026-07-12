import 'package:flutter_test/flutter_test.dart';
import 'package:juchess_mobile/stored_moves.dart';

const oneMovePgn = '''[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]

1. e4 *''';

void main() {
  test('PGN headers do not count as chess moves', () {
    final moves = parseStoredMoves(oneMovePgn);
    expect(moves, ['e4']);
    expect(moves.length.isOdd, isTrue, reason: 'Black must move after e4');
  });

  test('turn returns to White after Black replies', () {
    final moves = parseStoredMoves(
      oneMovePgn.replaceFirst('1. e4 *', '1. e4 e5 *'),
    );
    expect(moves, ['e4', 'e5']);
    expect(moves.length.isEven, isTrue, reason: 'White must move after e5');
  });

  test('legacy move text is parsed as legal SAN only', () {
    expect(parseStoredMoves('1. e4 {first move} e5 2. Nf3!? Nc6 *'), [
      'e4',
      'e5',
      'Nf3',
      'Nc6',
    ]);
  });
}
