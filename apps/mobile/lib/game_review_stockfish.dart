import 'dart:async';
import 'dart:io';

import 'package:chess/chess.dart' as chess;
import 'package:stockfish/stockfish.dart';

import 'game_review_core.dart';

const _maxCachedMobilePositions = 256;
final _mobilePositionReviewCache = <String, MobilePositionReview>{};

class MobileReviewCancelled implements Exception {
  const MobileReviewCancelled();
}

class MobileStockfishReviewEngine {
  MobileStockfishReviewEngine._(this._stockfish, this.preset) {
    _subscription = _stockfish.stdout.listen(_handleOutput);
  }

  final Stockfish _stockfish;
  final MobileReviewEnginePreset preset;
  late final StreamSubscription<String> _subscription;
  Completer<List<String>>? _activeCompleter;
  bool Function(String line)? _isComplete;
  List<String> _messages = [];
  Timer? _timeout;
  bool _disposed = false;

  static Future<MobileStockfishReviewEngine> create({
    MobileReviewEnginePreset? preset,
  }) async {
    final resolvedPreset =
        preset ?? mobileReviewPresetFor(defaultMobileReviewStrength);
    final stockfish = await stockfishAsync();
    final engine = MobileStockfishReviewEngine._(stockfish, resolvedPreset);
    final threads = Platform.numberOfProcessors >= 4 ? 2 : 1;
    await engine._exchange(['uci'], (line) => line == 'uciok');
    await engine._exchange([
      'setoption name MultiPV value 2',
      'setoption name Hash value ${resolvedPreset.hashMb}',
      'setoption name Threads value $threads',
      'setoption name UCI_ShowWDL value true',
      'isready',
    ], (line) => line == 'readyok');
    return engine;
  }

  Future<MobileGameReviewResult> review(
    MobileParsedReviewGame game, {
    int? depth,
    bool Function()? isCancelled,
    void Function(int completed, int total)? onProgress,
  }) async {
    final resolvedDepth = depth ?? preset.depth;
    await _exchange(['ucinewgame', 'isready'], (line) => line == 'readyok');
    final positions = <MobilePositionReview>[];

    for (var index = 0; index < game.fens.length; index++) {
      if (isCancelled?.call() == true) throw const MobileReviewCancelled();
      positions.add(
        await evaluatePosition(
          game.initialFen,
          game.uciMoves.sublist(0, index),
          game.fens[index],
          resolvedDepth,
        ),
      );
      onProgress?.call(index + 1, game.fens.length);
    }

    return buildMobileGameReview(
      depth: resolvedDepth,
      game: game,
      positions: positions,
    );
  }

  Future<MobilePositionReview> evaluatePosition(
    String initialFen,
    List<String> moves,
    String fen,
    int depth,
  ) async {
    final board = chess.Chess.fromFEN(fen);
    if (board.in_checkmate) {
      return _terminalPosition(board.turn == chess.Color.BLACK ? 1 : -1);
    }
    if (board.in_draw) return _terminalPosition(0);

    final cacheKey = '$depth|2|$fen';
    final cached = _mobilePositionReviewCache.remove(cacheKey);
    if (cached != null) {
      _mobilePositionReviewCache[cacheKey] = cached;
      return cached;
    }

    final position = initialFen == mobileStandardFen
        ? 'position startpos${moves.isEmpty ? '' : ' moves ${moves.join(' ')}'}'
        : 'position fen $initialFen${moves.isEmpty ? '' : ' moves ${moves.join(' ')}'}';
    final messages = await _exchange(
      [position, 'go depth $depth'],
      (line) => line.startsWith('bestmove '),
      timeout: Duration(seconds: depth * 4 < 45 ? 45 : depth * 4),
    );
    final result = parseMobileStockfishOutput(messages, fen);
    _mobilePositionReviewCache[cacheKey] = result;
    if (_mobilePositionReviewCache.length > _maxCachedMobilePositions) {
      _mobilePositionReviewCache.remove(_mobilePositionReviewCache.keys.first);
    }
    return result;
  }

  Future<List<String>> _exchange(
    List<String> commands,
    bool Function(String line) isComplete, {
    Duration timeout = const Duration(seconds: 20),
  }) {
    if (_disposed) return Future.error(const MobileReviewCancelled());
    if (_activeCompleter != null) {
      return Future.error(StateError('Stockfish received overlapping jobs.'));
    }

    final completer = Completer<List<String>>();
    _activeCompleter = completer;
    _isComplete = isComplete;
    _messages = [];
    _timeout = Timer(timeout, () {
      _completeError(
        TimeoutException('Stockfish did not answer before the timeout.'),
      );
    });
    for (final command in commands) {
      _stockfish.stdin = command;
    }
    return completer.future;
  }

  void _handleOutput(String output) {
    for (final line in output.split(RegExp(r'\r?\n'))) {
      if (line.isEmpty || _activeCompleter == null) continue;
      _messages.add(line);
      if (_isComplete?.call(line) == true) {
        final result = List<String>.from(_messages);
        final completer = _activeCompleter!;
        _clearActive();
        completer.complete(result);
      }
    }
  }

  void _completeError(Object error) {
    final completer = _activeCompleter;
    if (completer == null) return;
    _clearActive();
    completer.completeError(error);
  }

  void _clearActive() {
    _timeout?.cancel();
    _timeout = null;
    _activeCompleter = null;
    _isComplete = null;
    _messages = [];
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _completeError(const MobileReviewCancelled());
    _subscription.cancel();
    try {
      _stockfish.stdin = 'stop';
      _stockfish.dispose();
    } catch (_) {
      // The native isolate may already have closed after an engine error.
    }
  }
}

MobilePositionReview _terminalPosition(int winner) {
  final evaluation = winner == 0
      ? 0.0
      : winner > 0
      ? 100.0
      : -100.0;
  final mate = winner == 0 ? null : winner;
  return MobilePositionReview(
    depth: 0,
    evaluation: evaluation,
    lines: [
      MobileEngineLine(
        depth: 0,
        evaluation: evaluation,
        mate: mate,
        moves: const [],
        multiPv: 1,
        whiteExpectedScore: winner == 0
            ? 0.5
            : winner > 0
            ? 1
            : 0,
      ),
    ],
    mate: mate,
    whiteExpectedScore: winner == 0
        ? 0.5
        : winner > 0
        ? 1
        : 0,
  );
}
