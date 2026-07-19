import 'dart:async';

import 'package:appwrite/appwrite.dart';
import 'package:appwrite/models.dart' as models;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:juchess_mobile/main.dart';
import 'package:provider/provider.dart';

void main() {
  test('external player ratings require provider attribution', () {
    expect(hasExternalRating(1200, null), isFalse);
    expect(hasExternalRating(1812, 'chess.com:rapid'), isTrue);
    expect(externalRatingSourceLabel('chess.com:rapid'), 'Chess.com Rapid');

    final profile = PlayerProfileIdentity.fromRow({
      r'$id': 'profile-1',
      'rating': 1812,
      'ratingSource': 'chess.com:rapid',
    });
    expect(profile.rating, 1812);
    expect(profile.ratingSource, 'chess.com:rapid');
  });

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

  test('assigned online games expose only the active current round', () {
    final event = TournamentSeed(
      rowId: 'online-event',
      id: 'online-event',
      name: 'Online Swiss',
      meta: '',
      chips: const [],
      current: 'Round 1',
      format: 'Swiss',
      timeControl: '5+3 Blitz',
      players: 4,
      location: 'JuChess',
      playMode: 'online',
      onlinePlatform: 'juchess',
      description: '',
      status: 'active',
      currentRound: 1,
      publishedRounds: const [
        RoundSeed('Round 1', [
          MatchSeed(
            'Opponent',
            'Current player',
            '*',
            gameId: 'game-1',
            whiteProfileId: 'opponent-profile',
            blackProfileId: 'current-profile',
          ),
        ]),
        RoundSeed('Round 2', [
          MatchSeed(
            'Current player',
            'Future opponent',
            '*',
            gameId: 'game-2',
            whiteProfileId: 'current-profile',
            blackProfileId: 'future-profile',
          ),
        ]),
      ],
    );

    final assignments = findAssignedOnlineGames([event], 'current-profile');

    expect(assignments, hasLength(1));
    expect(assignments.single.match.gameId, 'game-1');
    expect(assignments.single.match.blackProfileId, 'current-profile');
    expect(assignments.single.round.label, 'Round 1');
  });

  test('upcoming online games are not playable yet', () {
    final upcoming = _seed('online-event', 'upcoming');
    expect(findAssignedOnlineGames([upcoming], 'current-profile'), isEmpty);
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

  testWidgets('published rounds preserve canonical board numbers and byes', (
    WidgetTester tester,
  ) async {
    final event = _seed('knockout', 'upcoming');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TournamentRoundPanel(
            event: event,
            round: const RoundSeed('Round 1', [
              MatchSeed(
                'Player One',
                'Bye',
                '1-0',
                board: 7,
                blackProfileId: 'system_bye',
              ),
            ]),
          ),
        ),
      ),
    );

    expect(find.text('#7'), findsOneWidget);
    expect(find.text('Bye'), findsOneWidget);
  });

  testWidgets('knockout UI never invents a missing bracket snapshot', (
    WidgetTester tester,
  ) async {
    final event = TournamentSeed(
      rowId: 'knockout',
      id: 'knockout',
      name: 'Official Knockout',
      meta: '',
      chips: const [],
      current: 'Round 1',
      format: 'Single Elimination',
      timeControl: '15+10 Rapid',
      players: 2,
      location: 'Hall B',
      description: '',
      status: 'upcoming',
      publishedRounds: const [
        RoundSeed('Round 1', [MatchSeed('Player One', 'Player Two', '-')]),
      ],
    );
    final state = AppState(AppwriteService(enabled: false))
      ..tournamentItems = [event];

    await tester.pumpWidget(
      _withState(state, TournamentDetailScreen(event: event)),
    );
    await tester.pump();
    await tester.tap(find.text('Bracket'));
    await tester.pump();

    expect(find.text('Bracket unavailable'), findsOneWidget);
    expect(
      find.textContaining('will not generate a replacement'),
      findsOneWidget,
    );
  });

  testWidgets('standings render only canonical backend values', (
    WidgetTester tester,
  ) async {
    final event = TournamentSeed(
      rowId: 'swiss',
      id: 'swiss',
      name: 'Official Swiss',
      meta: '',
      chips: const [],
      current: 'Round 4',
      format: 'Swiss',
      timeControl: '15+10 Rapid',
      players: 1,
      location: 'Hall B',
      description: '',
      status: 'upcoming',
      standings: const [
        TournamentStandingSeed(
          profileId: 'player-one',
          rank: 1,
          name: 'Player One',
          rating: 1640,
          points: 3.5,
          tieBreak: 8.25,
          played: 4,
          wins: 3,
          draws: 1,
          losses: 0,
        ),
      ],
    );
    final state = AppState(AppwriteService(enabled: false))
      ..tournamentItems = [event];

    await tester.pumpWidget(
      _withState(state, TournamentDetailScreen(event: event)),
    );
    await tester.pump();
    await tester.tap(find.text('Standings'));
    await tester.pump();

    expect(find.text('3.5'), findsOneWidget);
    expect(find.text('3-1-0'), findsOneWidget);
    expect(find.textContaining('1640'), findsNothing);
    expect(find.text('0-0-0'), findsNothing);
  });

  testWidgets(
    'mobile auth offers the real link and six-digit recovery methods',
    (WidgetTester tester) async {
      final state = AppState(AppwriteService(enabled: false));
      await tester.pumpWidget(
        _withState(state, const AuthFlowScreen(initialMode: AuthMode.signIn)),
      );
      await tester.pump();

      expect(find.textContaining('Continue with Apple'), findsNothing);
      expect(find.textContaining('Continue with Google'), findsNothing);
      await tester.tap(find.text('Forgot password?'));
      await tester.pump();

      expect(
        find.textContaining('Enter the email address tied'),
        findsOneWidget,
      );
      expect(find.textContaining('six-digit code'), findsOneWidget);
      expect(find.text('I already have a recovery code'), findsOneWidget);
      await tester.ensureVisible(find.text('I already have a recovery code'));
      await tester.tap(find.text('I already have a recovery code'));
      await tester.pump();

      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is AuthField && widget.label == 'Six-digit recovery code',
        ),
        findsOneWidget,
      );
      expect(
        find.byWidgetPredicate(
          (widget) => widget is AuthField && widget.label == 'New password',
        ),
        findsOneWidget,
      );
      expect(find.text('Update password'), findsOneWidget);
      expect(find.text('SMS'), findsNothing);
    },
  );

  testWidgets('saved analyses never show fabricated account data', (
    WidgetTester tester,
  ) async {
    final state = AppState(AppwriteService(enabled: false))
      ..userEmail = 'player@example.com';
    await tester.pumpWidget(_withState(state, const SavedAnalysesScreen()));
    await tester.pump();

    expect(find.text('Saved analyses unavailable'), findsOneWidget);
    expect(find.textContaining("King's Indian"), findsNothing);
  });

  test(
    'temporary verification sessions are deleted on success and failure',
    () async {
      final successEvents = <String>[];
      final result = await runWithTemporaryVerificationSession(
        createSession: () async => successEvents.add('create'),
        action: () async {
          successEvents.add('send');
          return 'sent';
        },
        deleteSession: () async => successEvents.add('delete'),
      );
      expect(result, 'sent');
      expect(successEvents, ['create', 'send', 'delete']);

      final failureEvents = <String>[];
      await expectLater(
        runWithTemporaryVerificationSession<void>(
          createSession: () async => failureEvents.add('create'),
          action: () async {
            failureEvents.add('send');
            throw StateError('send failed');
          },
          deleteSession: () async => failureEvents.add('delete'),
        ),
        throwsStateError,
      );
      expect(failureEvents, ['create', 'send', 'delete']);

      var deleteCalled = false;
      await expectLater(
        runWithTemporaryVerificationSession<void>(
          createSession: () async => throw StateError('network timeout'),
          action: () async {},
          deleteSession: () async => deleteCalled = true,
        ),
        throwsStateError,
      );
      expect(deleteCalled, isTrue);

      deleteCalled = false;
      await expectLater(
        runWithTemporaryVerificationSession<void>(
          createSession: () async => throw AppwriteException(
            'Session exists',
            409,
            'user_session_already_exists',
          ),
          action: () async {},
          deleteSession: () async => deleteCalled = true,
          shouldDeleteAfterCreateFailure: (error) =>
              error is! AppwriteException ||
              error.type != 'user_session_already_exists',
        ),
        throwsA(isA<AppwriteException>()),
      );
      expect(deleteCalled, isFalse);
    },
  );

  test('access guard fails closed and recovery hides unknown accounts', () {
    expect(
      () => validateAccessGuardResponse(const {'ok': true}, statusCode: 200),
      throwsA(isA<AppwriteException>()),
    );
    expect(
      () => validateAccessGuardResponse(const {
        'ok': true,
        'allowed': false,
        'reason': 'Blocked',
      }, statusCode: 200),
      throwsA(isA<AccountBlockedException>()),
    );
    expect(
      isUnknownAccountRecoveryError(
        AppwriteException('User was not found.', 404, 'user_not_found'),
      ),
      isTrue,
    );
    expect(
      isUnknownAccountRecoveryError(
        AppwriteException('Too many requests.', 429, 'rate_limit'),
      ),
      isFalse,
    );
  });

  test(
    'an in-flight function JWT is rejected after the session changes',
    () async {
      final cache = SessionScopedJwtCache();
      final mint = Completer<String>();
      final staleRequest = cache.get(() => mint.future);

      cache.clear();
      mint.complete('jwt-from-the-old-session');

      await expectLater(
        staleRequest,
        throwsA(
          isA<AppwriteException>().having(
            (error) => error.type,
            'type',
            'session_changed_during_jwt_mint',
          ),
        ),
      );
      expect(
        await cache.get(() async => 'jwt-from-the-new-session'),
        'jwt-from-the-new-session',
      );
    },
  );

  testWidgets(
    'signup returns check-email state without signing in or writing profile',
    (tester) async {
      final service = FakeMobileAuthService();
      final state = AppState(service);
      await tester.pump();

      final result = await state.signUp(
        'New Player',
        'new@example.com',
        'StrongPassword1!',
      );

      expect(result?.email, 'new@example.com');
      expect(result?.message, contains('two hours'));
      expect(state.signedIn, isFalse);
      expect(service.profileWrites, 0);
    },
  );

  testWidgets(
    'verified sign-in with no profile enters durable completion gate',
    (tester) async {
      final service = FakeMobileAuthService(
        lookup: const ProfileIdentityMissing(),
      );
      final state = AppState(service);
      await tester.pump();

      final signedIn = await state.signIn('player@example.com', 'password123');

      expect(signedIn, isTrue);
      expect(state.signedIn, isTrue);
      expect(state.needsProfileCompletion, isTrue);
      expect(state.profileId, isNull);
      expect(service.profileWrites, 0);
    },
  );

  testWidgets(
    'transient profile read failure is not treated as a missing profile',
    (tester) async {
      final service = FakeMobileAuthService(
        lookup: ProfileIdentityFailure(
          AppwriteException('Temporary server failure', 503),
        ),
      );
      final state = AppState(service);
      await tester.pump();

      final signedIn = await state.signIn('player@example.com', 'password123');

      expect(signedIn, isTrue);
      expect(state.profileLoadFailed, isTrue);
      expect(state.needsProfileCompletion, isFalse);
      expect(service.profileWrites, 0);
    },
  );

  testWidgets('profile completion writes only after verified user submission', (
    tester,
  ) async {
    final service = FakeMobileAuthService(
      lookup: const ProfileIdentityMissing(),
    );
    final state = AppState(service);
    await tester.pump();
    await state.signIn('player@example.com', 'password123');

    final completed = await state.completePlayerProfile(
      displayName: 'Player One',
      university: 'University of Jordan',
      universityId: '0201234',
      phone: '079 123 4567',
      chessComUsername: 'player_one',
    );

    expect(completed, isTrue);
    expect(service.profileWrites, 1);
    expect(state.profileGateState, ProfileGateState.ready);
    expect(state.profileId, 'profile-1');
  });

  testWidgets('verified missing-profile sessions are gated from the shell', (
    WidgetTester tester,
  ) async {
    final service = FakeMobileAuthService(
      lookup: const ProfileIdentityMissing(),
    );
    final state = AppState(service);
    await tester.pump();
    await state.signIn('player@example.com', 'password123');

    await tester.pumpWidget(_withState(state, const PrototypeShell()));
    await tester.pump();

    expect(find.text('Complete your player profile'), findsOneWidget);
    expect(find.text('player@example.com'), findsOneWidget);
    expect(find.text('e.g. Ibrahim Ahmad'), findsOneWidget);
    expect(find.text('Home'), findsNothing);
  });

  testWidgets('email signup collects only account credentials', (
    WidgetTester tester,
  ) async {
    final service = FakeMobileAuthService();
    final state = AppState(service);
    await tester.pump();
    await tester.pumpWidget(
      _withState(state, const AuthFlowScreen(initialMode: AuthMode.signUp)),
    );
    await tester.pump();

    expect(find.text('Create your player account'), findsOneWidget);
    expect(find.text('Enter full name'), findsOneWidget);
    expect(find.text('student@ju.edu.jo'), findsOneWidget);
    expect(find.text('07** *** ***'), findsNothing);
    expect(find.text('Enter University ID'), findsNothing);
    expect(find.text('Enter username'), findsNothing);
  });

  testWidgets(
    'failed tournament refresh preserves the last canonical snapshot',
    (tester) async {
      final service = FakeMobileAuthService();
      final state = AppState(service);
      await tester.pump();
      state.tournamentItems = [_seed('last-good', 'upcoming')];
      service.tournamentLoadError = StateError('offline');

      await state.refreshTournaments();

      expect(state.tournamentItems.single.rowId, 'last-good');
      expect(state.tournamentDataUnavailable, isTrue);
    },
  );
}

