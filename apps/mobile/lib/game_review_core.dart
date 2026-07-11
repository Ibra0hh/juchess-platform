import 'dart:math' as math;

import 'package:chess/chess.dart' as chess;

const mobileStandardFen =
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

enum MobileMoveClassification {
  brilliant,
  great,
  book,
  best,
  excellent,
  good,
  inaccuracy,
  mistake,
  miss,
  blunder,
  forced,
}

enum MobileReviewStrength { quick, balanced, deep, maximum }

class MobileReviewEnginePreset {
  const MobileReviewEnginePreset({
    required this.depth,
    required this.hashMb,
    required this.label,
    required this.strength,
  });

  final int depth;
  final int hashMb;
  final String label;
  final MobileReviewStrength strength;
}

const mobileReviewEnginePresets = <MobileReviewEnginePreset>[
  MobileReviewEnginePreset(
    depth: 12,
    hashMb: 32,
    label: 'Quick',
    strength: MobileReviewStrength.quick,
  ),
  MobileReviewEnginePreset(
    depth: 16,
    hashMb: 64,
    label: 'Balanced',
    strength: MobileReviewStrength.balanced,
  ),
  MobileReviewEnginePreset(
    depth: 20,
    hashMb: 128,
    label: 'Deep',
    strength: MobileReviewStrength.deep,
  ),
  MobileReviewEnginePreset(
    depth: 24,
    hashMb: 128,
    label: 'Maximum',
    strength: MobileReviewStrength.maximum,
  ),
];

const defaultMobileReviewStrength = MobileReviewStrength.balanced;

MobileReviewEnginePreset mobileReviewPresetFor(MobileReviewStrength strength) {
  return mobileReviewEnginePresets.firstWhere(
    (preset) => preset.strength == strength,
  );
}

int? nearestMobileEvaluationPoint({
  required List<double> evaluations,
  required double height,
  required double pointerX,
  required double pointerY,
  required double width,
  double hitRadius = 18,
}) {
  if (evaluations.isEmpty || width <= 0 || height <= 0) return null;

  final lastIndex = math.max(1, evaluations.length - 1);
  var closestIndex = 0;
  var closestDistanceSquared = double.infinity;
  for (var index = 0; index < evaluations.length; index++) {
    final x = index / lastIndex * width;
    final score = evaluations[index].clamp(-6.0, 6.0);
    final y = height / 2 - score / 6 * (height / 2 - 5);
    final xDistance = x - pointerX;
    final yDistance = y - pointerY;
    final distanceSquared = xDistance * xDistance + yDistance * yDistance;
    if (distanceSquared >= closestDistanceSquared) continue;
    closestIndex = index;
    closestDistanceSquared = distanceSquared;
  }

  return closestDistanceSquared <= hitRadius * hitRadius ? closestIndex : null;
}

const _mobileOpeningBookLines = <List<String>>[
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
];

class MobileParsedReviewGame {
  const MobileParsedReviewGame({
    required this.fens,
    required this.headers,
    required this.initialFen,
    required this.moves,
    required this.uciMoves,
  });

  final List<String> fens;
  final Map<String, String> headers;
  final String initialFen;
  final List<String> moves;
  final List<String> uciMoves;

  factory MobileParsedReviewGame.fromPgn(String pgn) {
    final game = chess.Chess();
    bool loaded;
    try {
      loaded = game.load_pgn(pgn);
    } catch (_) {
      loaded = false;
    }
    if (!loaded) {
      throw const FormatException(
        'The PGN contains an invalid or illegal move.',
      );
    }
    return MobileParsedReviewGame._fromGame(game);
  }

  factory MobileParsedReviewGame.fromMoves(
    List<String> moves, {
    String fen = mobileStandardFen,
  }) {
    final game = chess.Chess.fromFEN(fen);
    for (var index = 0; index < moves.length; index++) {
      if (!game.move(moves[index])) {
        throw FormatException(
          'Move ${index + 1} (${moves[index]}) is not legal in this game.',
        );
      }
    }
    return MobileParsedReviewGame._fromGame(game);
  }

