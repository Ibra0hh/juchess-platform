import 'package:chess/chess.dart' as chess;

const _resultTokens = {'1-0', '0-1', '1/2-1/2', '*', 'live'};

List<String> parseStoredMoves(String? value) {
  final source = value?.trim();
  if (source == null || source.isEmpty) return const [];

  try {
    final game = chess.Chess();
    if (game.load_pgn(source)) {
      return game.getHistory().map((move) => move.toString()).toList();
    }
  } catch (_) {
    // Older rows may contain SAN move text rather than a complete PGN.
  }

  return _parseLegacyMoveText(source);
}

List<String> _parseLegacyMoveText(String source) {
  final game = chess.Chess();
  final tokens = _stripVariations(source)
      .replaceAll(RegExp(r'^\s*\[[^\]]*\]\s*$', multiLine: true), ' ')
      .replaceAll(RegExp(r'\{[^}]*\}'), ' ')
      .replaceAll(RegExp(r';[^\r\n]*'), ' ')
      .replaceAll(RegExp(r'\$\d+'), ' ')
      .split(RegExp(r'\s+'));

  for (final rawToken in tokens) {
    final token = rawToken
        .trim()
        .replaceFirst(RegExp(r'^\d+\.(\.\.)?'), '')
        .replaceFirst(RegExp(r'[!?]+$'), '');
    if (token.isEmpty || _resultTokens.contains(token)) continue;

    try {
      if (!game.move(token)) break;
    } catch (_) {
      break;
    }
  }

  return game.getHistory().map((move) => move.toString()).toList();
}

String _stripVariations(String source) {
  var result = source;
  var previous = '';
  while (result != previous) {
    previous = result;
    result = result.replaceAll(RegExp(r'\([^()]*\)'), ' ');
  }
  return result;
}