Widget _withState(AppState state, Widget child) =>
    ChangeNotifierProvider<AppState>.value(
      value: state,
      child: MaterialApp(home: child),
    );

class FakeMobileAuthService extends AppwriteService {
  FakeMobileAuthService({this.lookup = const ProfileIdentityMissing()})
    : super(enabled: false);

  ProfileIdentityLookup lookup;
  bool sessionAvailable = false;
  int profileWrites = 0;
  Object? tournamentLoadError;

  final models.User user = models.User(
    $id: 'account-1',
    $createdAt: '2026-01-01T00:00:00.000Z',
    $updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Player One',
    registration: '2026-01-01T00:00:00.000Z',
    status: true,
    labels: const [],
    passwordUpdate: '2026-01-01T00:00:00.000Z',
    email: 'player@example.com',
    phone: '',
    emailVerification: true,
    phoneVerification: false,
    mfa: false,
    prefs: models.Preferences(data: const {}),
    targets: const [],
    accessedAt: '2026-01-01T00:00:00.000Z',
  );

  @override
  bool get ready => true;

  @override
  Future<models.User> currentUser() async {
    if (!sessionAvailable) {
      throw AppwriteException('No session', 401, 'user_unauthorized');
    }
    return user;
  }

  @override
  Future<models.User> signIn({
    required String email,
    required String password,
  }) async {
    sessionAvailable = true;
    return user;
  }