  factory MobileParsedReviewGame._fromGame(chess.Chess game) {
    final states = List<chess.State>.from(game.history);
    if (states.isEmpty) {
      throw const FormatException(
        'The game does not contain any moves to review.',
      );
    }

    final verbose = game.getHistory({'verbose': true}).cast<Map>();
    final initialFen = game.header['FEN']?.toString() ?? mobileStandardFen;
    final replay = chess.Chess.fromFEN(initialFen);
    final fens = <String>[initialFen];
    final uciMoves = <String>[];

    for (final state in states) {
      final move = state.move;
      final promotion = move.promotion?.toString();
      final request = <String, String>{
        'from': move.fromAlgebraic,
        'to': move.toAlgebraic,
      };
      if (promotion != null) request['promotion'] = promotion;
      if (!replay.move(request)) {
        throw const FormatException('The game could not be reconstructed.');
      }
      uciMoves.add(
        '${move.fromAlgebraic}${move.toAlgebraic}${promotion ?? ''}',
      );
      fens.add(replay.fen);
    }

    return MobileParsedReviewGame(
      fens: fens,
      headers: game.header.map(
        (key, value) => MapEntry(key.toString(), value.toString()),
      ),
      initialFen: initialFen,
      moves: verbose.map((move) => move['san'].toString()).toList(),
      uciMoves: uciMoves,
    );
  }
}

class MobileEngineLine {
  const MobileEngineLine({
    required this.depth,
    required this.evaluation,
    required this.moves,
    required this.multiPv,
    this.mate,
    this.whiteExpectedScore,
  });

  final int depth;
  final double evaluation;
  final int? mate;
  final List<String> moves;
  final int multiPv;
  final double? whiteExpectedScore;
}

class MobilePositionReview {
  const MobilePositionReview({
    required this.depth,
    required this.evaluation,
    required this.lines,
    this.bestMove,
    this.mate,
    this.whiteExpectedScore,
  });

  final String? bestMove;
  final int depth;
  final double evaluation;
  final List<MobileEngineLine> lines;
  final int? mate;
  final double? whiteExpectedScore;
}

class MobileReviewedMove {
  const MobileReviewedMove({
    required this.accuracy,
    required this.bestLine,
    required this.classification,
    required this.evaluation,
    required this.loss,
    required this.san,
    required this.uci,
    this.bestMove,
    this.bestMoveSan,
  });

  final double accuracy;
  final List<String> bestLine;
  final String? bestMove;
  final String? bestMoveSan;
  final MobileMoveClassification classification;
  final double evaluation;
  final double loss;
  final String san;
  final String uci;
}

class MobileGameReviewResult {
  const MobileGameReviewResult({
    required this.blackAccuracy,
    required this.depth,
    required this.moves,
    required this.positions,
    required this.whiteAccuracy,
  });

  final double blackAccuracy;
  final int depth;
  final List<MobileReviewedMove> moves;
  final List<MobilePositionReview> positions;
  final double whiteAccuracy;
}

double mobileExpectedScore(double evaluation, String color) {
  final bounded = evaluation.clamp(-12.0, 12.0);
  final whiteScore = 1 / (1 + math.exp(-1.35 * bounded));
  return color == 'w' ? whiteScore : 1 - whiteScore;
}

double mobileMoveAccuracyFromLoss(double loss) {
  return (100 * math.exp(-3.5 * math.max(0, loss))).clamp(0.0, 100.0);
}

MobileMoveClassification classifyMobileReviewMove({
  required double afterEvaluation,
  required double beforeEvaluation,
  required int legalMoves,
  required String mover,
  required String playedMove,
  double? alternateEvaluation,
  double? afterExpectedScore,
  double? alternateExpectedScore,
  double? beforeExpectedScore,
  String? bestMove,
  bool isBook = false,
  bool isSacrifice = false,
}) {
  if (isBook) return MobileMoveClassification.book;
  if (legalMoves <= 1) return MobileMoveClassification.forced;

  final before =
      beforeExpectedScore ?? mobileExpectedScore(beforeEvaluation, mover);
  final after =
      afterExpectedScore ?? mobileExpectedScore(afterEvaluation, mover);
  final loss = math.max(0, before - after);
  final isBest = bestMove != null && playedMove == bestMove;

  if (isBest &&
      (alternateExpectedScore != null || alternateEvaluation != null)) {
    final alternative =
        alternateExpectedScore ??
        mobileExpectedScore(alternateEvaluation!, mover);
    final uniqueness = math.max(0, before - alternative);
    if (isSacrifice && loss <= 0.025 && uniqueness >= 0.1) {
      return MobileMoveClassification.brilliant;
    }
    if (uniqueness >= 0.14) return MobileMoveClassification.great;
  }
  if (isBest) return MobileMoveClassification.best;
  if (loss <= 0.025) return MobileMoveClassification.excellent;
  if (loss <= 0.075) return MobileMoveClassification.good;
  if (loss <= 0.17) return MobileMoveClassification.inaccuracy;
  if (before >= 0.72 && after >= 0.28 && after <= 0.62) {
    return MobileMoveClassification.miss;
  }
  if (loss <= 0.3) return MobileMoveClassification.mistake;
  return MobileMoveClassification.blunder;
}

