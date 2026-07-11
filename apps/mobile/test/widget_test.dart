import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juchess_mobile/main.dart';

void main() {
  testWidgets('home screen renders the club header and guest banner', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const JuChessApp(connectCloud: false));
    await tester.pump();

    expect(find.text('JuChess'), findsOneWidget);
    expect(find.text('University of Jordan Chess Club'), findsOneWidget);
    expect(find.text('Sign in to register and save analyses'), findsOneWidget);
  });

  testWidgets(
    'home carousel shows the empty upcoming slot without cloud data',
    (WidgetTester tester) async {
      await tester.pumpWidget(const JuChessApp(connectCloud: false));
      await tester.pump();

      // The carousel opens on the Upcoming slot. With nothing published it must
      // say so rather than invent a featured event.
      expect(find.text('No upcoming tournament'), findsOneWidget);
    },
  );

  group('buildHomeTournamentSlots', () {
    test('always offers upcoming, live and completed slots', () {
      final slots = buildHomeTournamentSlots(const []);

      expect(slots.map((slot) => slot.filter).toList(), [
        'upcoming',
        'active',
        'completed',
      ]);
      expect(slots.every((slot) => slot.event == null), isTrue);
      expect(slots.first.emptyTitle, 'No upcoming tournament');
    });

    test('places each tournament in the slot matching its status', () {
      final slots = buildHomeTournamentSlots([
        _seed('live-event', 'active'),
        _seed('next-event', 'upcoming'),
        _seed('old-event', 'completed'),
      ]);

      expect(slots[0].event?.rowId, 'next-event');
      expect(slots[1].event?.rowId, 'live-event');
      expect(slots[2].event?.rowId, 'old-event');
    });

    test('leaves a slot empty when no tournament has that status', () {
      final slots = buildHomeTournamentSlots([_seed('next-event', 'upcoming')]);

      expect(slots[0].event?.rowId, 'next-event');
      expect(slots[1].event, isNull, reason: 'no active tournament exists');
      expect(slots[2].event, isNull, reason: 'no completed tournament exists');
    });
  });

  test('registration is available only for upcoming tournaments', () {
    expect(
      isTournamentRegistrationOpen(_seed('next-event', 'upcoming')),
      isTrue,
    );
    expect(
      isTournamentRegistrationOpen(_seed('live-event', 'active')),
      isFalse,
    );
    expect(
      isTournamentRegistrationOpen(_seed('finished-event', 'completed')),
      isFalse,
    );
  });

  testWidgets('evaluation can be removed from tournament game boards', (
    WidgetTester tester,
  ) async {
    Widget board({required bool showEvaluation}) => MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 360,
            height: 360,
            child: PrototypeChessBoard(
              flipped: false,
              moves: const [],
              readOnly: true,
              showEvaluation: showEvaluation,
              onChanged: (_, _) {},
            ),
          ),
        ),
      ),
    );

    await tester.pumpWidget(board(showEvaluation: false));
    expect(find.text('0.0'), findsNothing);

    await tester.pumpWidget(board(showEvaluation: true));
    expect(find.text('0.0'), findsOneWidget);
  });
}

TournamentSeed _seed(String rowId, String status) => TournamentSeed(
  rowId: rowId,
  id: rowId,
  name: rowId,
  meta: '',
  chips: const [],
  current: '',
  format: 'Swiss',
  timeControl: '15+10 Rapid',
  players: 0,
  location: 'Hall B',
  description: '',
  status: status,
);