  @override
  Future<EmailSignUpResult> signUp({
    required String name,
    required String email,
    required String password,
  }) async => EmailSignUpResult(email: email.trim());

  @override
  Future<void> signOut() async {
    sessionAvailable = false;
  }

  @override
  Future<ProfileIdentityLookup> loadProfileIdentity() async => lookup;

  @override
  Future<void> assertCurrentUserAllowed(
    models.User user,
    PlayerProfileIdentity profile,
  ) async {}

  @override
  Future<PlayerProfileIdentity> completePlayerProfile({
    required String displayName,
    required String university,
    required String universityId,
    required String phone,
    String? chessComUsername,
    String? lichessUsername,
  }) async {
    profileWrites += 1;
    final profile = PlayerProfileIdentity(
      profileId: 'profile-1',
      displayName: displayName,
      university: university,
      universityId: universityId,
      phone: phone,
      status: 'active',
      chessComUsername: chessComUsername,
      lichessUsername: lichessUsername,
    );
    lookup = ProfileIdentityFound(profile);
    return profile;
  }

  @override
  Future<Map<String, MyRegistrationInfo>> loadMyRegistrations(
    String profileId,
  ) async => const {};

  @override
  Future<List<TournamentSeed>> loadTournaments() async {
    final failure = tournamentLoadError;
    if (failure != null) throw failure;
    return const [];
  }
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