bool isMobileOpeningBookMove(List<String> moves, int index) {
  if (index < 0 || index >= 10 || index >= moves.length) return false;
  final prefix = moves.sublist(0, index + 1);
  return _mobileOpeningBookLines.any((line) {
    for (var moveIndex = 0; moveIndex < prefix.length; moveIndex++) {
      if (moveIndex >= line.length || line[moveIndex] != prefix[moveIndex]) {
        return false;
      }
    }
    return true;
  });
}

MobilePositionReview parseMobileStockfishOutput(
  List<String> messages,
  String fen,
) {
  final sideMultiplier = fen.split(RegExp(r'\s+'))[1] == 'b' ? -1 : 1;
  final latest = <int, MobileEngineLine>{};
  String? bestMove;

  for (final message in messages) {
    if (message.startsWith('bestmove ')) {
      final candidate = message.split(RegExp(r'\s+'))[1];
      if (candidate != '(none)') bestMove = candidate;
      continue;
    }
    if (!message.startsWith('info ') ||
        !message.contains(' score ') ||
        !message.contains(' pv ')) {
      continue;
    }

    final depth = _readUciNumber(message, 'depth');
    final multiPv = _readUciNumber(message, 'multipv') ?? 1;
    final cp = _readUciNumber(message, 'cp');
    final rawMate = _readUciNumber(message, 'mate');
    final wdl = _readUciWdl(message);
    final tokens = message.split(RegExp(r'\s+'));
    final pvIndex = tokens.indexOf('pv');
    if (depth == null || pvIndex < 0 || (cp == null && rawMate == null)) {
      continue;
    }

    final mate = rawMate == null ? null : rawMate * sideMultiplier;
    final evaluation = mate == null
        ? cp! * sideMultiplier / 100
        : mate > 0
        ? 100.0
        : -100.0;
    final line = MobileEngineLine(
      depth: depth,
      evaluation: evaluation,
      mate: mate,
      moves: tokens.sublist(pvIndex + 1),
      multiPv: multiPv,
      whiteExpectedScore: wdl == null
          ? null
          : sideMultiplier == 1
          ? wdl
          : 1 - wdl,
    );
    final previous = latest[multiPv];
    if (previous == null || line.depth >= previous.depth) {
      latest[multiPv] = line;
    }
  }

  final lines = latest.values.toList()
    ..sort((a, b) => a.multiPv.compareTo(b.multiPv));
  if (lines.isEmpty) {
    throw const FormatException(
      'Stockfish returned no usable evaluation for this position.',
    );
  }

  return MobilePositionReview(
    bestMove: bestMove,
    depth: lines.map((line) => line.depth).reduce(math.max),
    evaluation: lines.first.evaluation,
    lines: lines,
    mate: lines.first.mate,
    whiteExpectedScore: lines.first.whiteExpectedScore,
  );
}

MobileGameReviewResult buildMobileGameReview({
  required int depth,
  required MobileParsedReviewGame game,
  required List<MobilePositionReview> positions,
}) {
  if (positions.length != game.moves.length + 1) {
    throw ArgumentError('Every move must have a before and after evaluation.');
  }

  final reviewedMoves = <MobileReviewedMove>[];
  for (var index = 0; index < game.moves.length; index++) {
    final before = positions[index];
    final after = positions[index + 1];
    final mover = game.fens[index].split(RegExp(r'\s+'))[1];
    final board = chess.Chess.fromFEN(game.fens[index]);
    final beforeExpected = _mobilePositionExpectedScore(before, mover);
    final afterExpected = _mobilePositionExpectedScore(after, mover);
    final loss = math.max(0, beforeExpected - afterExpected).toDouble();
    final classification = classifyMobileReviewMove(
      afterEvaluation: after.evaluation,
      afterExpectedScore: afterExpected,
      alternateEvaluation: before.lines.length > 1
          ? before.lines[1].evaluation
          : null,
      alternateExpectedScore: before.lines.length > 1
          ? _mobileLineExpectedScore(before.lines[1], mover)
          : null,
      beforeEvaluation: before.evaluation,
      beforeExpectedScore: beforeExpected,
      bestMove: before.bestMove,
      isBook:
          game.initialFen == mobileStandardFen &&
          isMobileOpeningBookMove(game.uciMoves, index),
      isSacrifice: _isMobilePotentialSacrifice(
        game.fens[index],
        game.uciMoves[index],
      ),
      legalMoves: board.moves().length,
      mover: mover,
      playedMove: game.uciMoves[index],
    );

    reviewedMoves.add(
      MobileReviewedMove(
        accuracy: mobileMoveAccuracyFromLoss(loss),
        bestLine: mobileUciLineAsSan(
          game.fens[index],
          before.lines.first.moves,
        ),
        bestMove: before.bestMove,
        bestMoveSan: before.bestMove == null
            ? null
            : mobileUciLineAsSan(game.fens[index], [
                before.bestMove!,
              ]).firstOrNull,
        classification: classification,
        evaluation: after.evaluation,
        loss: loss * 100,
        san: game.moves[index],
        uci: game.uciMoves[index],
      ),
    );
  }

  return MobileGameReviewResult(
    blackAccuracy: _playerAccuracy(reviewedMoves, 1),
    depth: depth,
    moves: reviewedMoves,
    positions: positions,
    whiteAccuracy: _playerAccuracy(reviewedMoves, 0),
  );
}

