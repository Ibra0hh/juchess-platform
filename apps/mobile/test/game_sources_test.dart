import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:juchess_mobile/main.dart';

const testPgn = '''[Event "JU Test"]
[Site "https://example.test/mobile-game-1"]
[Date "2026.07.10"]
[Round "1"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[WhiteElo "1700"]
[BlackElo "1650"]
[Opening "Ruy Lopez"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0''';

void main() {
  test('loads recent Chess.com games by username', () async {
    final client = _DelayedClient((request) {
      if (request.url.path.endsWith('/archives')) {
        return http.Response(
          jsonEncode({
            'archives': [
              'https://api.chess.com/pub/player/alice/games/2026/07',
            ],
          }),
          200,
        );
      }
      return http.Response(
        jsonEncode({
          'games': [
            {
              'black': {'rating': 1650, 'username': 'Bob'},
              'end_time': 1783641600,
              'pgn': testPgn,
              'rules': 'chess',
              'time_class': 'rapid',
              'url': 'https://www.chess.com/game/live/123456',
              'white': {'rating': 1700, 'username': 'Alice'},
            },
          ],
        }),
        200,
      );
    });

    final games = await loadMobileExternalGames(
      MobileGameSource.chessCom,
      'Alice',
      clientFactory: () => client,
    );

    expect(client.calls, 2);
    expect(client.closed, isTrue);
    expect(games, hasLength(1));
    expect(games.first.white, 'Alice');
    expect(games.first.black, 'Bob');
    expect(games.first.event, 'Ruy Lopez');
    expect(games.first.parsed?.moves, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  });

  test(
    'uses Chess.com game URLs when PGN Site is only the provider name',
    () async {
      final providerSitePgn = testPgn.replaceFirst(
        '[Site "https://example.test/mobile-game-1"]',
        '[Site "Chess.com"]',
      );
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/archives')) {
          return http.Response(
            jsonEncode({
              'archives': [
                'https://api.chess.com/pub/player/alice/games/2026/07',
              ],
            }),
            200,
          );
        }
        return http.Response(
          jsonEncode({
            'games': [
              {
                'end_time': 1783641602,
                'pgn': providerSitePgn,
                'rules': 'chess',
                'url': 'https://www.chess.com/game/live/222222',
              },
              {
                'end_time': 1783641601,
                'pgn': providerSitePgn,
                'rules': 'chess',
                'url': 'https://www.chess.com/game/live/111111',
              },
            ],
          }),
          200,
        );
      });

      final games = await loadMobileExternalGames(
        MobileGameSource.chessCom,
        'Alice',
        client: client,
      );

      expect(games.map((game) => game.id), ['222222', '111111']);
    },
  );

  test('loads Lichess NDJSON games by username', () async {
    final lichessPgn = testPgn.replaceAll('Ruy Lopez', 'Sämisch Attack');
    final client = MockClient(
      (_) async => http.Response.bytes(
        utf8.encode(
          '${jsonEncode({
            'createdAt': 1783641600000,
            'id': 'abc12345',
            'opening': {'name': 'Sämisch Attack'},
            'pgn': lichessPgn,
            'players': {
              'black': {
                'rating': 1650,
                'user': {'name': 'Bob'},
              },
              'white': {
                'rating': 1700,
                'user': {'name': 'Alice'},
              },
            },
            'variant': 'standard',
          })}\n',
        ),
        200,
        headers: {'content-type': 'application/x-ndjson'},
      ),
    );

    final games = await loadMobileExternalGames(
      MobileGameSource.lichess,
      'Alice',
      client: client,
    );

    expect(games, hasLength(1));
    expect(games.first.result, '1-0');
    expect(games.first.event, 'Sämisch Attack');
    expect(games.first.whiteRating, 1700);
  });

  test('reports external usernames that do not exist', () async {
    final client = MockClient((_) async => http.Response('', 404));

    await expectLater(
      loadMobileExternalGames(
        MobileGameSource.lichess,
        'missing-user',
        client: client,
      ),
      throwsA(
        isA<MobileGameImportException>().having(
          (error) => error.message,
          'message',
          contains('not found'),
        ),
      ),
    );
  });
}

class _DelayedClient extends http.BaseClient {
  _DelayedClient(this.handler);

  final http.Response Function(http.BaseRequest request) handler;
  bool closed = false;
  int calls = 0;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    await Future<void>.delayed(const Duration(milliseconds: 2));
    if (closed) {
      throw http.ClientException('Client is already closed.', request.url);
    }
    calls += 1;
    final response = handler(request);
    return http.StreamedResponse(
      Stream.value(response.bodyBytes),
      response.statusCode,
      headers: response.headers,
      reasonPhrase: response.reasonPhrase,
      request: request,
    );
  }

  @override
  void close() {
    closed = true;
    super.close();
  }
}