List<String> mobileUciLineAsSan(String fen, List<String> moves) {
  final game = chess.Chess.fromFEN(fen);
  final san = <String>[];

  for (final uci in moves) {
    if (uci.length < 4) break;
    final request = <String, String>{
      'from': uci.substring(0, 2),
      'to': uci.substring(2, 4),
    };
    if (uci.length > 4) request['promotion'] = uci.substring(4, 5);
    if (!game.move(request)) break;
    final history = game.getHistory({'verbose': true}).cast<Map>();
    san.add(history.last['san'].toString());
  }

  return san;
}

String mobileClassificationLabel(MobileMoveClassification classification) {
  return switch (classification) {
    MobileMoveClassification.brilliant => 'Brilliant',
    MobileMoveClassification.great => 'Great',
    MobileMoveClassification.book => 'Book',
    MobileMoveClassification.best => 'Best',
    MobileMoveClassification.excellent => 'Excellent',
    MobileMoveClassification.good => 'Good',
    MobileMoveClassification.inaccuracy => 'Inaccuracy',
    MobileMoveClassification.mistake => 'Mistake',
    MobileMoveClassification.miss => 'Miss',
    MobileMoveClassification.blunder => 'Blunder',
    MobileMoveClassification.forced => 'Forced',
  };
}

bool _isMobilePotentialSacrifice(String fen, String uci) {
  if (uci.length < 4) return false;
  final game = chess.Chess.fromFEN(fen);
  final from = uci.substring(0, 2);
  final to = uci.substring(2, 4);
  final movingPiece = game.get(from);
  final capturedPiece = game.get(to);
  if (movingPiece == null) return false;

  final request = <String, String>{'from': from, 'to': to};
  if (uci.length > 4) request['promotion'] = uci.substring(4, 5);
  if (!game.move(request)) return false;

  final exposed = game
      .moves({'verbose': true})
      .cast<Map>()
      .any((move) => move['to']?.toString() == to);
  return exposed &&
      _mobileReviewPieceValue(movingPiece.type) -
              _mobileReviewPieceValue(capturedPiece?.type) >=
          2;
}

int _mobileReviewPieceValue(chess.PieceType? type) {
  return switch (type) {
    chess.PieceType.QUEEN => 9,
    chess.PieceType.ROOK => 5,
    chess.PieceType.BISHOP || chess.PieceType.KNIGHT => 3,
    chess.PieceType.PAWN => 1,
    _ => 0,
  };
}

double _playerAccuracy(List<MobileReviewedMove> moves, int parity) {
  final values = <double>[];
  for (var index = parity; index < moves.length; index += 2) {
    values.add(moves[index].accuracy);
  }
  if (values.isEmpty) return 0;
  return values.reduce((a, b) => a + b) / values.length;
}

int? _readUciNumber(String message, String key) {
  final tokens = message.split(RegExp(r'\s+'));
  final index = tokens.indexOf(key);
  if (index < 0 || index + 1 >= tokens.length) return null;
  return int.tryParse(tokens[index + 1]);
}

double? _readUciWdl(String message) {
  final tokens = message.split(RegExp(r'\s+'));
  final index = tokens.indexOf('wdl');
  if (index < 0 || index + 3 >= tokens.length) return null;
  final wins = int.tryParse(tokens[index + 1]);
  final draws = int.tryParse(tokens[index + 2]);
  final losses = int.tryParse(tokens[index + 3]);
  if (wins == null || draws == null || losses == null) return null;
  final total = wins + draws + losses;
  if (total <= 0) return null;
  return (wins + draws / 2) / total;
}

double _mobilePositionExpectedScore(
  MobilePositionReview position,
  String mover,
) {
  final white =
      position.whiteExpectedScore ??
      mobileExpectedScore(position.evaluation, 'w');
  return mover == 'w' ? white : 1 - white;
}

double _mobileLineExpectedScore(MobileEngineLine line, String mover) {
  final white =
      line.whiteExpectedScore ?? mobileExpectedScore(line.evaluation, 'w');
  return mover == 'w' ? white : 1 - white;
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
