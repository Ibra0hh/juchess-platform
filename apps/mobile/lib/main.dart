import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:appwrite/appwrite.dart';
import 'package:appwrite/enums.dart' as enums;
import 'package:appwrite/models.dart' as models;
import 'package:chess/chess.dart' as chess;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OrientationPolicy(child: JuChessApp()));
}

class OrientationPolicy extends StatefulWidget {
  const OrientationPolicy({required this.child, super.key});

  final Widget child;

  @override
  State<OrientationPolicy> createState() => _OrientationPolicyState();
}

class _OrientationPolicyState extends State<OrientationPolicy>
    with WidgetsBindingObserver {
  static const _tabletMinWidthDp = 600;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _applyOrientation());
  }

  @override
  void didChangeMetrics() {
    _applyOrientation();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(SystemChrome.setPreferredOrientations(const []));
    super.dispose();
  }

  void _applyOrientation() {
    if (!mounted) return;

    final view = View.of(context);
    final widthDp = view.display.size.width / view.display.devicePixelRatio;
    final tablet = widthDp >= _tabletMinWidthDp;

    unawaited(
      SystemChrome.setPreferredOrientations(
        tablet ? const [] : const [DeviceOrientation.portraitUp],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class AppConfig {
  static const endpoint = String.fromEnvironment(
    'APPWRITE_ENDPOINT',
    defaultValue: 'https://cloud.appwrite.io/v1',
  );
  static const projectId = String.fromEnvironment(
    'APPWRITE_PROJECT_ID',
    defaultValue: 'juchess-platform',
  );
  static const databaseId = String.fromEnvironment(
    'APPWRITE_DATABASE_ID',
    defaultValue: 'juchess',
  );
  static const profilesTableId = String.fromEnvironment(
    'APPWRITE_PROFILES_TABLE_ID',
    defaultValue: 'profiles',
  );
  static const tournamentsTableId = String.fromEnvironment(
    'APPWRITE_TOURNAMENTS_TABLE_ID',
    defaultValue: 'tournaments',
  );
  static const registrationsTableId = String.fromEnvironment(
    'APPWRITE_REGISTRATIONS_TABLE_ID',
    defaultValue: 'registrations',
  );
  static const checkInsTableId = String.fromEnvironment(
    'APPWRITE_CHECK_INS_TABLE_ID',
    defaultValue: 'check_ins',
  );
  static const gamesTableId = String.fromEnvironment(
    'APPWRITE_GAMES_TABLE_ID',
    defaultValue: 'games',
  );
  static const accessGuardFunctionId = String.fromEnvironment(
    'APPWRITE_ACCESS_GUARD_FUNCTION_ID',
    defaultValue: 'access-guards',
  );
  static const playerFunctionId = String.fromEnvironment(
    'APPWRITE_PLAYER_FUNCTION_ID',
    defaultValue: 'player-actions',
  );
  static const recoveryUrl = String.fromEnvironment(
    'APPWRITE_RECOVERY_URL',
    defaultValue: 'https://juchess.ju.edu.jo/reset-password',
  );
}

class AppwriteService {
  AppwriteService({this.enabled = true}) {
    if (ready) {
      client.setEndpoint(AppConfig.endpoint).setProject(AppConfig.projectId);
    }
  }

  final bool enabled;
  final Client client = Client();
  late final Account account = Account(client);
  late final TablesDB tablesDB = TablesDB(client);
  late final Storage storage = Storage(client);
  late final Functions functions = Functions(client);

  bool get ready =>
      enabled &&
      AppConfig.endpoint.isNotEmpty &&
      AppConfig.projectId.isNotEmpty &&
      AppConfig.databaseId.isNotEmpty;

  Future<models.User> currentUser() {
    return account.get();
  }

  Future<Map<String, String?>> loadProfileIdentity(String accountId) async {
    try {
      final response = await tablesDB.listRows(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.profilesTableId,
        queries: [Query.equal('accountId', accountId), Query.limit(1)],
        total: false,
        ttl: 30,
      );

      if (response.rows.isEmpty) return <String, String?>{};
      final row = response.rows.first;
      final data = row.data;
      return {
        'profileId': row.$id,
        'displayName': data['displayName']?.toString(),
        'universityId': data['universityId']?.toString(),
        'phone': data['phone']?.toString(),
        'status': data['status']?.toString(),
      };
    } catch (_) {
      return <String, String?>{};
    }
  }

  Future<Map<String, String?>> loadProfileIdentityByEmail(String email) async {
    final normalizedEmail = email.trim();
    if (normalizedEmail.isEmpty) return <String, String?>{};

    try {
      final response = await tablesDB.listRows(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.profilesTableId,
        queries: [Query.equal('email', normalizedEmail), Query.limit(1)],
        total: false,
        ttl: 30,
      );

      if (response.rows.isEmpty) return <String, String?>{};
      final row = response.rows.first;
      final data = row.data;
      return {
        'profileId': row.$id,
        'displayName': data['displayName']?.toString(),
        'universityId': data['universityId']?.toString(),
        'phone': data['phone']?.toString(),
        'status': data['status']?.toString(),
      };
    } catch (_) {
      return <String, String?>{};
    }
  }

  Future<Map<String, String?>> ensureProfileIdentity(models.User user) async {
    var profile = await loadProfileIdentity(user.$id);
    if (profile['profileId'] != null) return profile;

    profile = await loadProfileIdentityByEmail(user.email);
    if (profile['profileId'] != null) return profile;

    await _createProfile(user);
    profile = await loadProfileIdentity(user.$id);
    if (profile['profileId'] != null) return profile;

    return loadProfileIdentityByEmail(user.email);
  }

  Future<Map<String, String?>> assertCurrentUserAllowed(
    models.User user,
  ) async {
    final profile = await ensureProfileIdentity(user);
    if (profile['status'] == 'suspended') {
      throw Exception('This account is blocked by club administration.');
    }

    await assertAccessAllowed(
      email: user.email,
      universityId: profile['universityId'],
      phone: profile['phone'],
    );
    return profile;
  }

  Future<models.User> signIn({
    required String email,
    required String password,
  }) async {
    await assertAccessAllowed(email: email);
    await account.createEmailPasswordSession(email: email, password: password);
    try {
      final user = await account.get();
      await assertCurrentUserAllowed(user);
      return user;
    } catch (_) {
      try {
        await signOut();
      } catch (_) {}
      rethrow;
    }
  }

  Future<models.User> signUp({
    required String name,
    required String email,
    required String password,
    String? universityId,
    String? phone,
  }) async {
    await assertAccessAllowed(
      email: email,
      universityId: universityId,
      phone: phone,
    );

    final user = await account.create(
      userId: ID.unique(),
      email: email,
      password: password,
      name: name,
    );

    await account.createEmailPasswordSession(email: email, password: password);
    await _createProfile(user, universityId: universityId, phone: phone);
    final currentUser = await account.get();
    await assertCurrentUserAllowed(currentUser);
    return currentUser;
  }

  Future<void> signOut() async {
    await account.deleteSession(sessionId: 'current');
  }

  Future<void> sendPasswordRecovery(String email) async {
    await account.createRecovery(email: email, url: AppConfig.recoveryUrl);
  }

  /// Registration writes go through the player-actions function. Clients cannot
  /// insert these rows: the server owns `profileId` and forces `pending`, so a
  /// player can neither approve themselves nor register for someone else.
  Future<Map<String, dynamic>> _runPlayerAction(
    String path, {
    Map<String, dynamic> body = const {},
  }) async {
    final execution = await functions.createExecution(
      functionId: AppConfig.playerFunctionId,
      body: jsonEncode(body),
      xasync: false,
      path: path,
      method: enums.ExecutionMethod.pOST,
      headers: {'content-type': 'application/json'},
    );

    final payload = jsonDecode(execution.responseBody);
    if (payload is! Map<String, dynamic>) {
      throw AppwriteException(
        'The club server returned an unreadable response.',
      );
    }
    if (execution.responseStatusCode >= 400 || payload['ok'] == false) {
      throw AppwriteException(
        payload['error']?.toString() ?? 'Could not update your registration.',
      );
    }
    return payload;
  }

  Future<void> registerForTournament({
    required String tournamentRowId,
    required String profileId,
  }) async {
    await _runPlayerAction(
      '/registrations',
      body: {'tournamentId': tournamentRowId},
    );
  }

  Future<void> cancelTournamentRegistration({
    required String tournamentRowId,
    required String profileId,
  }) async {
    final existing = await tablesDB.listRows(
      databaseId: AppConfig.databaseId,
      tableId: AppConfig.registrationsTableId,
      queries: [
        Query.equal('tournamentId', tournamentRowId),
        Query.equal('profileId', profileId),
        Query.limit(100),
      ],
      total: false,
      ttl: 0,
    );

    for (final row in existing.rows) {
      if (row.data['status'] == 'cancelled') continue;
      await _runPlayerAction('/registrations/${row.$id}/cancel');
    }
  }

  Future<Map<String, MyRegistrationInfo>> loadMyRegistrations(
    String profileId,
  ) async {
    final response = await tablesDB.listRows(
      databaseId: AppConfig.databaseId,
      tableId: AppConfig.registrationsTableId,
      queries: [
        Query.equal('profileId', profileId),
        Query.notEqual('status', 'cancelled'),
        Query.limit(500),
      ],
      total: false,
      ttl: 0,
    );

    // Check-in codes live in a table with no public read; row permissions mean
    // this query returns only the signed-in player's own passes.
    final passes = <String, Map<String, dynamic>>{};
    try {
      final checkIns = await tablesDB.listRows(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.checkInsTableId,
        queries: [Query.equal('profileId', profileId), Query.limit(500)],
        total: false,
        ttl: 0,
      );
      for (final row in checkIns.rows) {
        final tournamentId = row.data['tournamentId']?.toString();
        if (tournamentId != null) passes[tournamentId] = row.data;
      }
    } catch (_) {
      // A player without any issued pass simply sees no code yet.
    }

    final registrations = <String, MyRegistrationInfo>{};
    for (final row in response.rows) {
      final tournamentId = row.data['tournamentId']?.toString();
      if (tournamentId == null) continue;
      final pass = passes[tournamentId];
      registrations[tournamentId] = MyRegistrationInfo(
        rowId: row.$id,
        status: row.data['status']?.toString() ?? 'pending',
        checkInCode: pass?['code']?.toString(),
        checkedIn: (pass?['checkedIn'] ?? row.data['checkedIn']) == true,
      );
    }
    return registrations;
  }

  Future<void> assertAccessAllowed({
    String? email,
    String? universityId,
    String? phone,
  }) async {
    if (AppConfig.accessGuardFunctionId.isEmpty) return;

    final execution = await functions.createExecution(
      functionId: AppConfig.accessGuardFunctionId,
      body: jsonEncode({
        'email': email?.trim(),
        'universityId': universityId?.trim(),
        'phone': normalizeJordanPhone(phone),
      }),
      xasync: false,
      path: '/check',
      method: enums.ExecutionMethod.pOST,
      headers: {'content-type': 'application/json'},
    );

    final payload = jsonDecode(execution.responseBody);
    if (payload is! Map<String, dynamic>) {
      throw Exception('Access guard returned an unreadable response.');
    }

    if (execution.responseStatusCode >= 400 ||
        payload['ok'] == false ||
        payload['allowed'] == false) {
      throw Exception(
        payload['reason']?.toString() ??
            payload['error']?.toString() ??
            'This account is blocked by club administration.',
      );
    }
  }

  Future<List<TournamentSeed>> loadTournaments() async {
    final cloudData = await _loadTournamentCloudData();
    final response = await tablesDB.listRows(
      databaseId: AppConfig.databaseId,
      tableId: AppConfig.tournamentsTableId,
      queries: [Query.limit(100)],
      total: false,
      ttl: 0,
    );

    final rows =
        uniqueTournamentsByFormat(
          response.rows
              .map((row) => _mapTournament(row, cloudData))
              .whereType<TournamentSeed>(),
        )..sort((a, b) {
          final status = _statusOrder(
            a.status,
          ).compareTo(_statusOrder(b.status));
          if (status != 0) return status;
          final format = _tournamentFormatRank(
            a.format,
          ).compareTo(_tournamentFormatRank(b.format));
          return format == 0 ? a.name.compareTo(b.name) : format;
        });

    return rows;
  }

  Future<TournamentLiveGameState?> loadTournamentLiveGame(String gameId) async {
    if (!ready || gameId.trim().isEmpty) return null;

    try {
      final row = await tablesDB.getRow(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.gamesTableId,
        rowId: gameId,
      );
      final data = row.data;
      final status = data['status']?.toString() ?? 'scheduled';
      final storedResult = data['result']?.toString();
      return TournamentLiveGameState(
        pgn: data['pgn']?.toString(),
        result: status == 'live'
            ? 'live'
            : storedResult == null || storedResult == '*'
            ? '-'
            : storedResult,
      );
    } catch (_) {
      return null;
    }
  }

  Future<_TournamentCloudData> _loadTournamentCloudData() async {
    final registrationsFuture = _tryListRows(AppConfig.registrationsTableId);
    final profilesFuture = _tryListRows(AppConfig.profilesTableId);
    final gamesFuture = _tryListRows(AppConfig.gamesTableId);

    final registrations = await registrationsFuture;
    final profiles = _mapProfileRows(await profilesFuture);
    final games = await gamesFuture;

    return _TournamentCloudData(
      playerCountsByTournament: _groupRegistrationCounts(registrations),
      playersByTournament: _groupRegisteredPlayers(registrations, profiles),
      roundsByTournament: _groupPublishedRounds(games, profiles),
    );
  }

  Future<List<models.Row>> _tryListRows(String tableId) async {
    try {
      final response = await tablesDB.listRows(
        databaseId: AppConfig.databaseId,
        tableId: tableId,
        queries: [Query.limit(1000)],
        total: false,
        ttl: 0,
      );
      return response.rows;
    } catch (_) {
      return const [];
    }
  }

  Future<void> _createProfile(
    models.User user, {
    String? universityId,
    String? phone,
  }) async {
    try {
      await tablesDB.createRow(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.profilesTableId,
        rowId: ID.unique(),
        data: {
          'accountId': user.$id,
          'displayName': user.name,
          'email': user.email,
          if (universityId != null && universityId.trim().isNotEmpty)
            'universityId': universityId.trim(),
          if (normalizeJordanPhone(phone) != null)
            'phone': normalizeJordanPhone(phone),
          'rating': 1200,
          'role': 'member',
          'status': 'pending',
        },
        permissions: [
          Permission.read(Role.any()),
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
        ],
      );
    } catch (_) {
      // Account creation is still valid if the profile row is blocked by table permissions.
    }
  }

  TournamentSeed? _mapTournament(
    models.Row row,
    _TournamentCloudData cloudData,
  ) {
    final data = row.data;
    final format = data['format']?.toString();
    final timeControl = data['timeControl']?.toString();
    final rawStatus = data['status']?.toString() ?? 'upcoming';

    if (format == null || timeControl == null) return null;
    if (rawStatus == 'draft' ||
        rawStatus == 'cancelled' ||
        rawStatus == 'archived') {
      return null;
    }
    final displayFormat = normalizeTournamentFormat(format);
    final rawName = data['name']?.toString().trim();
    final displayName = rawName == null || rawName.isEmpty
        ? displayFormat
        : rawName;
    final rawSlug = data['slug']?.toString().trim();
    final fallbackId = tournamentFormatId(displayName);
    final tournamentId = rawSlug == null || rawSlug.isEmpty
        ? (fallbackId.isEmpty ? row.$id : fallbackId)
        : rawSlug;

    final roundsTotal = _asInt(data['roundsTotal']);
    final currentRound = _asInt(data['currentRound']);
    final capacity = _asInt(data['capacity']);
    final registeredPlayers =
        cloudData.playersByTournament[row.$id] ?? const <PlayerSeed>[];
    final publishedRounds =
        cloudData.roundsByTournament[row.$id] ?? const <RoundSeed>[];
    final bracketSnapshot = parsePublishedBracketSnapshot(
      data['bracketSnapshot']?.toString(),
    );
    final players = registeredPlayers.isNotEmpty
        ? registeredPlayers.length
        : cloudData.playerCountsByTournament[row.$id] ?? 0;
    final displayedPlayers = players;
    final location = data['location']?.toString() ?? 'University of Jordan';
    final startsAt = data['startsAt']?.toString();

    return TournamentSeed(
      rowId: row.$id,
      id: tournamentId,
      name: displayName,
      meta: '${_formatDate(startsAt)} · $location',
      chips: [
        roundsTotal == null
            ? displayFormat
            : '$displayFormat · $roundsTotal rounds',
        timeControl,
        capacity == null
            ? '$displayedPlayers players'
            : '$displayedPlayers/$capacity players',
      ],
      current: _roundLabel(rawStatus, currentRound, roundsTotal),
      format: displayFormat,
      timeControl: timeControl,
      players: displayedPlayers,
      capacity: capacity,
      roundsTotal: roundsTotal,
      currentRound: currentRound,
      location: location,
      description:
          data['description']?.toString() ??
          'Tournament details will be published by the club organizers.',
      startsAt: startsAt,
      status: rawStatus,
      registeredPlayers: registeredPlayers,
      publishedRounds: publishedRounds,
      bracketSnapshot: bracketSnapshot,
    );
  }
}

class TournamentLiveGameState {
  const TournamentLiveGameState({required this.result, this.pgn});

  final String result;
  final String? pgn;
}

class MyRegistrationInfo {
  const MyRegistrationInfo({
    required this.rowId,
    required this.status,
    this.checkInCode,
    this.checkedIn = false,
  });

  final String rowId;
  final String status;
  final String? checkInCode;
  final bool checkedIn;

  String get qrPayload => 'JUCHESS-CHECKIN:$rowId:${checkInCode ?? ''}';
}

class _TournamentCloudData {
  const _TournamentCloudData({
    this.playerCountsByTournament = const {},
    this.playersByTournament = const {},
    this.roundsByTournament = const {},
  });

  final Map<String, int> playerCountsByTournament;
  final Map<String, List<PlayerSeed>> playersByTournament;
  final Map<String, List<RoundSeed>> roundsByTournament;
}

Map<String, PlayerSeed> _mapProfileRows(List<models.Row> rows) {
  final profiles = <String, PlayerSeed>{};
  for (final row in rows) {
    final data = row.data;
    profiles[row.$id] = PlayerSeed(
      9999,
      data['displayName']?.toString() ?? data['email']?.toString() ?? row.$id,
      _asInt(data['rating']) ?? 1200,
      data['universityId']?.toString() ?? data['email']?.toString() ?? row.$id,
    );
  }
  return profiles;
}

Map<String, List<PlayerSeed>> _groupRegisteredPlayers(
  List<models.Row> rows,
  Map<String, PlayerSeed> profiles,
) {
  final groups = <String, List<PlayerSeed>>{};

  for (final row in rows) {
    final data = row.data;
    final tournamentId = data['tournamentId']?.toString();
    final profileId = data['profileId']?.toString();
    final status = data['status']?.toString();
    final checkedIn = data['checkedIn'] == true;
    if (tournamentId == null ||
        profileId == null ||
        (status != 'confirmed' && !checkedIn) ||
        !profiles.containsKey(profileId)) {
      continue;
    }

    final profile = profiles[profileId]!;
    final seed = _asInt(data['seed']) ?? 9999;
    groups
        .putIfAbsent(tournamentId, () => [])
        .add(PlayerSeed(seed, profile.name, profile.rating, profile.username));
  }

  return groups.map((tournamentId, players) {
    players.sort(
      (a, b) => a.rank == b.rank
          ? a.name.compareTo(b.name)
          : a.rank.compareTo(b.rank),
    );
    return MapEntry(tournamentId, [
      for (var i = 0; i < players.length; i++)
        PlayerSeed(
          i + 1,
          players[i].name,
          players[i].rating,
          players[i].username,
        ),
    ]);
  });
}

Map<String, int> _groupRegistrationCounts(List<models.Row> rows) {
  final groups = <String, int>{};
  for (final row in rows) {
    final data = row.data;
    final tournamentId = data['tournamentId']?.toString();
    final status = data['status']?.toString();
    final checkedIn = data['checkedIn'] == true;
    if (tournamentId == null || (status != 'confirmed' && !checkedIn)) continue;
    groups[tournamentId] = (groups[tournamentId] ?? 0) + 1;
  }
  return groups;
}

Map<String, List<RoundSeed>> _groupPublishedRounds(
  List<models.Row> rows,
  Map<String, PlayerSeed> profiles,
) {
  final groups = <String, Map<int, List<({int board, MatchSeed match})>>>{};

  for (final row in rows) {
    final data = row.data;
    final tournamentId = data['tournamentId']?.toString();
    final whiteProfileId = data['whiteProfileId']?.toString();
    final blackProfileId = data['blackProfileId']?.toString();
    if (tournamentId == null ||
        whiteProfileId == null ||
        blackProfileId == null ||
        !profiles.containsKey(whiteProfileId) ||
        !profiles.containsKey(blackProfileId)) {
      continue;
    }

    final round = _asInt(data['round']) ?? 1;
    final board = _asInt(data['board']) ?? 1;
    final status = data['status']?.toString();
    final result = data['result']?.toString();
    final match = MatchSeed(
      profiles[whiteProfileId]!.name,
      profiles[blackProfileId]!.name,
      status == 'live'
          ? 'live'
          : result == '*' || result == null
          ? '-'
          : result,
      gameId: row.$id,
      pgn: data['pgn']?.toString(),
    );
    groups.putIfAbsent(tournamentId, () => {});
    groups[tournamentId]!.putIfAbsent(round, () => []).add((
      board: board,
      match: match,
    ));
  }

  return groups.map((tournamentId, rounds) {
    final sortedRounds = rounds.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return MapEntry(
      tournamentId,
      sortedRounds.map((entry) {
        final matches = entry.value.toList()
          ..sort((a, b) => a.board.compareTo(b.board));
        return RoundSeed(
          'Round ${entry.key}',
          matches.map((item) => item.match).toList(),
        );
      }).toList(),
    );
  });
}

PublishedBracketSnapshot? parsePublishedBracketSnapshot(String? value) {
  if (value == null || value.trim().isEmpty) return null;

  try {
    final parsed = jsonDecode(value);
    if (parsed is! Map<String, dynamic>) return null;
    final type = parsed['type']?.toString();
    final title = parsed['title']?.toString() ?? 'Tournament bracket';

    if (type == 'single') {
      final rounds = _snapshotRounds(parsed['rounds']);
      if (rounds.isEmpty) return null;
      return PublishedBracketSnapshot(
        type: 'single',
        title: title,
        rounds: rounds,
      );
    }

    if (type == 'double') {
      final brackets = parsed['brackets'];
      if (brackets is! Map<String, dynamic>) return null;
      final version = _asInt(parsed['version']) ?? 1;
      final winners = _snapshotRounds(brackets['winners']);
      // Version 2+ snapshots carry authoritative server-generated labels;
      // only legacy snapshots need lower-bracket label re-derivation.
      final losers = version >= 2
          ? _snapshotRounds(brackets['losers'])
          : _normalizeLowerBracketRounds(
              _snapshotRounds(brackets['losers']),
              preferredLabels: _lowerBracketRoundLabelsFromWinnerRounds([
                for (final round in winners) round.label,
              ]),
              firstWinnerRoundCode: winners.isNotEmpty
                  ? _bracketRoundCode(winners.first.label)
                  : null,
            );
      final finalRounds = _snapshotRounds(brackets['final']);
      if (winners.isEmpty && losers.isEmpty && finalRounds.isEmpty) {
        return null;
      }
      return PublishedBracketSnapshot(
        type: 'double',
        title: title,
        winners: winners,
        losers: losers,
        finalRounds: finalRounds,
      );
    }
  } catch (_) {
    return null;
  }

  return null;
}

List<RoundSeed> _snapshotRounds(dynamic value) {
  if (value is! List) return const [];

  return value
      .whereType<Map>()
      .map((round) {
        final name = round['name']?.toString();
        final matches = round['matches'];
        if (name == null || matches is! List) return null;
        final games = matches
            .map(_snapshotMatch)
            .whereType<MatchSeed>()
            .toList(growable: false);
        return RoundSeed(name, games);
      })
      .whereType<RoundSeed>()
      .where((round) => round.games.isNotEmpty)
      .toList(growable: false);
}

MatchSeed? _snapshotMatch(dynamic value) {
  if (value is! Map) return null;
  final white = value['white']?.toString();
  final black = value['black']?.toString();
  if (white == null || black == null) return null;

  return MatchSeed(
    white,
    black,
    _snapshotResult(value),
    matchNumber: _asInt(value['matchNumber']),
    nextIndex: _asInt(value['next']),
    gameId: value['gameId']?.toString(),
    pgn: value['pgn']?.toString(),
  );
}

String _snapshotResult(Map<dynamic, dynamic> value) {
  if (value['live'] == true) return 'live';
  if (value['winner'] == 'white') return '1-0';
  if (value['winner'] == 'black') return '0-1';

  final whiteScore = value['whiteScore']?.toString();
  final blackScore = value['blackScore']?.toString();
  if (whiteScore == '1' && blackScore == '0') return '1-0';
  if (whiteScore == '0' && blackScore == '1') return '0-1';
  if (whiteScore == '0.5' && blackScore == '0.5') return '1/2';
  return '-';
}

class AppState extends ChangeNotifier {
  AppState(this.service) {
    unawaited(bootstrap());
  }

  final AppwriteService service;
  int tab = _initialPreviewTab();
  bool authLoading = false;
  bool dataLoading = false;
  String tournamentFilter = 'upcoming';
  String? userName = _initialPreviewUserName();
  String? userEmail = _initialPreviewEmail();
  String? profileId;
  String? error;
  List<TournamentSeed> tournamentItems = const [];
  Map<String, MyRegistrationInfo> myRegistrations = {};

  Set<String> get registeredTournamentRowIds => myRegistrations.keys.toSet();

  bool get appwriteReady => service.ready;
  bool get signedIn => userEmail != null;

  List<TournamentSeed> get visibleTournaments {
    final filtered = tournamentItems
        .where((item) => item.status == tournamentFilter)
        .toList();
    return filtered;
  }

  TournamentSeed? get featuredTournament {
    for (final item in tournamentItems) {
      if (item.status == 'active') return item;
    }
    if (tournamentItems.isNotEmpty) return tournamentItems.first;
    return null;
  }

  void selectTab(int value) {
    tab = value;
    notifyListeners();
  }

  void selectTournamentFilter(String value) {
    tournamentFilter = value;
    notifyListeners();
  }

  void clearError() {
    error = null;
    notifyListeners();
  }

  void setError(String message) {
    error = message;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    await Future.wait([loadCurrentUser(), loadTournaments()]);
  }

  Future<void> loadCurrentUser() async {
    if (_isMemberPreview()) {
      final previewEmail = _initialPreviewEmail();
      userName = _initialPreviewUserName();
      userEmail = previewEmail;

      if (service.ready && previewEmail != null) {
        final profile = await service.loadProfileIdentityByEmail(previewEmail);
        final displayName = profile['displayName'];
        profileId = profile['profileId'];
        if (displayName != null && displayName.isNotEmpty) {
          userName = displayName;
        }
        if (profileId != null) {
          myRegistrations = await service.loadMyRegistrations(profileId!);
        }
      } else {
        profileId = 'preview-profile';
      }

      error = null;
      notifyListeners();
      return;
    }

    if (!service.ready) return;

    try {
      final user = await service.currentUser();
      final profile = await service.assertCurrentUserAllowed(user);
      final displayName = profile['displayName'];
      profileId = profile['profileId'];
      userName = displayName != null && displayName.isNotEmpty
          ? displayName
          : user.name.isNotEmpty
          ? user.name
          : user.email;
      userEmail = user.email;
      error = null;
      if (profileId != null) {
        myRegistrations = await service.loadMyRegistrations(profileId!);
      }
    } catch (caught) {
      if (service.ready) {
        try {
          await service.signOut();
        } catch (_) {}
      }
      userName = null;
      userEmail = null;
      profileId = null;
      error = caught is AppwriteException && caught.type != 'user_blocked'
          ? null
          : appwriteMessage(caught);
    }

    notifyListeners();
  }

  Future<bool> signIn(String email, String password) async {
    if (_isAdminPreview()) {
      userName = _displayNameFromEmail(email);
      userEmail = email.trim().isEmpty ? _initialPreviewEmail() : email.trim();
      profileId = 'preview-profile';
      error = null;
      notifyListeners();
      return true;
    }

    if (!service.ready) {
      error = 'Account service is not ready yet.';
      notifyListeners();
      return false;
    }

    authLoading = true;
    error = null;
    notifyListeners();

    try {
      final user = await service.signIn(email: email, password: password);
      final profile = await service.ensureProfileIdentity(user);
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
      profileId = profile['profileId'];
      if (profileId != null) {
        myRegistrations = await service.loadMyRegistrations(profileId!);
      }
      return true;
    } catch (caught) {
      error = appwriteMessage(caught);
      return false;
    } finally {
      authLoading = false;
      notifyListeners();
    }
  }

  Future<bool> signUp(
    String name,
    String email,
    String password,
    String universityId,
    String phone,
  ) async {
    if (_isAdminPreview()) {
      userName = name.trim().isEmpty
          ? _displayNameFromEmail(email)
          : name.trim();
      userEmail = email.trim().isEmpty ? _initialPreviewEmail() : email.trim();
      profileId = 'preview-profile';
      error = null;
      notifyListeners();
      return true;
    }

    if (!service.ready) {
      error = 'Account service is not ready yet.';
      notifyListeners();
      return false;
    }

    authLoading = true;
    error = null;
    notifyListeners();

    try {
      final user = await service.signUp(
        name: name,
        email: email,
        password: password,
        universityId: universityId,
        phone: phone,
      );
      final profile = await service.ensureProfileIdentity(user);
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
      profileId = profile['profileId'];
      if (profileId != null) {
        myRegistrations = await service.loadMyRegistrations(profileId!);
      }
      return true;
    } catch (caught) {
      error = appwriteMessage(caught);
      return false;
    } finally {
      authLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendPasswordRecovery(String email) async {
    if (!service.ready) {
      error = 'Account service is not ready yet.';
      notifyListeners();
      return false;
    }

    authLoading = true;
    error = null;
    notifyListeners();

    try {
      await service.sendPasswordRecovery(email);
      return true;
    } catch (caught) {
      error = appwriteMessage(caught);
      return false;
    } finally {
      authLoading = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    if (_isMemberPreview()) {
      userName = _initialPreviewUserName();
      userEmail = _initialPreviewEmail();
      notifyListeners();
      return;
    }

    if (service.ready) {
      try {
        await service.signOut();
      } catch (_) {}
    }

    userName = null;
    userEmail = null;
    profileId = null;
    myRegistrations = {};
    notifyListeners();
  }

  bool isRegisteredFor(TournamentSeed event) {
    return registeredTournamentRowIds.contains(event.rowId);
  }

  MyRegistrationInfo? registrationFor(TournamentSeed event) {
    return myRegistrations[event.rowId];
  }

  Future<bool> ensurePlayerProfile() async {
    if (profileId != null) return true;

    if (!service.ready) {
      error = 'Account service is not ready yet.';
      notifyListeners();
      return false;
    }

    try {
      final user = await service.currentUser();
      final profile = await service.ensureProfileIdentity(user);
      final displayName = profile['displayName'];
      userName = displayName != null && displayName.isNotEmpty
          ? displayName
          : user.name.isNotEmpty
          ? user.name
          : user.email;
      userEmail = user.email;
      profileId = profile['profileId'];
      if (profileId != null) {
        myRegistrations = await service.loadMyRegistrations(profileId!);
        error = null;
        notifyListeners();
        return true;
      }

      error =
          'Your player profile is not ready yet. Please try signing out and signing in again.';
      notifyListeners();
      return false;
    } catch (caught) {
      error = appwriteMessage(caught);
      notifyListeners();
      return false;
    }
  }

  Future<bool> registerForTournament(TournamentSeed event) async {
    if (!isTournamentRegistrationOpen(event)) {
      error = 'Registration is closed for this tournament.';
      notifyListeners();
      return false;
    }

    if (!signedIn) {
      error = 'Sign in to register for this tournament.';
      notifyListeners();
      return false;
    }

    if (_isMemberPreview()) {
      myRegistrations = {
        ...myRegistrations,
        event.rowId: const MyRegistrationInfo(
          rowId: 'preview-registration',
          status: 'confirmed',
          checkInCode: 'JU-PREVIEW',
        ),
      };
      error = null;
      notifyListeners();
      return true;
    }

    if (!await ensurePlayerProfile()) {
      return false;
    }

    authLoading = true;
    error = null;
    notifyListeners();

    try {
      await service.registerForTournament(
        tournamentRowId: event.rowId,
        profileId: profileId!,
      );
      myRegistrations = await service.loadMyRegistrations(profileId!);
      await loadTournaments();
      return true;
    } catch (caught) {
      error = appwriteMessage(caught);
      return false;
    } finally {
      authLoading = false;
      notifyListeners();
    }
  }

  Future<bool> cancelTournamentRegistration(TournamentSeed event) async {
    if (!signedIn) {
      error = 'Sign in to manage this registration.';
      notifyListeners();
      return false;
    }

    if (_isMemberPreview()) {
      myRegistrations = {...myRegistrations}..remove(event.rowId);
      error = null;
      notifyListeners();
      return true;
    }

    if (!await ensurePlayerProfile()) {
      return false;
    }

    authLoading = true;
    error = null;
    notifyListeners();

    try {
      await service.cancelTournamentRegistration(
        tournamentRowId: event.rowId,
        profileId: profileId!,
      );
      myRegistrations = {...myRegistrations}..remove(event.rowId);
      await loadTournaments();
      return true;
    } catch (caught) {
      error = appwriteMessage(caught);
      return false;
    } finally {
      authLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadTournaments() async {
    if (!service.ready) {
      tournamentItems = const [];
      return;
    }

    dataLoading = true;
    notifyListeners();

    try {
      final loaded = await service.loadTournaments();
      tournamentItems = loaded;
      error = null;
    } catch (caught) {
      tournamentItems = const [];
      error = null;
    } finally {
      dataLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshTournaments() async {
    if (!service.ready) return;

    try {
      final loaded = await service.loadTournaments();
      if (profileId != null) {
        try {
          myRegistrations = await service.loadMyRegistrations(profileId!);
        } catch (_) {}
      }
      tournamentItems = loaded;
      error = null;
    } catch (_) {
      error = null;
    } finally {
      notifyListeners();
    }
  }
}

class HomeTournamentSlot {
  const HomeTournamentSlot({
    required this.label,
    required this.filter,
    required this.emptyTitle,
    required this.emptyBody,
    this.event,
  });

  final String label;
  final String filter;
  final String emptyTitle;
  final String emptyBody;
  final TournamentSeed? event;
}

List<HomeTournamentSlot> buildHomeTournamentSlots(
  List<TournamentSeed> tournaments,
) {
  return [
    HomeTournamentSlot(
      label: 'Upcoming',
      filter: 'upcoming',
      emptyTitle: 'No upcoming tournament',
      emptyBody: 'Upcoming events will appear here after they are published.',
      event: _firstTournamentByStatus(tournaments, 'upcoming'),
    ),
    HomeTournamentSlot(
      label: 'Live',
      filter: 'active',
      emptyTitle: 'No live tournament',
      emptyBody: 'Active tournaments will appear here when games begin.',
      event: _firstTournamentByStatus(tournaments, 'active'),
    ),
    HomeTournamentSlot(
      label: 'Completed',
      filter: 'completed',
      emptyTitle: 'No completed tournament',
      emptyBody: 'Finished tournaments will appear here with results.',
      event: _firstTournamentByStatus(tournaments, 'completed'),
    ),
  ];
}

TournamentSeed? _firstTournamentByStatus(
  List<TournamentSeed> tournaments,
  String status,
) {
  for (final tournament in tournaments) {
    if (tournament.status == status) return tournament;
  }
  return null;
}

bool _isAdminPreview() => Uri.base.queryParameters['adminPreview'] == '1';

bool _isMemberPreview() =>
    _isAdminPreview() && Uri.base.queryParameters['mode'] != 'guest';

int _initialPreviewTab() {
  switch (_previewScreen()) {
    case 'tournaments':
      return 1;
    case 'games':
      return 2;
    case 'tools':
      return 3;
    case 'profile':
    case 'auth':
      return 4;
    default:
      return 0;
  }
}

String _previewScreen() {
  if (!_isAdminPreview()) return '';
  return Uri.base.queryParameters['screen']?.toLowerCase() ?? '';
}

bool _shouldOpenAuthPreview() => _previewScreen() == 'auth';

String? _initialPreviewEmail() {
  if (!_isMemberPreview()) return null;
  final value = Uri.base.queryParameters['previewEmail']?.trim();
  return value == null || value.isEmpty ? 'student.preview@ju.edu.jo' : value;
}

String? _initialPreviewUserName() {
  final email = _initialPreviewEmail();
  if (email == null) return null;
  return _displayNameFromEmail(email);
}

String _displayNameFromEmail(String email) {
  final localPart = email.trim().split('@').first;
  if (localPart.isEmpty) return 'Preview Member';

  final words = localPart
      .replaceAll(RegExp(r'[._-]+'), ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1));

  final displayName = words.join(' ');
  return displayName.isEmpty ? 'Preview Member' : displayName;
}

String appwriteMessage(Object error) {
  if (error is AppwriteException && error.message != null) {
    return _serviceMessage(error.message!);
  }

  return _serviceMessage(error.toString());
}

String _serviceMessage(String value) {
  return value.replaceAll(
    RegExp('appwrite|cloud', caseSensitive: false),
    'service',
  );
}

String? normalizeJordanPhone(String? value) {
  final raw = value?.trim();
  if (raw == null || raw.isEmpty) return null;

  final compact = raw.replaceAll(RegExp(r'[^\d+]'), '');
  if (compact.startsWith('+962')) {
    return '+962${compact.substring(4).replaceAll(RegExp(r'\D'), '')}';
  }
  if (compact.startsWith('00962')) {
    return '+962${compact.substring(5).replaceAll(RegExp(r'\D'), '')}';
  }
  if (compact.startsWith('962')) {
    return '+962${compact.substring(3).replaceAll(RegExp(r'\D'), '')}';
  }

  final digits = compact.replaceAll(RegExp(r'\D'), '');
  if (digits.startsWith('0')) return '+962${digits.substring(1)}';
  if (digits.startsWith('7') && digits.length == 9) return '+962$digits';
  return raw;
}

int? _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

int _statusOrder(String status) {
  if (status == 'upcoming') return 0;
  if (status == 'active') return 1;
  return 2;
}

bool isTournamentRegistrationOpen(TournamentSeed event) =>
    event.status == 'upcoming';

const tournamentFormatOrder = [
  'Swiss',
  'Round robin',
  'Double round robin',
  'Single elimination',
  'Double elimination',
  'Multi-stage',
  'Team',
  'Arena',
];

int _tournamentFormatRank(String format) {
  final index = tournamentFormatOrder.indexOf(format);
  return index == -1 ? tournamentFormatOrder.length : index;
}

String normalizeTournamentFormat(String value) {
  final trimmed = value.trim();
  if (RegExp(r'^round[-\s]?robin$', caseSensitive: false).hasMatch(trimmed)) {
    return 'Round robin';
  }
  if (RegExp(
    r'^double\s+round[-\s]?robin$',
    caseSensitive: false,
  ).hasMatch(trimmed)) {
    return 'Double round robin';
  }
  return trimmed;
}

String tournamentFormatId(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
}

List<TournamentSeed> uniqueTournamentsByFormat(
  Iterable<TournamentSeed> tournaments,
) {
  final rows = <String, TournamentSeed>{};
  for (final tournament in tournaments) {
    rows.putIfAbsent(tournament.id, () => tournament);
  }
  return rows.values.toList();
}

String _roundLabel(String status, int? currentRound, int? roundsTotal) {
  if (currentRound != null && roundsTotal != null) {
    return 'Round $currentRound of $roundsTotal';
  }

  if (currentRound != null) return 'Round $currentRound';
  if (status == 'completed') return 'Final';
  if (status == 'upcoming') return 'Registration';
  return 'In progress';
}

String _formatDate(String? value) {
  if (value == null || value.isEmpty) return 'Date TBA';

  final date = DateTime.tryParse(value);
  if (date == null) return value;

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}

class JuChessApp extends StatelessWidget {
  const JuChessApp({this.connectCloud = true, super.key});

  final bool connectCloud;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => AppwriteService(enabled: connectCloud)),
        ChangeNotifierProvider(
          create: (context) => AppState(context.read<AppwriteService>()),
        ),
      ],
      child: MaterialApp(
        title: 'JuChess',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          scaffoldBackgroundColor: PrototypeColors.screen,
          colorScheme: ColorScheme.fromSeed(
            seedColor: PrototypeColors.burgundy,
            surface: PrototypeColors.surface,
          ),
          fontFamily: '-apple-system',
        ),
        home: const JuChessSplashGate(child: PrototypeShell()),
      ),
    );
  }
}

class PrototypeColors {
  static const navy = Color(0xff21304e);
  static const burgundy = Color(0xff7d2434);
  static const cream = Color(0xfff6f0e2);
  static const surface = Color(0xfffffaf0);
  static const header = Color(0xfff2ebd9);
  static const pageBg = Color(0xffd7cfbd);
  static const gold = Color(0xffa98a3f);
  static const muted = Color(0xff6a7489);
  static const screen = Color(0xfff6f0e2);
}

class JuChessSplashGate extends StatefulWidget {
  const JuChessSplashGate({required this.child, super.key});

  final Widget child;

  @override
  State<JuChessSplashGate> createState() => _JuChessSplashGateState();
}

class _JuChessSplashGateState extends State<JuChessSplashGate>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final List<SplashFaller> _fallers;
  Timer? _dismissTimer;
  bool _dismissing = false;
  bool _visible = true;

  @override
  void initState() {
    super.initState();
    _fallers = SplashFaller.seeded();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 8200),
    )..repeat();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _dismissTimer = Timer(const Duration(milliseconds: 1750), () {
        if (mounted) setState(() => _dismissing = true);
      });
    });
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_visible)
          IgnorePointer(
            child: AnimatedOpacity(
              opacity: _dismissing ? 0 : 1,
              duration: const Duration(milliseconds: 420),
              curve: Curves.easeOutCubic,
              onEnd: () {
                if (_dismissing && mounted) {
                  setState(() => _visible = false);
                }
              },
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  return CustomPaint(
                    painter: SplashBackdropPainter(
                      progress: _controller.value,
                      fallers: _fallers,
                    ),
                    child: const Center(child: SplashLogoMark()),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}

class SplashLogoMark extends StatelessWidget {
  const SplashLogoMark({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 138,
          height: 138,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xfffffcf4),
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0x55a98a3f), width: 1.5),
            boxShadow: const [
              BoxShadow(
                color: Color(0x267d2434),
                blurRadius: 28,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: ClipOval(
            child: Image.asset('assets/juchess-logo.png', fit: BoxFit.cover),
          ),
        ),
        const SizedBox(height: 18),
        const SerifText('Chess Club JU', size: 32, weight: FontWeight.w700),
        const SizedBox(height: 5),
        const Text(
          'University of Jordan',
          style: TextStyle(
            color: Color(0xa621304e),
            decoration: TextDecoration.none,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}

class SplashFaller {
  const SplashFaller({
    required this.glyph,
    required this.left,
    required this.size,
    required this.duration,
    required this.delay,
    required this.opacity,
    required this.rotation,
  });

  final String glyph;
  final double left;
  final double size;
  final double duration;
  final double delay;
  final double opacity;
  final double rotation;

  static List<SplashFaller> seeded() {
    const glyphs = ['♟', '♞', '♝', '♜', '♛', '♚'];
    var seed = 91;

    double rnd() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    return List.generate(16, (_) {
      return SplashFaller(
        glyph: glyphs[(rnd() * glyphs.length).floor()],
        left: 0.02 + rnd() * 0.96,
        size: 20 + rnd() * 34,
        duration: 9 + rnd() * 12,
        delay: rnd() * -18,
        opacity: 0.05 + rnd() * 0.13,
        rotation: rnd() * math.pi,
      );
    });
  }
}

class SplashBackdropPainter extends CustomPainter {
  const SplashBackdropPainter({required this.progress, required this.fallers});

  final double progress;
  final List<SplashFaller> fallers;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(PrototypeColors.screen, BlendMode.src);
    _paintGrid(canvas, size);
    _paintGlow(canvas, size);
    _paintFallers(canvas, size);
  }

  void _paintGrid(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x0a16213b)
      ..strokeWidth = 1;
    const step = 72.0;
    for (var x = 0.0; x <= size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (var y = 0.0; y <= size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  void _paintGlow(Canvas canvas, Size size) {
    final radius = math.min(size.shortestSide * 0.72, 360.0);
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height * 0.45),
      radius: radius,
    );
    final paint = Paint()
      ..shader = const RadialGradient(
        colors: [Color(0x29c9ae6b), Color(0x00c9ae6b)],
      ).createShader(rect);
    canvas.drawCircle(rect.center, radius, paint);
  }

  void _paintFallers(Canvas canvas, Size size) {
    for (final faller in fallers) {
      final t = ((progress * 8.2 + faller.delay) / faller.duration) % 1.0;
      final y = -size.height * 0.2 + t * size.height * 1.38;
      final x = faller.left * size.width;
      final fadeIn = (t / 0.09).clamp(0.0, 1.0);
      final fadeOut = ((1 - t) / 0.1).clamp(0.0, 1.0);
      final opacity = faller.opacity * math.min(fadeIn, fadeOut);
      if (opacity <= 0) continue;

      final painter = TextPainter(
        text: TextSpan(
          text: faller.glyph,
          style: TextStyle(
            color: PrototypeColors.navy.withValues(alpha: opacity),
            fontSize: faller.size,
            fontWeight: FontWeight.w600,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(faller.rotation + t * math.pi * 1.8);
      painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant SplashBackdropPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.fallers != fallers;
  }
}

class PrototypeShell extends StatefulWidget {
  const PrototypeShell({super.key});

  @override
  State<PrototypeShell> createState() => _PrototypeShellState();
}

class _PrototypeShellState extends State<PrototypeShell> {
  bool _authPreviewOpened = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_authPreviewOpened || !_shouldOpenAuthPreview()) return;

    _authPreviewOpened = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) showAuthSheet(context);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final pages = const [
      HomeScreen(),
      TournamentsScreen(),
      GamesScreen(),
      ToolsScreen(),
      ProfileScreen(),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final tablet = constraints.maxWidth >= 720;

        if (tablet) {
          final compactRail = constraints.maxHeight < 620;

          return Scaffold(
            backgroundColor: PrototypeColors.pageBg,
            body: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 980),
                child: Container(
                  margin: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: PrototypeColors.screen,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x3321304e),
                        blurRadius: 42,
                        offset: Offset(0, 20),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      _TabletNavRail(
                        selectedIndex: state.tab,
                        onSelected: state.selectTab,
                        compact: compactRail,
                      ),
                      Expanded(child: pages[state.tab]),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        return Scaffold(
          backgroundColor: PrototypeColors.screen,
          body: pages[state.tab],
          bottomNavigationBar: NavigationBarTheme(
            data: NavigationBarThemeData(
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                return TextStyle(
                  color: states.contains(WidgetState.selected)
                      ? PrototypeColors.burgundy
                      : const Color(0xcc4c4042),
                  fontSize: 10,
                  height: 1,
                  fontWeight: states.contains(WidgetState.selected)
                      ? FontWeight.w800
                      : FontWeight.w700,
                );
              }),
            ),
            child: NavigationBar(
              height: 68,
              backgroundColor: const Color(0xfffbf7ec),
              indicatorColor: const Color(0x147d2434),
              selectedIndex: state.tab,
              onDestinationSelected: state.selectTab,
              destinations: [
                NavigationDestination(
                  icon: ClipOval(
                    child: Image.asset(
                      'assets/juchess-logo.png',
                      width: 26,
                      height: 26,
                    ),
                  ),
                  selectedIcon: Container(
                    width: 32,
                    height: 32,
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: PrototypeColors.cream,
                      shape: BoxShape.circle,
                      border: Border.all(color: PrototypeColors.burgundy),
                    ),
                    child: ClipOval(
                      child: Image.asset('assets/juchess-logo.png'),
                    ),
                  ),
                  label: 'Home',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.emoji_events_outlined),
                  selectedIcon: Icon(
                    Icons.emoji_events,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Tournaments',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.grid_view_outlined),
                  selectedIcon: Icon(
                    Icons.grid_view,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Games',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.tune),
                  selectedIcon: Icon(
                    Icons.tune,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Tools',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(
                    Icons.person,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Profile',
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TabletNavRail extends StatelessWidget {
  const _TabletNavRail({
    required this.selectedIndex,
    required this.onSelected,
    required this.compact,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final bool compact;

  static const _items = [
    _TabletNavItem('Home', Icons.home_outlined, Icons.home),
    _TabletNavItem(
      'Tournaments',
      Icons.emoji_events_outlined,
      Icons.emoji_events,
    ),
    _TabletNavItem('Games', Icons.grid_view_outlined, Icons.grid_view),
    _TabletNavItem('Tools', Icons.tune, Icons.tune),
    _TabletNavItem('Profile', Icons.person_outline, Icons.person),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      width: compact ? 96 : 142,
      color: PrototypeColors.header,
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.symmetric(vertical: compact ? 10 : 18),
            child: ClipOval(
              child: Image.asset(
                'assets/juchess-logo.png',
                width: compact ? 38 : 46,
                height: compact ? 38 : 46,
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(bottom: compact ? 10 : 16),
              child: Column(
                children: [
                  for (var index = 0; index < _items.length; index += 1)
                    _TabletNavButton(
                      item: _items[index],
                      selected: selectedIndex == index,
                      compact: compact,
                      onTap: () => onSelected(index),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabletNavButton extends StatelessWidget {
  const _TabletNavButton({
    required this.item,
    required this.selected,
    required this.compact,
    required this.onTap,
  });

  final _TabletNavItem item;
  final bool selected;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icon = selected ? item.selectedIcon : item.icon;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 8 : 12,
          vertical: compact ? 6 : 9,
        ),
        child: Column(
          children: [
            Container(
              width: compact ? 54 : 70,
              height: compact ? 42 : 48,
              decoration: BoxDecoration(
                color: selected ? PrototypeColors.burgundy : Colors.transparent,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Icon(
                icon,
                color: selected
                    ? PrototypeColors.cream
                    : const Color(0xff4c4042),
                size: compact ? 23 : 26,
              ),
            ),
            SizedBox(height: compact ? 4 : 7),
            Text(
              item.label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: selected
                    ? PrototypeColors.burgundy
                    : const Color(0xff2c2225),
                fontSize: compact ? 11 : 14,
                height: 1.05,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TabletNavItem {
  const _TabletNavItem(this.label, this.icon, this.selectedIcon);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class AppScroll extends StatelessWidget {
  const AppScroll({required this.children, this.physics, super.key});

  final List<Widget> children;
  final ScrollPhysics? physics;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        physics: physics,
        padding: const EdgeInsets.only(bottom: 118),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ),
    );
  }
}

class PrototypeHeader extends StatelessWidget {
  const PrototypeHeader({
    required this.title,
    this.subtitle,
    this.showNotifications = false,
    super.key,
  });

  final String title;
  final String? subtitle;
  final bool showNotifications;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      decoration: const BoxDecoration(
        color: PrototypeColors.header,
        border: Border(bottom: BorderSide(color: Color(0x1f21304e))),
      ),
      child: Row(
        children: [
          ClipOval(
            child: Image.asset(
              'assets/juchess-logo.png',
              width: 42,
              height: 42,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SerifText(title, size: 19, weight: FontWeight.w700),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      color: Color(0x9921304e),
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          if (showNotifications) const HeaderNotificationButton(),
        ],
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScroll(
      children: [
        const PrototypeHeader(
          title: 'JuChess',
          subtitle: 'University of Jordan Chess Club',
          showNotifications: true,
        ),
        const GuestCard(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: const HomeTournamentCarousel(),
        ),
        SectionHeading(
          title: 'Quick actions',
          margin: const EdgeInsets.fromLTRB(16, 20, 16, 10),
        ),
        const QuickActionsGrid(),
        SectionHeading(
          title: 'Club leaderboard',
          action: 'View all',
          onAction: () =>
              openPrototypeRoute(context, const LeaderboardScreen()),
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const LeaderboardPreview(),
        SectionHeading(
          title: 'News',
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const NewsList(),
      ],
    );
  }
}

class HomeTournamentCarousel extends StatefulWidget {
  const HomeTournamentCarousel({super.key});

  @override
  State<HomeTournamentCarousel> createState() => _HomeTournamentCarouselState();
}

class _HomeTournamentCarouselState extends State<HomeTournamentCarousel> {
  late final PageController _controller;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final slots = buildHomeTournamentSlots(
      context.watch<AppState>().tournamentItems,
    );

    return Column(
      children: [
        SizedBox(
          height: 264,
          child: PageView.builder(
            controller: _controller,
            itemCount: slots.length,
            onPageChanged: (value) => setState(() => _page = value),
            itemBuilder: (context, index) {
              final slot = slots[index];
              final event = slot.event;
              if (event == null) {
                return HomeTournamentEmptyCard(slot: slot);
              }

              return FeaturedTournamentCard(
                event: event,
                eyebrow: '${slot.label.toUpperCase()} TOURNAMENT',
                onTap: () => openTournamentDetail(context, event),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < slots.length; i++)
              GestureDetector(
                onTap: () => _controller.animateToPage(
                  i,
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                ),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: _page == i ? 20 : 7,
                  height: 7,
                  margin: const EdgeInsets.symmetric(horizontal: 3.5),
                  decoration: BoxDecoration(
                    color: _page == i
                        ? PrototypeColors.burgundy
                        : const Color(0x3321304e),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

String _firstNameForGreeting(AppState state) {
  final name = state.userName?.trim();
  final emailName = state.userEmail?.split('@').first.trim();
  final source = name != null && name.isNotEmpty ? name : emailName;
  if (source == null || source.isEmpty) return 'player';
  return source.split(RegExp(r'\s+')).first;
}

class GuestCard extends StatelessWidget {
  const GuestCard({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return PrototypeCard(
      margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state.signedIn
                      ? 'Welcome back, ${_firstNameForGreeting(state)}'
                      : "You're browsing as a guest",
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  state.signedIn
                      ? 'Ready for your next club game.'
                      : 'Sign in to register and save analyses',
                  style: const TextStyle(
                    color: Color(0x9921304e),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          if (!state.signedIn) ...[
            const SizedBox(width: 12),
            PrototypeButton(
              label: 'Sign in',
              onTap: () => showAuthSheet(context),
            ),
          ],
        ],
      ),
    );
  }
}

class FeaturedTournamentCard extends StatelessWidget {
  const FeaturedTournamentCard({
    required this.event,
    required this.onTap,
    this.eyebrow = 'FEATURED TOURNAMENT',
    super.key,
  });

  final TournamentSeed event;
  final VoidCallback onTap;
  final String eyebrow;

  @override
  Widget build(BuildContext context) {
    final progress = _playerProgress(event.chips);

    return PrototypeCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                eyebrow,
                style: const TextStyle(
                  color: Color(0x8021304e),
                  fontSize: 9.8,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
              const Spacer(),
              if (event.status == 'active')
                const LivePill()
              else
                StatusPill(event.status),
            ],
          ),
          const SizedBox(height: 6),
          SerifText(
            event.name,
            size: 16.2,
            weight: FontWeight.w700,
            height: 1.2,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            event.meta,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Color(0x9921304e), fontSize: 11.8),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 5,
            runSpacing: 5,
            children: event.chips
                .asMap()
                .entries
                .map(
                  (entry) => entry.key == 2
                      ? GoldPill(entry.value)
                      : ChipPill(entry.value),
                )
                .toList(),
          ),
          const SizedBox(height: 9),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 3.5,
              backgroundColor: const Color(0x1f21304e),
              valueColor: const AlwaysStoppedAnimation<Color>(
                PrototypeColors.gold,
              ),
            ),
          ),
          const SizedBox(height: 9),
          SizedBox(
            width: double.infinity,
            child: PrototypeButton(label: 'View Tournament', onTap: onTap),
          ),
        ],
      ),
    );
  }

  double _playerProgress(List<String> chips) {
    for (final chip in chips) {
      final match = RegExp(r'(\d+)\s*/\s*(\d+)').firstMatch(chip);
      if (match == null) continue;
      final players = int.tryParse(match.group(1) ?? '');
      final capacity = int.tryParse(match.group(2) ?? '');
      if (players == null || capacity == null || capacity == 0) return 0;
      return (players / capacity).clamp(0, 1);
    }

    return 0.75;
  }
}

class HomeTournamentEmptyCard extends StatelessWidget {
  const HomeTournamentEmptyCard({required this.slot, super.key});

  final HomeTournamentSlot slot;

  @override
  Widget build(BuildContext context) {
    final state = context.read<AppState>();

    return PrototypeCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(12, 11, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '${slot.label.toUpperCase()} TOURNAMENT',
                style: const TextStyle(
                  color: Color(0x8021304e),
                  fontSize: 9.8,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
              ),
              const Spacer(),
              StatusPill(slot.filter),
            ],
          ),
          const Spacer(),
          SerifText(
            slot.emptyTitle,
            size: 17,
            weight: FontWeight.w700,
            height: 1.25,
          ),
          const SizedBox(height: 6),
          Text(
            slot.emptyBody,
            style: const TextStyle(
              color: Color(0x9921304e),
              fontSize: 12.5,
              height: 1.35,
            ),
          ),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            child: PrototypeButton(
              label: 'Open Tournaments',
              onTap: () {
                state.selectTournamentFilter(slot.filter);
                state.selectTab(1);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class EmptyTournamentCard extends StatelessWidget {
  const EmptyTournamentCard({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ready = context.watch<AppState>().appwriteReady;

    return PrototypeCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'FEATURED TOURNAMENT',
            style: TextStyle(
              color: Color(0x8021304e),
              fontSize: 9.8,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 7),
          SerifText(
            'No tournament published yet',
            size: 16.2,
            weight: FontWeight.w700,
            height: 1.2,
          ),
          const SizedBox(height: 4),
          Text(
            ready
                ? 'Create a tournament in the control center to publish it here.'
                : 'Tournaments will appear here after they are published.',
            style: const TextStyle(color: Color(0x9921304e), fontSize: 11.8),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: PrototypeButton(label: 'Open Tournaments', onTap: onTap),
          ),
        ],
      ),
    );
  }
}

class QuickActionsGrid extends StatelessWidget {
  const QuickActionsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = [
      (
        '♞',
        'Game Review',
        () => openPrototypeRoute(context, const GameReviewScreen()),
      ),
      (
        '♟',
        'Analysis Board',
        () => openPrototypeRoute(context, const AnalysisBoardScreen()),
      ),
      (
        '5:00',
        'Chess Clock',
        () => openPrototypeRoute(context, const ChessClockScreen()),
      ),
      (
        '♛',
        'Leaderboard',
        () => openPrototypeRoute(context, const LeaderboardScreen()),
      ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.count(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.72,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: actions
            .map(
              (item) => InkWell(
                borderRadius: BorderRadius.circular(13),
                onTap: item.$3,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: cardDecoration(radius: 13),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        item.$1,
                        style: const TextStyle(
                          color: PrototypeColors.burgundy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        item.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: PrototypeColors.navy,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class TournamentsScreen extends StatelessWidget {
  const TournamentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return RefreshIndicator(
      color: PrototypeColors.burgundy,
      onRefresh: () => context.read<AppState>().refreshTournaments(),
      child: AppScroll(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PrototypeHeader(title: 'Tournaments'),
          const TournamentTabs(),
          if (state.error != null && state.appwriteReady)
            AppNotice(text: state.error!),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Column(
              children: state.dataLoading
                  ? const [
                      Padding(
                        padding: EdgeInsets.only(top: 24),
                        child: CircularProgressIndicator(
                          color: PrototypeColors.burgundy,
                        ),
                      ),
                    ]
                  : state.visibleTournaments.isEmpty
                  ? [TournamentEmptyState(filter: state.tournamentFilter)]
                  : state.visibleTournaments
                        .map(
                          (event) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: TournamentCard(event: event),
                          ),
                        )
                        .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class TournamentTabs extends StatelessWidget {
  const TournamentTabs({super.key});

  @override
  Widget build(BuildContext context) {
    final selected = context.watch<AppState>().tournamentFilter;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: PrototypeColors.screen,
        border: Border(bottom: BorderSide(color: Color(0x1421304e))),
      ),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: const Color(0x1021304e),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0x2021304e)),
        ),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () =>
                    context.read<AppState>().selectTournamentFilter('upcoming'),
                child: TabPill('Upcoming', selected: selected == 'upcoming'),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () =>
                    context.read<AppState>().selectTournamentFilter('active'),
                child: TabPill('Active', selected: selected == 'active'),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () => context.read<AppState>().selectTournamentFilter(
                  'completed',
                ),
                child: TabPill('Completed', selected: selected == 'completed'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TournamentCard extends StatelessWidget {
  const TournamentCard({required this.event, super.key});

  final TournamentSeed event;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => openTournamentDetail(context, event),
      child: PrototypeCard(
        margin: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: SerifText(
                    event.name,
                    size: 16.5,
                    weight: FontWeight.w700,
                    height: 1.3,
                  ),
                ),
                if (event.status == 'active')
                  const LivePill(small: true)
                else
                  StatusPill(event.status),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              event.meta,
              style: const TextStyle(color: Color(0x9921304e), fontSize: 12.5),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: event.chips.map((item) => ChipPill(item)).toList(),
            ),
            const SizedBox(height: 9),
            Row(
              children: [
                Expanded(
                  child: Text(
                    event.current,
                    style: const TextStyle(
                      color: PrototypeColors.burgundy,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: PrototypeColors.burgundy,
                  size: 20,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

void openTournamentDetail(BuildContext context, TournamentSeed event) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => TournamentDetailScreen(event: event),
    ),
  );
}

class TournamentDetailScreen extends StatefulWidget {
  const TournamentDetailScreen({required this.event, super.key});

  final TournamentSeed event;

  @override
  State<TournamentDetailScreen> createState() => _TournamentDetailScreenState();
}

class _TournamentDetailScreenState extends State<TournamentDetailScreen> {
  Timer? _tournamentRefreshTimer;
  bool _refreshingTournament = false;
  String tab = 'overview';

  @override
  void initState() {
    super.initState();
    if (widget.event.status == 'active') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(_refreshTournament());
      });
      _tournamentRefreshTimer = Timer.periodic(
        const Duration(seconds: 5),
        (_) => unawaited(_refreshTournament()),
      );
    }
  }

  @override
  void dispose() {
    _tournamentRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _refreshTournament() async {
    if (!mounted || _refreshingTournament) return;

    _refreshingTournament = true;
    final state = context.read<AppState>();
    try {
      await state.refreshTournaments();
      if (!mounted) return;
      if (_currentEvent(state).status != 'active') {
        _tournamentRefreshTimer?.cancel();
      }
    } finally {
      _refreshingTournament = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final event = _currentEvent(state);
    final registered = state.isRegisteredFor(event);
    final tabs = _tabsFor(event);

    return Scaffold(
      backgroundColor: PrototypeColors.screen,
      body: RefreshIndicator(
        color: PrototypeColors.burgundy,
        onRefresh: () => context.read<AppState>().refreshTournaments(),
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 28),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      decoration: const BoxDecoration(
                        color: PrototypeColors.header,
                        border: Border(
                          bottom: BorderSide(color: Color(0x1f21304e)),
                        ),
                      ),
                      child: Row(
                        children: [
                          SquareIconButton(
                            icon: Icons.chevron_left,
                            onTap: () => Navigator.of(context).pop(),
                            tooltip: 'Back',
                          ),
                          const SizedBox(width: 10),
                          ClipOval(
                            child: Image.asset(
                              'assets/juchess-logo.png',
                              width: 32,
                              height: 32,
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: SerifText(
                              'JuChess',
                              size: 15,
                              weight: FontWeight.w700,
                            ),
                          ),
                          if (event.status == 'active')
                            const LivePill(small: true)
                          else
                            StatusPill(event.status),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SerifText(
                            event.name,
                            size: 20,
                            weight: FontWeight.w700,
                            height: 1.3,
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: event.chips
                                .map((item) => ChipPill(item))
                                .toList(),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            event.current,
                            style: const TextStyle(
                              color: PrototypeColors.burgundy,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                      decoration: const BoxDecoration(
                        color: PrototypeColors.screen,
                        border: Border(
                          top: BorderSide(color: Color(0x1421304e)),
                          bottom: BorderSide(color: Color(0x1a21304e)),
                        ),
                      ),
                      child: Row(
                        children: [
                          for (var i = 0; i < tabs.length; i++) ...[
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => tab = tabs[i].key),
                                child: DetailTabPill(
                                  tabs[i].label,
                                  selected: tab == tabs[i].key,
                                ),
                              ),
                            ),
                            if (i != tabs.length - 1) const SizedBox(width: 6),
                          ],
                        ],
                      ),
                    ),
                    if (tab == 'overview')
                      _TournamentOverview(
                        event: event,
                        registered: registered,
                        registration: state.registrationFor(event),
                        onRegister: () async {
                          if (!state.signedIn) {
                            showAuthSheet(context);
                            return;
                          }
                          final appState = context.read<AppState>();
                          final messenger = ScaffoldMessenger.of(context);
                          final wasRegistered = appState.isRegisteredFor(event);
                          final ok = wasRegistered
                              ? await appState.cancelTournamentRegistration(
                                  event,
                                )
                              : await appState.registerForTournament(event);
                          if (!mounted) return;
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text(
                                ok
                                    ? wasRegistered
                                          ? 'Registration cancelled.'
                                          : 'Registration received. Organizers will review your spot.'
                                    : appState.error ??
                                          'Could not register right now.',
                              ),
                            ),
                          );
                        },
                        onMain: () => setState(() => tab = _mainTabKey(event)),
                      )
                    else if (tab == 'main')
                      _TournamentMainTab(event: event)
                    else if (tab == 'rounds')
                      _TournamentRoundsTab(event: event)
                    else
                      _TournamentPlayersTab(event: event),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<DetailTab> _tabsFor(TournamentSeed event) {
    final items = <DetailTab>[const DetailTab('overview', 'Registration')];
    items.add(const DetailTab('players', 'Players'));
    if (_hasBracketTab(event)) {
      items.add(DetailTab('main', _mainTabLabel(event)));
    } else {
      items.add(const DetailTab('rounds', 'Rounds'));
      items.add(const DetailTab('main', 'Standings'));
    }
    if (!items.any((item) => item.key == tab)) tab = 'overview';
    return items;
  }

  TournamentSeed _currentEvent(AppState state) {
    for (final item in state.tournamentItems) {
      if (item.rowId == widget.event.rowId) return item;
    }
    for (final item in state.tournamentItems) {
      if (item.id == widget.event.id) return item;
    }
    return widget.event;
  }
}

class DetailTab {
  const DetailTab(this.key, this.label);

  final String key;
  final String label;
}

class DetailTabPill extends StatelessWidget {
  const DetailTabPill(
    this.label, {
    required this.selected,
    this.live = false,
    super.key,
  });

  final String label;
  final bool selected;
  final bool live;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
      decoration: BoxDecoration(
        color: selected ? PrototypeColors.navy : Colors.transparent,
        border: Border.all(color: const Color(0x4021304e)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (live) ...[
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: PrototypeColors.burgundy,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: selected ? PrototypeColors.cream : PrototypeColors.navy,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TournamentOverview extends StatelessWidget {
  const _TournamentOverview({
    required this.event,
    required this.registered,
    required this.onRegister,
    required this.onMain,
    this.registration,
  });

  final TournamentSeed event;
  final bool registered;
  final MyRegistrationInfo? registration;
  final VoidCallback onRegister;
  final VoidCallback onMain;

  @override
  Widget build(BuildContext context) {
    final completed = event.status == 'completed';
    final active = event.status == 'active';
    final registrationOpen = isTournamentRegistrationOpen(event);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!completed && registered && registration != null) ...[
            _RegistrationStatusCard(registration: registration!),
            const SizedBox(height: 12),
          ],
          PrototypeButton(
            label: completed
                ? 'View final ${_mainTabLabel(event).toLowerCase()}'
                : active
                ? 'View live ${_mainTabLabel(event).toLowerCase()}'
                : !registrationOpen
                ? 'Registration closed'
                : registered
                ? 'Cancel registration'
                : 'Register',
            onTap: registrationOpen ? onRegister : onMain,
          ),
        ],
      ),
    );
  }
}

class _RegistrationStatusCard extends StatelessWidget {
  const _RegistrationStatusCard({required this.registration});

  final MyRegistrationInfo registration;

  @override
  Widget build(BuildContext context) {
    final status = registration.status;

    if (status == 'pending') {
      return const _RegistrationNotice(
        title: 'Registration pending',
        body:
            'Your spot is waiting for organizer approval. Your check-in code '
            'will appear here once you are accepted.',
      );
    }

    if (status == 'waitlisted') {
      return const _RegistrationNotice(
        title: 'You are on the waitlist',
        body: 'The organizers will move you in if a spot opens up.',
      );
    }

    final code = registration.checkInCode;
    if (code == null || code.isEmpty) {
      return const _RegistrationNotice(
        title: 'You are in!',
        body: 'Your check-in code is on its way. Check back before the event.',
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF8EC),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: const Color(0x8CA98A3F)),
      ),
      child: Row(
        children: [
          QrImageView(
            data: registration.qrPayload,
            version: QrVersions.auto,
            size: 104,
            backgroundColor: const Color(0xFFFDF8EC),
            eyeStyle: const QrEyeStyle(
              eyeShape: QrEyeShape.square,
              color: PrototypeColors.navy,
            ),
            dataModuleStyle: const QrDataModuleStyle(
              dataModuleShape: QrDataModuleShape.square,
              color: PrototypeColors.navy,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CHECK-IN CODE',
                  style: TextStyle(
                    color: Color(0x9921304e),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  code,
                  style: const TextStyle(
                    color: PrototypeColors.navy,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  registration.checkedIn
                      ? 'Checked in at the venue'
                      : 'Show this at the venue to check in',
                  style: const TextStyle(
                    color: Color(0x9921304e),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RegistrationNotice extends StatelessWidget {
  const _RegistrationNotice({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF8EC),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: const Color(0x4021304e)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: PrototypeColors.navy,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            body,
            style: const TextStyle(color: Color(0x9921304e), fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}

class PlayerColorLine extends StatelessWidget {
  const PlayerColorLine({
    required this.color,
    required this.name,
    this.border = false,
    super.key,
  });

  final Color color;
  final String name;
  final bool border;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 11,
          height: 11,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
            border: border ? Border.all(color: const Color(0x6621304e)) : null,
          ),
        ),
        const SizedBox(width: 7),
        Expanded(
          child: Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}

class _TournamentMainTab extends StatelessWidget {
  const _TournamentMainTab({required this.event});

  final TournamentSeed event;

  @override
  Widget build(BuildContext context) {
    if (_mainTabLabel(event) == 'Bracket') {
      if (!_hasPublishedBracket(event)) {
        return const Padding(
          padding: EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: TournamentEmptyPanel(
            title: 'Bracket not published',
            subtitle:
                'The bracket will appear after the organizer publishes it.',
          ),
        );
      }
      final snapshot = event.bracketSnapshot;
      if (snapshot != null &&
          !snapshot.isDouble &&
          snapshot.rounds.isNotEmpty) {
        return TournamentBracketView(rounds: snapshot.rounds);
      }
      if (_isDoubleElimination(event)) {
        return TournamentDoubleEliminationBracketView(event: event);
      }
      return TournamentBracketView(rounds: buildSingleEliminationRounds(event));
    }

    final players = event.registeredPlayers;
    if (players.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 14, 16, 0),
        child: TournamentEmptyPanel(
          title: 'No players yet',
          subtitle: 'Registered players will appear here.',
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: PrototypeCard(
        margin: EdgeInsets.zero,
        padding: EdgeInsets.zero,
        child: Column(
          children: players.map((player) {
            return StandingRow(
              rank: player.rank,
              name: player.name,
              rating: player.rating,
              points: '0',
              record: '0-0-0',
            );
          }).toList(),
        ),
      ),
    );
  }
}

class TournamentDoubleEliminationBracketView extends StatefulWidget {
  const TournamentDoubleEliminationBracketView({
    required this.event,
    super.key,
  });

  final TournamentSeed event;

  @override
  State<TournamentDoubleEliminationBracketView> createState() =>
      _TournamentDoubleEliminationBracketViewState();
}

class _TournamentDoubleEliminationBracketViewState
    extends State<TournamentDoubleEliminationBracketView> {
  int _selectedView = 0;

  List<RoundSeed> get _rounds {
    final snapshot = widget.event.bracketSnapshot;
    if (snapshot != null && snapshot.isDouble) {
      return switch (_selectedView) {
        1 => snapshot.losers,
        2 => snapshot.finalRounds,
        _ => snapshot.winners,
      };
    }

    final brackets = buildDoubleEliminationRounds(widget.event);
    return switch (_selectedView) {
      1 => brackets.losers,
      2 => brackets.finalRounds,
      _ => brackets.winners,
    };
  }

  @override
  Widget build(BuildContext context) {
    const views = ['Winners', 'Losers', 'Final'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (var i = 0; i < views.length; i++) ...[
                  GestureDetector(
                    onTap: () => setState(() => _selectedView = i),
                    child: DetailTabPill(
                      views[i],
                      selected: i == _selectedView,
                    ),
                  ),
                  if (i != views.length - 1) const SizedBox(width: 7),
                ],
              ],
            ),
          ),
        ),
        TournamentBracketView(
          key: ValueKey('double-bracket-$_selectedView'),
          rounds: _rounds,
        ),
      ],
    );
  }
}

class TournamentBracketView extends StatefulWidget {
  const TournamentBracketView({required this.rounds, super.key});

  final List<RoundSeed> rounds;

  @override
  State<TournamentBracketView> createState() => _TournamentBracketViewState();
}

class _TournamentBracketViewState extends State<TournamentBracketView> {
  final ScrollController _controller = ScrollController();
  int _selectedRound = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _focusRound(int index) {
    setState(() => _selectedRound = index);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_controller.hasClients) return;
      final max = _controller.position.maxScrollExtent;
      final target = (index * BracketMetrics.scrollStep).clamp(0.0, max);
      unawaited(
        _controller.animateTo(
          target,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final maxMatches = widget.rounds.fold<int>(
      1,
      (value, round) => math.max(value, round.games.length),
    );
    final compactLayout = BracketMetrics.shouldUseCompactLayout(widget.rounds);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.hardEdge,
            child: Row(
              children: [
                for (var i = 0; i < widget.rounds.length; i++) ...[
                  BracketRoundChip(
                    label: widget.rounds[i].label,
                    selected: i == _selectedRound,
                    onPressed: () => _focusRound(i),
                  ),
                  if (i != widget.rounds.length - 1) const SizedBox(width: 7),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            controller: _controller,
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.hardEdge,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < widget.rounds.length; i++) ...[
                  BracketColumn(
                    compactLayout: compactLayout,
                    maxMatches: maxMatches,
                    round: widget.rounds[i],
                    roundIndex: i,
                  ),
                  if (i != widget.rounds.length - 1)
                    BracketConnector(
                      compactLayout: compactLayout,
                      maxMatches: maxMatches,
                      roundIndex: i,
                      sourceMatches: widget.rounds[i].games,
                      targetMatches: widget.rounds[i + 1].games.length,
                    ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Scroll sideways to follow the bracket · ✓ marks the winner',
            style: TextStyle(color: Color(0x8021304e), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class BracketMetrics {
  const BracketMetrics._();

  static const columnWidth = 184.0;
  static const matchHeight = 92.0;
  static const baseGap = 13.0;
  static const basePitch = matchHeight + baseGap;
  static const labelBand = 31.0;
  static const connectorWidth = 52.0;
  static const scrollStep = columnWidth + connectorWidth;

  static double roundOffset(int roundIndex) {
    final step = 1 << roundIndex;
    return basePitch * (step - 1) / 2;
  }

  static double matchTop(
    int roundIndex,
    int matchIndex, {
    required bool compactLayout,
    required int matchCount,
    required int maxMatches,
  }) {
    if (compactLayout) {
      return compactMatchTop(
        maxMatches: maxMatches,
        matchCount: matchCount,
        matchIndex: matchIndex,
      );
    }

    return labelBand +
        roundOffset(roundIndex) +
        matchIndex * basePitch * (1 << roundIndex);
  }

  static double matchCenter(
    int roundIndex,
    int matchIndex, {
    required bool compactLayout,
    required int matchCount,
    required int maxMatches,
  }) {
    return matchTop(
          roundIndex,
          matchIndex,
          compactLayout: compactLayout,
          matchCount: matchCount,
          maxMatches: maxMatches,
        ) +
        matchHeight / 2;
  }

  static double boardHeight(int maxMatches) {
    return labelBand + math.max(1, maxMatches) * basePitch - baseGap;
  }

  static double compactMatchTop({
    required int maxMatches,
    required int matchCount,
    required int matchIndex,
  }) {
    final safeMatchCount = math.max(1, matchCount);
    final availableHeight = boardHeight(maxMatches) - labelBand;
    final groupHeight =
        safeMatchCount * matchHeight + (safeMatchCount - 1) * baseGap;
    final offset = math.max(0.0, (availableHeight - groupHeight) / 2);
    return labelBand + offset + matchIndex * basePitch;
  }

  static bool shouldUseCompactLayout(List<RoundSeed> rounds) {
    for (var i = 0; i < rounds.length - 1; i++) {
      final current = rounds[i].games.length;
      final next = rounds[i + 1].games.length;
      if (current == 0 || next == 0) continue;
      if (next >= current) return true;
      if (next > (current / 2).ceil()) return true;
    }
    return false;
  }
}

class BracketRoundChip extends StatelessWidget {
  const BracketRoundChip({
    required this.label,
    required this.selected,
    required this.onPressed,
    super.key,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        minimumSize: const Size(0, 36),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        backgroundColor: selected ? PrototypeColors.navy : Colors.transparent,
        foregroundColor: selected
            ? PrototypeColors.cream
            : PrototypeColors.navy,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
          side: const BorderSide(color: Color(0x3821304e)),
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class BracketColumn extends StatelessWidget {
  const BracketColumn({
    required this.compactLayout,
    required this.maxMatches,
    required this.round,
    required this.roundIndex,
    super.key,
  });

  final bool compactLayout;
  final int maxMatches;
  final RoundSeed round;
  final int roundIndex;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: BracketMetrics.columnWidth,
      height: BracketMetrics.boardHeight(maxMatches),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Text(
              round.label.toUpperCase(),
              style: const TextStyle(
                color: Color(0x8c21304e),
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
              ),
            ),
          ),
          for (var i = 0; i < round.games.length; i++)
            Positioned(
              top: BracketMetrics.matchTop(
                roundIndex,
                i,
                compactLayout: compactLayout,
                matchCount: round.games.length,
                maxMatches: maxMatches,
              ),
              left: 0,
              right: 0,
              height: BracketMetrics.matchHeight,
              child: BracketMatchCard(
                match: round.games[i],
                roundLabel: round.label,
              ),
            ),
        ],
      ),
    );
  }
}

class BracketConnector extends StatelessWidget {
  const BracketConnector({
    required this.compactLayout,
    required this.maxMatches,
    required this.roundIndex,
    required this.sourceMatches,
    required this.targetMatches,
    super.key,
  });

  final bool compactLayout;
  final int maxMatches;
  final int roundIndex;
  final List<MatchSeed> sourceMatches;
  final int targetMatches;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: BracketMetrics.connectorWidth,
      height: BracketMetrics.boardHeight(maxMatches),
      child: CustomPaint(
        painter: BracketConnectorPainter(
          compactLayout: compactLayout,
          maxMatches: maxMatches,
          roundIndex: roundIndex,
          sourceMatches: sourceMatches,
          targetMatches: targetMatches,
        ),
      ),
    );
  }
}

class BracketConnectorPainter extends CustomPainter {
  const BracketConnectorPainter({
    required this.compactLayout,
    required this.maxMatches,
    required this.roundIndex,
    required this.sourceMatches,
    required this.targetMatches,
  });

  final bool compactLayout;
  final int maxMatches;
  final int roundIndex;
  final List<MatchSeed> sourceMatches;
  final int targetMatches;

  @override
  void paint(Canvas canvas, Size size) {
    final mutedPaint = Paint()
      ..color = const Color(0x3821304e)
      ..strokeWidth = 1.45
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final livePaint = Paint()
      ..color = const Color(0xcca98a3f)
      ..strokeWidth = 1.65
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final decidedPaint = Paint()
      ..color = PrototypeColors.burgundy
      ..strokeWidth = 2.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final endPaint = Paint()
      ..color = const Color(0x667d2434)
      ..style = PaintingStyle.fill;

    for (
      var sourceIndex = 0;
      sourceIndex < sourceMatches.length;
      sourceIndex++
    ) {
      final match = sourceMatches[sourceIndex];
      final targetIndex = match.nextIndex ?? (sourceIndex ~/ 2);
      if (targetIndex >= targetMatches) continue;

      final sourceY = BracketMetrics.matchCenter(
        roundIndex,
        sourceIndex,
        compactLayout: compactLayout,
        matchCount: sourceMatches.length,
        maxMatches: maxMatches,
      );
      final targetY = BracketMetrics.matchCenter(
        roundIndex + 1,
        targetIndex,
        compactLayout: compactLayout,
        matchCount: targetMatches,
        maxMatches: maxMatches,
      );
      final midX = size.width / 2;
      final paint = switch (match.result.toLowerCase()) {
        'live' => livePaint,
        '1-0' || '0-1' => decidedPaint,
        _ => mutedPaint,
      };

      final path = Path()
        ..moveTo(0, sourceY)
        ..cubicTo(midX, sourceY, midX, targetY, size.width, targetY);
      canvas.drawPath(path, paint);
      canvas.drawCircle(Offset(size.width, targetY), 2.0, endPaint);
    }
  }

  @override
  bool shouldRepaint(covariant BracketConnectorPainter oldDelegate) {
    return oldDelegate.roundIndex != roundIndex ||
        oldDelegate.sourceMatches != sourceMatches ||
        oldDelegate.targetMatches != targetMatches ||
        oldDelegate.compactLayout != compactLayout ||
        oldDelegate.maxMatches != maxMatches;
  }
}

class BracketMatchCard extends StatelessWidget {
  const BracketMatchCard({
    required this.match,
    required this.roundLabel,
    super.key,
  });

  final MatchSeed match;
  final String roundLabel;

  bool get _live => match.result.toLowerCase() == 'live';
  bool get _whiteWon => match.result == '1-0';
  bool get _blackWon => match.result == '0-1';

  @override
  Widget build(BuildContext context) {
    final borderColor = _live
        ? const Color(0x807d2434)
        : _whiteWon || _blackWon
        ? const Color(0x66a98a3f)
        : const Color(0x2421304e);
    final content = Container(
      decoration: BoxDecoration(
        color: _live ? const Color(0xfffff7ee) : const Color(0xfffffcf4),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1221304e),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          if (match.matchNumber != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(11, 6, 11, 0),
              child: Row(
                children: [
                  Text(
                    'MATCH ${match.matchNumber}',
                    style: const TextStyle(
                      color: Color(0x8a21304e),
                      fontSize: 8.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          BracketPlayerRow(
            color: 'white',
            name: match.white,
            winner: _whiteWon,
            faded: _blackWon,
            bottomBorder: true,
          ),
          BracketPlayerRow(
            color: 'black',
            name: match.black,
            winner: _blackWon,
            faded: _whiteWon,
            bottomBorder: false,
          ),
          if (_live)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: const BoxDecoration(
                color: Color(0x127d2434),
                border: Border(top: BorderSide(color: Color(0x337d2434))),
              ),
              child: const Row(
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: PrototypeColors.burgundy,
                      shape: BoxShape.circle,
                    ),
                    child: SizedBox(width: 5, height: 5),
                  ),
                  SizedBox(width: 5),
                  Text(
                    'LIVE',
                    style: TextStyle(
                      color: PrototypeColors.burgundy,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );

    if (match.gameId == null) return content;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => openTournamentGameDetail(context, match, roundLabel),
        child: content,
      ),
    );
  }
}

class BracketPlayerRow extends StatelessWidget {
  const BracketPlayerRow({
    required this.color,
    required this.name,
    required this.winner,
    required this.faded,
    required this.bottomBorder,
    super.key,
  });

  final String color;
  final String name;
  final bool winner;
  final bool faded;
  final bool bottomBorder;

  bool get _pending => name == 'TBD' || name.startsWith('Reset ');

  bool get _placeholder =>
      name.startsWith('Winner ') || name.startsWith('Loser ');

  @override
  Widget build(BuildContext context) {
    final opacity = _pending
        ? 0.45
        : (_placeholder ? 0.68 : (faded ? 0.42 : 1.0));
    return Expanded(
      child: Opacity(
        opacity: opacity,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: BoxDecoration(
            border: bottomBorder
                ? const Border(bottom: BorderSide(color: Color(0x1421304e)))
                : null,
          ),
          child: Row(
            children: [
              ChessColorBadge(color: color),
              const SizedBox(width: 7),
              if (winner) ...[
                const Text(
                  '✓',
                  style: TextStyle(
                    color: PrototypeColors.gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  _pending ? 'TBD' : name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: PrototypeColors.navy,
                    fontSize: 12.5,
                    fontWeight: winner ? FontWeight.w800 : FontWeight.w500,
                    fontStyle: _pending || _placeholder
                        ? FontStyle.italic
                        : FontStyle.normal,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ChessColorBadge extends StatelessWidget {
  const ChessColorBadge({required this.color, this.compact = false, super.key});

  final String color;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final isWhite = color == 'white';
    final size = compact ? 17.0 : 20.0;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: isWhite ? Colors.white : PrototypeColors.navy,
        border: Border.all(color: PrototypeColors.navy.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        isWhite ? 'W' : 'B',
        style: TextStyle(
          color: isWhite ? PrototypeColors.navy : Colors.white,
          fontFamily: 'monospace',
          fontSize: compact ? 8 : 9,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class StandingRow extends StatelessWidget {
  const StandingRow({
    required this.rank,
    required this.name,
    required this.rating,
    required this.points,
    required this.record,
    super.key,
  });

  final int rank;
  final String name;
  final int rating;
  final String points;
  final String record;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x1421304e))),
      ),
      child: Row(
        children: [
          Text(
            '$rank',
            style: const TextStyle(
              color: Color(0xff79622a),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                  '$rating · $record',
                  style: const TextStyle(
                    color: Color(0x8c21304e),
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          Text(
            points,
            style: const TextStyle(
              fontFamily: 'monospace',
              color: PrototypeColors.navy,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _TournamentRoundsTab extends StatefulWidget {
  const _TournamentRoundsTab({required this.event});

  final TournamentSeed event;

  @override
  State<_TournamentRoundsTab> createState() => _TournamentRoundsTabState();
}

class _TournamentRoundsTabState extends State<_TournamentRoundsTab> {
  late String _stageTab;

  @override
  void initState() {
    super.initState();
    _stageTab = _initialStageTab(widget.event);
  }

  @override
  void didUpdateWidget(covariant _TournamentRoundsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.event.id != widget.event.id ||
        oldWidget.event.current != widget.event.current) {
      _stageTab = _initialStageTab(widget.event);
    }
  }

  @override
  Widget build(BuildContext context) {
    final showStageNav = _hasStageRounds(widget.event);
    final rounds = _roundsForStage(widget.event, _stageTab);
    if (rounds.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 14, 16, 0),
        child: TournamentEmptyPanel(
          title: 'No pairings yet',
          subtitle: 'Pairings will be published when Round 1 starts.',
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Column(
        children: [
          if (showStageNav) ...[
            StageRoundNav(
              selected: _stageTab,
              onSelected: (value) => setState(() => _stageTab = value),
            ),
            const SizedBox(height: 12),
          ],
          ...rounds.map(
            (round) => TournamentRoundPanel(event: widget.event, round: round),
          ),
        ],
      ),
    );
  }
}

class TournamentRoundPanel extends StatelessWidget {
  const TournamentRoundPanel({
    required this.event,
    required this.round,
    super.key,
  });

  final TournamentSeed event;
  final RoundSeed round;

  @override
  Widget build(BuildContext context) {
    return PrototypeCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
            decoration: const BoxDecoration(
              color: Color(0xfffaf7f1),
              border: Border(bottom: BorderSide(color: Color(0xffe6dfd3))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${round.label} pairings',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: PrototypeColors.navy,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  _roundPanelStatus(event, round),
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                    color: Color(0xff8b8577),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          for (var index = 0; index < round.games.length; index++)
            TournamentPairingRow(
              board: index + 1,
              bottomBorder: index != round.games.length - 1,
              event: event,
              match: round.games[index],
              roundLabel: round.label,
            ),
        ],
      ),
    );
  }
}

class TournamentPairingRow extends StatelessWidget {
  const TournamentPairingRow({
    required this.board,
    required this.bottomBorder,
    required this.event,
    required this.match,
    required this.roundLabel,
    super.key,
  });

  final int board;
  final bool bottomBorder;
  final TournamentSeed event;
  final MatchSeed match;
  final String roundLabel;

  @override
  Widget build(BuildContext context) {
    final content = Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: BoxDecoration(
        border: bottomBorder
            ? const Border(bottom: BorderSide(color: Color(0xfff4f0e8)))
            : null,
      ),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text(
              '#$board',
              style: const TextStyle(
                color: Color(0xff8b8577),
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Expanded(
            child: TournamentPairingPlayer(
              alignEnd: true,
              color: 'white',
              event: event,
              name: match.white,
            ),
          ),
          const SizedBox(
            width: 44,
            child: Text(
              'vs',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: PrototypeColors.burgundy,
                fontSize: 11,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Expanded(
            child: TournamentPairingPlayer(
              color: 'black',
              event: event,
              name: match.black,
            ),
          ),
        ],
      ),
    );

    if (match.gameId == null) return content;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => openTournamentGameDetail(context, match, roundLabel),
        child: content,
      ),
    );
  }
}

class TournamentPairingPlayer extends StatelessWidget {
  const TournamentPairingPlayer({
    required this.color,
    required this.event,
    required this.name,
    this.alignEnd = false,
    super.key,
  });

  final bool alignEnd;
  final String color;
  final TournamentSeed event;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: alignEnd
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      children: [
        Text(
          name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: alignEnd ? TextAlign.right : TextAlign.left,
          style: const TextStyle(
            color: PrototypeColors.navy,
            fontSize: 13,
            fontWeight: FontWeight.w900,
            height: 1.15,
          ),
        ),
        const SizedBox(height: 2),
        Row(
          mainAxisAlignment: alignEnd
              ? MainAxisAlignment.end
              : MainAxisAlignment.start,
          children: [
            ChessColorBadge(color: color, compact: true),
            const SizedBox(width: 6),
            Text(
              '${_ratingForPlayerName(event, name)}',
              style: const TextStyle(
                color: Color(0xff8b8577),
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class StageRoundNav extends StatelessWidget {
  const StageRoundNav({
    required this.selected,
    required this.onSelected,
    super.key,
  });

  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0x1021304e),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x2021304e)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => onSelected('stage-one'),
              child: TabPill('Stage One', selected: selected == 'stage-one'),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => onSelected('stage-two'),
              child: TabPill('Stage Two', selected: selected == 'stage-two'),
            ),
          ),
        ],
      ),
    );
  }
}

class _TournamentPlayersTab extends StatelessWidget {
  const _TournamentPlayersTab({required this.event});

  final TournamentSeed event;

  @override
  Widget build(BuildContext context) {
    final players = event.registeredPlayers;
    if (players.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 14, 16, 0),
        child: TournamentEmptyPanel(
          title: 'No players yet',
          subtitle: 'Registered players will appear here.',
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: PrototypeCard(
        margin: EdgeInsets.zero,
        padding: EdgeInsets.zero,
        child: Column(
          children: players
              .map(
                (player) => LeaderboardRow(
                  rank: player.rank,
                  name: player.name,
                  username: player.username,
                  rating: player.rating,
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class MatchLine extends StatelessWidget {
  const MatchLine({
    required this.white,
    required this.black,
    required this.result,
    super.key,
  });

  final String white;
  final String black;
  final String result;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        children: [
          Expanded(
            child: PlayerColorLine(
              color: PrototypeColors.surface,
              name: white,
              border: true,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            result,
            style: const TextStyle(
              color: PrototypeColors.navy,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: PlayerColorLine(color: const Color(0xff232a36), name: black),
          ),
        ],
      ),
    );
  }
}

class TournamentEmptyPanel extends StatelessWidget {
  const TournamentEmptyPanel({
    required this.title,
    required this.subtitle,
    super.key,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return PrototypeCard(
      margin: EdgeInsets.zero,
      child: Column(
        children: [
          const Text(
            '♙',
            style: TextStyle(color: PrototypeColors.burgundy, fontSize: 24),
          ),
          const SizedBox(height: 8),
          SerifText(title, size: 17, weight: FontWeight.w700),
          const SizedBox(height: 4),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0x9921304e), fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}

String _mainTabLabel(TournamentSeed event) {
  final lower = event.format.toLowerCase();
  if (_hasBracketTab(event)) return 'Bracket';
  if (lower.contains('arena')) return 'Standings';
  if (lower.contains('team')) return 'Teams';
  if (lower.contains('stage')) return 'Stages';
  return 'Standings';
}

String _mainTabKey(TournamentSeed event) => 'main';

String _initialStageTab(TournamentSeed event) {
  final lower = event.current.toLowerCase();
  return lower.contains('stage 2') || lower.contains('stage two')
      ? 'stage-two'
      : 'stage-one';
}

bool _hasStageRounds(TournamentSeed event) {
  final lower = event.format.toLowerCase();
  return lower.contains('stage') || lower.contains('multi');
}

List<RoundSeed> _roundsForStage(TournamentSeed event, String stageTab) {
  if (event.publishedRounds.isEmpty) return const [];
  if (!_hasStageRounds(event)) return event.publishedRounds;

  return event.publishedRounds
      .asMap()
      .entries
      .map(
        (entry) => RoundSeed(
          stageTab == 'stage-two'
              ? entry.key == 0
                    ? 'Stage Two - Playoffs'
                    : 'Stage Two - Round ${entry.key + 1}'
              : 'Stage One - Round ${entry.key + 1}',
          entry.value.games,
        ),
      )
      .toList();
}

String _roundPanelStatus(TournamentSeed event, RoundSeed round) {
  if (event.status == 'upcoming') return 'Published pairings';
  if (round.games.any((game) => game.result == 'live')) {
    return 'Live current round';
  }
  if (round.games.every((game) => game.result == '-')) return 'Next round';
  return 'Recorded round';
}

int _ratingForPlayerName(TournamentSeed event, String name) {
  for (final player in event.registeredPlayers) {
    if (player.name == name) return player.rating;
  }
  for (final player in clubPlayers) {
    if (player.name == name) return player.rating;
  }
  return 1200;
}

bool _hasBracketTab(TournamentSeed event) {
  final lower = event.format.toLowerCase();
  return lower.contains('knockout') || lower.contains('elimination');
}

bool _hasPublishedBracket(TournamentSeed event) {
  final snapshot = event.bracketSnapshot;
  if (snapshot != null) {
    if (snapshot.isDouble) {
      return snapshot.winners.isNotEmpty ||
          snapshot.losers.isNotEmpty ||
          snapshot.finalRounds.isNotEmpty;
    }
    return snapshot.rounds.isNotEmpty;
  }
  return event.publishedRounds.isNotEmpty;
}

bool _isDoubleElimination(TournamentSeed event) {
  return event.format.toLowerCase().contains('double elimination');
}

class TournamentInfoTile extends StatelessWidget {
  const TournamentInfoTile({
    required this.icon,
    required this.label,
    required this.value,
    super.key,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: cardDecoration(radius: 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: PrototypeColors.burgundy, size: 20),
          const Spacer(),
          Text(
            label,
            style: const TextStyle(
              color: Color(0x9921304e),
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: PrototypeColors.navy,
              fontSize: 12.4,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class TournamentStep extends StatelessWidget {
  const TournamentStep({
    required this.done,
    required this.label,
    required this.value,
    super.key,
  });

  final bool done;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          done ? Icons.check_circle : Icons.radio_button_unchecked,
          color: done ? PrototypeColors.burgundy : const Color(0x8021304e),
          size: 19,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: PrototypeColors.navy,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Text(
          value,
          style: const TextStyle(color: Color(0x9921304e), fontSize: 12),
        ),
      ],
    );
  }
}

class TournamentDivider extends StatelessWidget {
  const TournamentDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 12),
      child: Divider(height: 1, color: Color(0x1821304e)),
    );
  }
}

class TournamentEmptyState extends StatelessWidget {
  const TournamentEmptyState({required this.filter, super.key});

  final String filter;

  @override
  Widget build(BuildContext context) {
    final ready = context.watch<AppState>().appwriteReady;
    final label = filter == 'active'
        ? 'active'
        : filter == 'upcoming'
        ? 'upcoming'
        : 'completed';

    return PrototypeCard(
      margin: EdgeInsets.zero,
      child: Column(
        children: [
          const Text(
            '♞',
            style: TextStyle(
              color: PrototypeColors.burgundy,
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          SerifText('No $label tournaments', size: 17, weight: FontWeight.w700),
          const SizedBox(height: 4),
          Text(
            ready
                ? 'Create one in the control center to show it here.'
                : 'Tournaments will appear here after they are published.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0x9921304e), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class GamesScreen extends StatelessWidget {
  const GamesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScroll(
      children: [
        const PrototypeHeader(title: 'Games'),
        const SizedBox(height: 16),
        BigActionCard(
          title: 'Game Review',
          subtitle: 'Review recent tournament games',
          icon: '♞',
          filled: true,
          onTap: () => openPrototypeRoute(context, const GameReviewScreen()),
        ),
        BigActionCard(
          title: 'Puzzles',
          subtitle: 'Solve tactics from real chess patterns',
          icon: '♛',
          onTap: () => openPrototypeRoute(context, const PuzzlesScreen()),
        ),
        BigActionCard(
          title: 'New Analysis',
          subtitle: 'Set up a board and record lines',
          icon: '♝',
          onTap: () => openPrototypeRoute(context, const NewAnalysisScreen()),
        ),
      ],
    );
  }
}

class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScroll(
      children: [
        const PrototypeHeader(title: 'Tools'),
        const SizedBox(height: 16),
        ToolTile(
          title: 'Chess Clock',
          subtitle: 'Run over-the-board time controls',
          icon: '5:00',
          onTap: () => openPrototypeRoute(context, const ChessClockScreen()),
        ),
        ToolTile(
          title: 'Analysis Board',
          subtitle: 'Set up any position and save lines',
          icon: '♟',
          onTap: () => openPrototypeRoute(context, const AnalysisBoardScreen()),
        ),
        ToolTile(
          title: 'Saved Analyses',
          subtitle: 'Open lines saved to your profile',
          icon: '♜',
          onTap: () => openPrototypeRoute(context, const SavedAnalysesScreen()),
        ),
      ],
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return AppScroll(
      children: [
        const PrototypeHeader(title: 'Profile'),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 26, 16, 0),
          child: Column(
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: const Color(0x1221304e),
                  border: Border.all(color: const Color(0x3321304e)),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text(
                    '♟',
                    style: TextStyle(fontSize: 30, color: Color(0x6621304e)),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              SerifText(
                state.signedIn
                    ? state.userName ?? 'Club profile'
                    : 'Guest profile',
                size: 22,
                weight: FontWeight.w700,
              ),
              const SizedBox(height: 7),
              Text(
                state.signedIn
                    ? state.userEmail ??
                          'Your JuChess account is active on this device.'
                    : 'Sign in to view your rating, registrations, saved analyses, and achievements.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0x9921304e), height: 1.45),
              ),
              const SizedBox(height: 18),
              PrototypeButton(
                label: state.signedIn ? 'Sign out' : 'Sign in',
                onTap: () {
                  if (state.signedIn) {
                    context.read<AppState>().signOut();
                  } else {
                    showAuthSheet(context);
                  }
                },
              ),
              if (!state.signedIn) ...[
                const SizedBox(height: 10),
                TextButton(
                  onPressed: () => showAuthSheet(context, createAccount: true),
                  child: const Text(
                    'New to the club? Sign up',
                    style: TextStyle(
                      color: PrototypeColors.burgundy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class BigActionCard extends StatelessWidget {
  const BigActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.filled = false,
    super.key,
  });

  final String title;
  final String subtitle;
  final String icon;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
          decoration: BoxDecoration(
            color: filled ? PrototypeColors.burgundy : PrototypeColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: filled ? PrototypeColors.burgundy : PrototypeColors.navy,
              width: filled ? 0 : 1.5,
            ),
          ),
          child: Row(
            children: [
              Text(
                icon,
                style: TextStyle(
                  color: filled
                      ? PrototypeColors.cream
                      : PrototypeColors.burgundy,
                  fontSize: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: filled
                            ? PrototypeColors.cream
                            : PrototypeColors.navy,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: filled
                            ? const Color(0xccf7f1e3)
                            : const Color(0x9921304e),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: filled ? PrototypeColors.cream : PrototypeColors.navy,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ToolTile extends StatelessWidget {
  const ToolTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    super.key,
  });

  final String title;
  final String subtitle;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: cardDecoration(radius: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0x147d2434),
                  border: Border.all(color: const Color(0x337d2434)),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Center(
                  child: Text(
                    icon,
                    style: const TextStyle(
                      color: PrototypeColors.burgundy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: PrototypeColors.navy,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: Color(0x9921304e),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Color(0x6621304e)),
            ],
          ),
        ),
      ),
    );
  }
}

class PrototypeRouteScaffold extends StatelessWidget {
  const PrototypeRouteScaffold({
    required this.title,
    required this.children,
    this.trailing,
    super.key,
  });

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PrototypeColors.screen,
      body: AppScroll(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: const BoxDecoration(
              color: PrototypeColors.header,
              border: Border(bottom: BorderSide(color: Color(0x1f21304e))),
            ),
            child: Row(
              children: [
                SquareIconButton(
                  icon: Icons.chevron_left,
                  onTap: () => Navigator.of(context).pop(),
                  tooltip: 'Back',
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SerifText(title, size: 18, weight: FontWeight.w700),
                ),
                ?trailing,
              ],
            ),
          ),
          ...children,
        ],
      ),
    );
  }
}

class SquareIconButton extends StatelessWidget {
  const SquareIconButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    super.key,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, size: 21),
      style: IconButton.styleFrom(
        backgroundColor: PrototypeColors.surface,
        foregroundColor: PrototypeColors.navy,
        fixedSize: const Size(40, 40),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(0x2e21304e)),
        ),
      ),
    );
  }
}

class LeaderboardScreen extends StatelessWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Leaderboard',
      children: [
        const SizedBox(height: 14),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: EdgeInsets.zero,
          child: Column(
            children: clubPlayers
                .map(
                  (player) => LeaderboardRow(
                    rank: player.rank,
                    name: player.name,
                    username: player.username,
                    rating: player.rating,
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}

class LeaderboardRow extends StatelessWidget {
  const LeaderboardRow({
    required this.rank,
    required this.name,
    required this.username,
    required this.rating,
    super.key,
  });

  final int rank;
  final String name;
  final String username;
  final int rating;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x1421304e))),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 13,
            backgroundColor: const Color(0x24a98a3f),
            child: Text(
              '$rank',
              style: const TextStyle(
                color: Color(0xff79622a),
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '@$username',
                  style: const TextStyle(
                    color: Color(0x8c21304e),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$rating',
            style: const TextStyle(
              fontFamily: 'monospace',
              color: PrototypeColors.navy,
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class GameReviewScreen extends StatelessWidget {
  const GameReviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Game Review',
      children: [
        const SizedBox(height: 14),
        PrototypeOptionTile(
          title: 'Chess.com games',
          subtitle: 'Import from your linked account',
          icon: '♘',
          onTap: () => openPrototypeRoute(
            context,
            const PickGameScreen(title: 'Chess.com games'),
          ),
        ),
        PrototypeOptionTile(
          title: 'Lichess games',
          subtitle: 'Import from your linked account',
          icon: '♞',
          onTap: () => openPrototypeRoute(
            context,
            const PickGameScreen(title: 'Lichess games'),
          ),
        ),
        PrototypeOptionTile(
          title: 'Tournament games',
          subtitle: 'Your club tournament history',
          icon: '♜',
          onTap: () => openPrototypeRoute(
            context,
            const PickGameScreen(title: 'Tournament games'),
          ),
        ),
        PrototypeOptionTile(
          title: 'Upload / import PGN file',
          subtitle: 'Review a game from a PGN',
          icon: 'PGN',
          onTap: () => openPrototypeRoute(
            context,
            const AnalysisBoardScreen(mode: 'review'),
          ),
        ),
        PrototypeOptionTile(
          title: 'Upload / import FEN file',
          subtitle: 'Review from a position',
          icon: 'FEN',
          onTap: () => openPrototypeRoute(
            context,
            const AnalysisBoardScreen(mode: 'review'),
          ),
        ),
      ],
    );
  }
}

class PuzzlesScreen extends StatelessWidget {
  const PuzzlesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Puzzles',
      children: [
        const SizedBox(height: 14),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              SerifText('Daily tactics', size: 18, weight: FontWeight.w700),
              SizedBox(height: 5),
              Text(
                'Pick a puzzle, find the best move, and solve it on the board.',
                style: TextStyle(color: Color(0x9921304e), height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ...puzzleSeeds.map(
          (puzzle) => PrototypeOptionTile(
            title: puzzle.title,
            subtitle:
                '${puzzle.theme} · ${puzzle.rating} · ${_sideToMoveLabel(puzzle.setupMoves)}',
            icon: puzzle.icon,
            onTap: () =>
                openPrototypeRoute(context, PuzzleBoardScreen(puzzle: puzzle)),
          ),
        ),
      ],
    );
  }
}

class PuzzleBoardScreen extends StatefulWidget {
  const PuzzleBoardScreen({required this.puzzle, super.key});

  final PuzzleSeed puzzle;

  @override
  State<PuzzleBoardScreen> createState() => _PuzzleBoardScreenState();
}

class _PuzzleBoardScreenState extends State<PuzzleBoardScreen> {
  late List<String> moves = [...widget.puzzle.setupMoves];
  late bool flipped = widget.puzzle.setupMoves.length.isOdd;
  String notice = 'Find the best move.';
  bool solved = false;

  void _handleMove(List<String> nextMoves, String result) {
    if (solved || nextMoves.length <= widget.puzzle.setupMoves.length) return;

    final attempt = nextMoves.sublist(widget.puzzle.setupMoves.length);
    final expected = widget.puzzle.solutionMoves;
    final moveIndex = attempt.length - 1;
    final correct =
        moveIndex < expected.length &&
        _normalizePuzzleMove(attempt.last) ==
            _normalizePuzzleMove(expected[moveIndex]);

    setState(() {
      if (!correct) {
        moves = [...widget.puzzle.setupMoves];
        notice = 'Not that move. Try again.';
        return;
      }

      moves = nextMoves;
      if (attempt.length >= expected.length) {
        solved = true;
        notice = 'Solved: ${_formatStoredMoves(expected)}';
      } else {
        notice = 'Correct. Continue the line.';
      }
    });
  }

  void _reset() {
    setState(() {
      moves = [...widget.puzzle.setupMoves];
      notice = 'Find the best move.';
      solved = false;
    });
  }

  void _showAnswer() {
    setState(() {
      moves = [...widget.puzzle.setupMoves, ...widget.puzzle.solutionMoves];
      notice = 'Answer: ${_formatStoredMoves(widget.puzzle.solutionMoves)}';
      solved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Puzzle',
      trailing: SquareIconButton(
        icon: Icons.flip,
        tooltip: 'Flip board',
        onTap: () => setState(() => flipped = !flipped),
      ),
      children: [
        const SizedBox(height: 14),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.puzzle.theme.toUpperCase(),
                style: const TextStyle(
                  color: Color(0x9921304e),
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(height: 7),
              SerifText(widget.puzzle.title, size: 19, weight: FontWeight.w700),
              const SizedBox(height: 8),
              Row(
                children: [
                  ChipPill(_sideToMoveLabel(widget.puzzle.setupMoves)),
                  const SizedBox(width: 8),
                  ChipPill('${widget.puzzle.rating}'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: PrototypeChessBoard(
            flipped: flipped,
            moves: moves,
            onChanged: _handleMove,
          ),
        ),
        const SizedBox(height: 12),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            notice,
            style: TextStyle(
              color: solved ? PrototypeColors.burgundy : PrototypeColors.navy,
              fontSize: 13,
              fontWeight: FontWeight.w800,
              height: 1.4,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: PrototypeOutlineButton(label: 'Reset', onTap: _reset),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrototypeButton(
                  label: 'Show Answer',
                  onTap: _showAnswer,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
      ],
    );
  }
}

class NewAnalysisScreen extends StatelessWidget {
  const NewAnalysisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'New Analysis',
      children: [
        const SizedBox(height: 14),
        PrototypeOptionTile(
          title: 'Start from empty board',
          subtitle: 'Set up any position',
          icon: '♙',
          onTap: () => openPrototypeRoute(
            context,
            const AnalysisBoardScreen(mode: 'empty'),
          ),
        ),
        PrototypeOptionTile(
          title: 'PGN file',
          subtitle: 'Analyze an imported game',
          icon: 'PGN',
          onTap: () => openPrototypeRoute(context, const AnalysisBoardScreen()),
        ),
        PrototypeOptionTile(
          title: 'FEN',
          subtitle: 'Analyze from a position string',
          icon: 'FEN',
          onTap: () => openPrototypeRoute(context, const AnalysisBoardScreen()),
        ),
        PrototypeOptionTile(
          title: 'Tournament game history',
          subtitle: 'Pick from your club games',
          icon: '♜',
          onTap: () => openPrototypeRoute(
            context,
            const PickGameScreen(title: 'Tournament games'),
          ),
        ),
        PrototypeOptionTile(
          title: 'Chess.com games',
          subtitle: 'Pick from your linked account',
          icon: '♘',
          onTap: () => openPrototypeRoute(
            context,
            const PickGameScreen(title: 'Chess.com games'),
          ),
        ),
        PrototypeOptionTile(
          title: 'Lichess games',
          subtitle: 'Pick from your linked account',
          icon: '♞',
          onTap: () => openPrototypeRoute(
            context,
            const PickGameScreen(title: 'Lichess games'),
          ),
        ),
      ],
    );
  }
}

class PickGameScreen extends StatelessWidget {
  const PickGameScreen({required this.title, super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: title,
      children: [
        const SizedBox(height: 14),
        ...sampleGames.map(
          (game) => PrototypeOptionTile(
            title: game.title,
            subtitle: game.subtitle,
            icon: game.result,
            onTap: () =>
                openPrototypeRoute(context, const AnalysisBoardScreen()),
          ),
        ),
      ],
    );
  }
}

class TournamentGameDetailScreen extends StatefulWidget {
  const TournamentGameDetailScreen({
    required this.match,
    required this.roundLabel,
    super.key,
  });

  final MatchSeed match;
  final String roundLabel;

  @override
  State<TournamentGameDetailScreen> createState() =>
      _TournamentGameDetailScreenState();
}

class _TournamentGameDetailScreenState
    extends State<TournamentGameDetailScreen> {
  Timer? _liveRefreshTimer;
  bool _refreshing = false;
  late List<String> moves;
  late String currentResult;
  bool flipped = false;

  @override
  void initState() {
    super.initState();
    moves = _parseStoredMoves(widget.match.pgn);
    currentResult = widget.match.result;

    if (widget.match.gameId != null && currentResult == 'live') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(_refreshLiveGame());
      });
      _liveRefreshTimer = Timer.periodic(
        const Duration(seconds: 3),
        (_) => unawaited(_refreshLiveGame()),
      );
    }
  }

  @override
  void dispose() {
    _liveRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _refreshLiveGame() async {
    final gameId = widget.match.gameId;
    if (!mounted || _refreshing || gameId == null) return;

    _refreshing = true;
    final service = context.read<AppState>().service;
    try {
      final liveGame = await service.loadTournamentLiveGame(gameId);
      if (!mounted || liveGame == null) return;

      final refreshedMoves = _parseStoredMoves(liveGame.pgn);
      if (refreshedMoves.join(' ') != moves.join(' ') ||
          liveGame.result != currentResult) {
        setState(() {
          moves = refreshedMoves;
          currentResult = liveGame.result;
        });
      }
      if (liveGame.result != 'live') {
        _liveRefreshTimer?.cancel();
      }
    } finally {
      _refreshing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = currentResult == '-'
        ? 'Scheduled'
        : currentResult == 'live'
        ? 'Live'
        : currentResult;

    return PrototypeRouteScaffold(
      title: 'Tournament Game',
      trailing: SquareIconButton(
        icon: Icons.flip,
        tooltip: 'Flip board',
        onTap: () => setState(() => flipped = !flipped),
      ),
      children: [
        const SizedBox(height: 14),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.roundLabel,
                style: const TextStyle(
                  color: Color(0x9921304e),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 7),
              SerifText(
                '${widget.match.white} vs ${widget.match.black}',
                size: 19,
                weight: FontWeight.w700,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  ChipPill(result),
                  if (widget.match.matchNumber != null) ...[
                    const SizedBox(width: 8),
                    ChipPill('Match ${widget.match.matchNumber}'),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              TournamentBoardPlayerBar(
                color: flipped ? 'white' : 'black',
                edge: 'top',
                name: flipped ? widget.match.white : widget.match.black,
              ),
              PrototypeChessBoard(
                flipped: flipped,
                moves: moves,
                readOnly: true,
                onChanged: (_, _) {},
              ),
              TournamentBoardPlayerBar(
                color: flipped ? 'black' : 'white',
                edge: 'bottom',
                name: flipped ? widget.match.black : widget.match.white,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Moves',
                style: TextStyle(
                  color: PrototypeColors.navy,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                moves.isEmpty
                    ? 'No moves have been saved for this game yet.'
                    : _formatStoredMoves(moves),
                style: const TextStyle(
                  color: PrototypeColors.navy,
                  fontSize: 13,
                  height: 1.55,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
      ],
    );
  }
}

class TournamentBoardPlayerBar extends StatelessWidget {
  const TournamentBoardPlayerBar({
    required this.color,
    required this.edge,
    required this.name,
    super.key,
  });

  final String color;
  final String edge;
  final String name;

  @override
  Widget build(BuildContext context) {
    final isTop = edge == 'top';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color == 'black' ? const Color(0xffece8df) : Colors.white,
        border: Border(
          top: const BorderSide(color: Color(0x2a21304e)),
          left: const BorderSide(color: Color(0x2a21304e)),
          right: const BorderSide(color: Color(0x2a21304e)),
          bottom: isTop
              ? BorderSide.none
              : const BorderSide(color: Color(0x2a21304e)),
        ),
        borderRadius: BorderRadius.vertical(
          top: isTop ? const Radius.circular(8) : Radius.zero,
          bottom: isTop ? Radius.zero : const Radius.circular(8),
        ),
      ),
      child: Row(
        children: [
          ChessColorBadge(color: color),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  color.toUpperCase(),
                  style: const TextStyle(
                    color: Color(0xff8b8577),
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: PrototypeColors.navy,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AnalysisBoardScreen extends StatefulWidget {
  const AnalysisBoardScreen({this.mode = 'analysis', super.key});

  final String mode;

  @override
  State<AnalysisBoardScreen> createState() => _AnalysisBoardScreenState();
}

class _AnalysisBoardScreenState extends State<AnalysisBoardScreen> {
  bool flipped = false;
  final moves = <String>[];
  String result = 'Live';

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Analysis Board',
      trailing: SquareIconButton(
        icon: Icons.flip,
        tooltip: 'Flip board',
        onTap: () => setState(() => flipped = !flipped),
      ),
      children: [
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: PrototypeChessBoard(
            flipped: flipped,
            moves: moves,
            onChanged: (nextMoves, nextResult) {
              setState(() {
                moves
                  ..clear()
                  ..addAll(nextMoves);
                result = nextResult;
              });
            },
          ),
        ),
        const SizedBox(height: 12),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      color: PrototypeColors.cream,
                      shape: BoxShape.circle,
                      border: Border.fromBorderSide(
                        BorderSide(color: Color(0x6621304e)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    result == 'Live'
                        ? moves.length.isEven
                              ? 'White to move'
                              : 'Black to move'
                        : 'Result $result',
                    style: TextStyle(
                      color: Color(0xcc21304e),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                moves
                    .asMap()
                    .entries
                    .map((entry) {
                      final index = entry.key;
                      final move = entry.value;
                      return index.isEven ? '${(index ~/ 2) + 1}. $move' : move;
                    })
                    .join('  '),
                style: const TextStyle(
                  color: PrototypeColors.navy,
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: PrototypeOutlineButton(
                  label: 'Undo',
                  onTap: () {
                    if (moves.isEmpty) return;
                    setState(() => moves.removeLast());
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrototypeOutlineButton(
                  label: 'Reset',
                  onTap: () => setState(() {
                    moves.clear();
                    result = 'Live';
                  }),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrototypeButton(
                  label: 'Save Analysis',
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Analysis saved.')),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Guest mode - sign in to keep saved analyses',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0x8021304e), fontSize: 12),
          ),
        ),
      ],
    );
  }
}

class PrototypeChessBoard extends StatefulWidget {
  const PrototypeChessBoard({
    required this.flipped,
    required this.moves,
    required this.onChanged,
    this.readOnly = false,
    super.key,
  });

  final bool flipped;
  final List<String> moves;
  final void Function(List<String> moves, String result) onChanged;
  final bool readOnly;

  @override
  State<PrototypeChessBoard> createState() => _PrototypeChessBoardState();
}

class _PrototypeChessBoardState extends State<PrototypeChessBoard> {
  static const _files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  static const _promotions = ['q', 'r', 'b', 'n'];

  String? selectedSquare;
  ({String from, String to, chess.Color color})? pendingPromotion;

  @override
  void didUpdateWidget(covariant PrototypeChessBoard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.moves.length != widget.moves.length) {
      selectedSquare = null;
      pendingPromotion = null;
    }
  }

  chess.Chess _gameFromMoves() {
    final game = chess.Chess();
    for (final move in widget.moves) {
      for (final token in _moveTokens(move)) {
        game.move(token);
      }
    }
    return game;
  }

  void _playMove(String from, String to, [String? promotion]) {
    final game = _gameFromMoves();
    final moveRequest = {'from': from, 'to': to};
    if (promotion != null) moveRequest['promotion'] = promotion;
    final ok = game.move(moveRequest);
    if (!ok) {
      setState(() {
        selectedSquare = null;
        pendingPromotion = null;
      });
      return;
    }

    final san = _lastSanMove(game);
    if (san == null || san.isEmpty) return;
    widget.onChanged([...widget.moves, san], _resultFor(game));
    setState(() {
      selectedSquare = null;
      pendingPromotion = null;
    });
  }

  void _handleSquareTap(String square, chess.Chess game, List legalMoves) {
    if (pendingPromotion != null) return;

    final piece = game.get(square);
    if (selectedSquare == null) {
      if (piece != null && piece.color == game.turn) {
        setState(() => selectedSquare = square);
      }
      return;
    }

    if (selectedSquare == square) {
      setState(() => selectedSquare = null);
      return;
    }

    Map? move;
    for (final item in legalMoves.cast<Map>()) {
      if (item['to'] == square) {
        move = item;
        break;
      }
    }

    if (move != null) {
      final flags = move['flags']?.toString() ?? '';
      if (flags.contains('p')) {
        setState(() {
          pendingPromotion = (
            from: selectedSquare!,
            to: square,
            color: game.turn,
          );
        });
        return;
      }
      _playMove(selectedSquare!, square);
      return;
    }

    if (piece != null && piece.color == game.turn) {
      setState(() => selectedSquare = square);
      return;
    }

    setState(() => selectedSquare = null);
  }

  @override
  Widget build(BuildContext context) {
    final game = _gameFromMoves();
    final legalMoves = selectedSquare == null
        ? <Map>[]
        : game.moves({'square': selectedSquare, 'verbose': true}).cast<Map>();
    final targets = legalMoves.map((move) => move['to']?.toString()).toSet();
    final history = game.getHistory({'verbose': true}).cast<Map>().toList();
    final lastMove = history.isEmpty ? null : history.last;
    final checkSquare = game.in_check ? _kingSquare(game, game.turn) : null;
    final ranks = widget.flipped
        ? const [1, 2, 3, 4, 5, 6, 7, 8]
        : const [8, 7, 6, 5, 4, 3, 2, 1];
    final files = widget.flipped ? _files.reversed.toList() : _files;

    return AspectRatio(
      aspectRatio: 1,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xffc0a870),
          border: Border.all(color: const Color(0xffc0a870), width: 4),
          boxShadow: const [
            BoxShadow(
              color: Color(0x33231812),
              blurRadius: 28,
              offset: Offset(0, 16),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: Stack(
            children: [
              GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 8,
                ),
                itemCount: 64,
                itemBuilder: (context, index) {
                  final row = index ~/ 8;
                  final col = index % 8;
                  final rank = ranks[row];
                  final file = files[col];
                  final square = '$file$rank';
                  final piece = game.get(square);
                  final dark = (_files.indexOf(file) + rank).isOdd;
                  final selected = selectedSquare == square;
                  final target = targets.contains(square);
                  final last =
                      lastMove?['from'] == square || lastMove?['to'] == square;
                  final check = checkSquare == square;

                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: widget.readOnly
                        ? null
                        : () => _handleSquareTap(square, game, legalMoves),
                    child: Container(
                      decoration: BoxDecoration(
                        color: dark
                            ? const Color(0xff602830)
                            : const Color(0xfff0d8b0),
                        border: selected
                            ? Border.all(
                                color: const Color(0xfff8edd1),
                                width: 3,
                              )
                            : null,
                        boxShadow: [
                          BoxShadow(
                            color: dark
                                ? const Color(0x33200a0c)
                                : const Color(0x2e522d22),
                            blurRadius: 8,
                            spreadRadius: -2,
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          if (last)
                            Positioned.fill(
                              child: Container(
                                decoration: BoxDecoration(
                                  color: const Color(0x29e2b348),
                                  border: Border.all(
                                    color: const Color(0x51a98a3f),
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          if (check)
                            Positioned.fill(
                              child: Container(
                                decoration: BoxDecoration(
                                  color: const Color(0x2eb03232),
                                  border: Border.all(
                                    color: const Color(0x997e1522),
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          if (target && piece == null)
                            Container(
                              width: 14,
                              height: 14,
                              decoration: const BoxDecoration(
                                color: Color(0x66213045),
                                shape: BoxShape.circle,
                              ),
                            ),
                          if (target && piece != null)
                            Container(
                              margin: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: const Color(0x66213045),
                                  width: 3,
                                ),
                                shape: BoxShape.circle,
                              ),
                            ),
                          if (piece != null) _MobileChessPiece(piece: piece),
                        ],
                      ),
                    ),
                  );
                },
              ),
              if (pendingPromotion != null)
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: const Color(0xf8fffcf4),
                      border: Border.all(color: const Color(0xb8b99654)),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33213045),
                          blurRadius: 24,
                          offset: Offset(0, 12),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        for (final promotion in _promotions)
                          Expanded(
                            child: TextButton(
                              onPressed: () => _playMove(
                                pendingPromotion!.from,
                                pendingPromotion!.to,
                                promotion,
                              ),
                              child: _MobileChessPiece(
                                piece: chess.Piece(
                                  _pieceTypeFor(promotion),
                                  pendingPromotion!.color,
                                ),
                                compact: true,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _resultFor(chess.Chess game) {
    if (game.in_checkmate) {
      return game.turn == chess.Color.WHITE ? '0-1' : '1-0';
    }
    if (game.in_draw) return '1/2-1/2';
    return 'Live';
  }

  String? _kingSquare(chess.Chess game, chess.Color color) {
    for (final rank in const [8, 7, 6, 5, 4, 3, 2, 1]) {
      for (final file in _files) {
        final square = '$file$rank';
        final piece = game.get(square);
        if (piece?.type == chess.PieceType.KING && piece?.color == color) {
          return square;
        }
      }
    }
    return null;
  }

  String? _lastSanMove(chess.Chess game) {
    final history = game.san_moves();
    if (history.isEmpty) return null;
    final tokens = _moveTokens(history.last?.toString() ?? '').toList();
    if (tokens.isEmpty) return null;
    return tokens.last;
  }

  Iterable<String> _moveTokens(String value) sync* {
    final cleaned = value
        .replaceAll(RegExp(r'\{[^}]*\}'), ' ')
        .replaceAll(RegExp(r'\([^)]*\)'), ' ');

    for (final raw in cleaned.split(RegExp(r'\s+'))) {
      var token = raw.trim();
      if (token.isEmpty) continue;
      if (RegExp(r'^\d+\.(\.\.)?$').hasMatch(token)) continue;
      token = token.replaceFirst(RegExp(r'^\d+\.(\.\.)?'), '');
      if (token.isEmpty) continue;
      if (const {'1-0', '0-1', '1/2-1/2', '*', 'live'}.contains(token)) {
        continue;
      }
      yield token;
    }
  }

  chess.PieceType _pieceTypeFor(String promotion) {
    switch (promotion) {
      case 'r':
        return chess.PieceType.ROOK;
      case 'b':
        return chess.PieceType.BISHOP;
      case 'n':
        return chess.PieceType.KNIGHT;
      default:
        return chess.PieceType.QUEEN;
    }
  }
}

class _MobileChessPiece extends StatelessWidget {
  const _MobileChessPiece({required this.piece, this.compact = false});

  final chess.Piece piece;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final constrainedSide = math
            .min(
              constraints.maxWidth.isFinite ? constraints.maxWidth : 42.0,
              constraints.maxHeight.isFinite ? constraints.maxHeight : 42.0,
            )
            .toDouble();
        final base = compact ? 42.0 : math.max(34.0, constrainedSide);

        return SizedBox(
          width: base,
          height: base,
          child: Image.asset(
            _assetFor(piece),
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
            gaplessPlayback: true,
          ),
        );
      },
    );
  }

  String _assetFor(chess.Piece piece) {
    final white = piece.color == chess.Color.WHITE;
    final color = white ? 'w' : 'b';
    final type = switch (piece.type) {
      chess.PieceType.KING => 'k',
      chess.PieceType.QUEEN => 'q',
      chess.PieceType.ROOK => 'r',
      chess.PieceType.BISHOP => 'b',
      chess.PieceType.KNIGHT => 'n',
      _ => 'p',
    };
    return 'assets/chess-pieces/$color$type.png';
  }
}

class ChessClockScreen extends StatefulWidget {
  const ChessClockScreen({super.key});

  @override
  State<ChessClockScreen> createState() => _ChessClockScreenState();
}

class _ChessClockScreenState extends State<ChessClockScreen> {
  static const timeFormats = [
    ('1 min', 60, 0),
    ('1 min | 1 sec', 60, 1),
    ('2 min | 1 sec', 120, 1),
    ('3 min', 180, 0),
    ('3 min | 2 sec', 180, 2),
    ('5 min', 300, 0),
    ('5 min | 5 sec', 300, 5),
    ('10 min', 600, 0),
    ('15 min | 10 sec', 900, 10),
    ('20 min', 1200, 0),
    ('30 min', 1800, 0),
  ];

  int whiteStart = 300;
  int blackStart = 300;
  int white = 300;
  int black = 300;
  int increment = 0;
  String turn = 'white';
  bool running = false;
  bool clockStarted = false;
  bool soundOn = true;
  int whiteMoves = 0;
  int blackMoves = 0;
  Timer? timer;

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  void toggleRun() {
    setState(() => running = !running);
    timer?.cancel();
    if (!running) return;
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (turn == 'white' && white > 0) white--;
        if (turn == 'black' && black > 0) black--;
        if (white == 0 || black == 0) {
          running = false;
          timer?.cancel();
        }
      });
    });
  }

  void tapSide(String side) {
    if (!running) {
      if (!clockStarted) {
        setState(() {
          clockStarted = true;
          turn = _otherSide(side);
        });
      }
      toggleRun();
      return;
    }
    if (side != turn) return;

    setState(() {
      if (side == 'white') {
        whiteMoves++;
        white += increment;
      } else {
        blackMoves++;
        black += increment;
      }
      turn = _otherSide(side);
    });
  }

  void applySideTime(String side, int seconds) {
    timer?.cancel();
    setState(() {
      running = false;
      if (side == 'white') {
        whiteStart = seconds;
        white = seconds;
      } else {
        blackStart = seconds;
        black = seconds;
      }
    });
  }

  void applyTimeFormat((String, int, int) format) {
    timer?.cancel();
    setState(() {
      whiteStart = format.$2;
      blackStart = format.$2;
      white = whiteStart;
      black = blackStart;
      increment = format.$3;
      running = false;
      clockStarted = false;
      turn = 'white';
      whiteMoves = 0;
      blackMoves = 0;
    });
  }

  void resetClock() {
    timer?.cancel();
    setState(() {
      white = whiteStart;
      black = blackStart;
      running = false;
      clockStarted = false;
      turn = 'white';
      whiteMoves = 0;
      blackMoves = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PrototypeColors.navy,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _ClockSide(
                time: _clock(black),
                moves: blackMoves,
                controlLabel: _sideTimeLabel(blackStart),
                active: running && turn == 'black',
                rotated: true,
                onTap: () => tapSide('black'),
                onSettings: () => showTimeSettings('black'),
              ),
            ),
            _ClockControls(
              running: running,
              soundOn: soundOn,
              onBack: () => Navigator.of(context).maybePop(),
              onReset: resetClock,
              onToggleRun: toggleRun,
              onSettings: showFormatSettings,
              onSound: () => setState(() => soundOn = !soundOn),
            ),
            Expanded(
              child: _ClockSide(
                time: _clock(white),
                moves: whiteMoves,
                controlLabel: _sideTimeLabel(whiteStart),
                active: running && turn == 'white',
                onTap: () => tapSide('white'),
                onSettings: () => showTimeSettings('white'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _sideTimeLabel(int seconds) {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final rest = seconds % 60;
    final base = hours > 0
        ? '$hours:${minutes.toString().padLeft(2, '0')}:${rest.toString().padLeft(2, '0')}'
        : rest > 0
        ? '$minutes:${rest.toString().padLeft(2, '0')}'
        : '$minutes min';
    return increment == 0 ? base : '$base + $increment';
  }

  Future<void> showTimeSettings(String side) async {
    timer?.cancel();
    if (running) setState(() => running = false);

    final selected = await showDialog<int>(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => _AdjustTimeDialog(
        initialSeconds: side == 'white' ? white : black,
        rotated: side == 'black',
      ),
    );

    if (selected != null) applySideTime(side, selected);
  }

  Future<void> showFormatSettings() async {
    timer?.cancel();
    if (running) setState(() => running = false);

    final selected = await showDialog<(String, int, int)>(
      context: context,
      barrierColor: Colors.black54,
      builder: (context) => _TimeFormatDialog(
        formats: timeFormats,
        currentSeconds: whiteStart == blackStart ? whiteStart : null,
        currentIncrement: increment,
      ),
    );

    if (selected != null) applyTimeFormat(selected);
  }

  String _otherSide(String side) => side == 'white' ? 'black' : 'white';

  String _clock(int seconds) {
    final minutes = seconds ~/ 60;
    final rest = seconds % 60;
    return '$minutes:${rest.toString().padLeft(2, '0')}';
  }
}

class _AdjustTimeDialog extends StatefulWidget {
  const _AdjustTimeDialog({
    required this.initialSeconds,
    required this.rotated,
  });

  final int initialSeconds;
  final bool rotated;

  @override
  State<_AdjustTimeDialog> createState() => _AdjustTimeDialogState();
}

class _AdjustTimeDialogState extends State<_AdjustTimeDialog> {
  late final TextEditingController hoursController;
  late final TextEditingController minutesController;
  late final TextEditingController secondsController;

  @override
  void initState() {
    super.initState();
    final hours = widget.initialSeconds ~/ 3600;
    final minutes = (widget.initialSeconds % 3600) ~/ 60;
    final seconds = widget.initialSeconds % 60;
    hoursController = TextEditingController(text: _part(hours));
    minutesController = TextEditingController(text: _part(minutes));
    secondsController = TextEditingController(text: _part(seconds));
  }

  @override
  void dispose() {
    hoursController.dispose();
    minutesController.dispose();
    secondsController.dispose();
    super.dispose();
  }

  void save() {
    final hours = _readPart(hoursController);
    final minutes = _readPart(minutesController).clamp(0, 59);
    final seconds = _readPart(secondsController).clamp(0, 59);
    final total = (hours * 3600) + (minutes * 60) + seconds;
    Navigator.of(context).pop(total <= 0 ? 1 : total);
  }

  @override
  Widget build(BuildContext context) {
    final dialog = Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 30),
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.fromLTRB(38, 34, 38, 34),
        decoration: BoxDecoration(
          color: const Color(0xff1f1d1a),
          borderRadius: BorderRadius.circular(5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x80000000),
              blurRadius: 16,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.timer_outlined, color: Color(0xffc9c5bf), size: 22),
                SizedBox(width: 10),
                Text(
                  'ADJUST TIME',
                  style: TextStyle(
                    color: Color(0xffc9c5bf),
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 30),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _AdjustTimeField(
                    label: 'Hour',
                    controller: hoursController,
                  ),
                ),
                const _AdjustTimeSeparator(),
                Expanded(
                  child: _AdjustTimeField(
                    label: 'Minute',
                    controller: minutesController,
                  ),
                ),
                const _AdjustTimeSeparator(),
                Expanded(
                  child: _AdjustTimeField(
                    label: 'Second',
                    controller: secondsController,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 42),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    textStyle: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  child: const Text('CANCEL'),
                ),
                const SizedBox(width: 22),
                TextButton(
                  onPressed: save,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.white,
                    textStyle: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  child: const Text('SAVE TIME'),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    return widget.rotated ? RotatedBox(quarterTurns: 2, child: dialog) : dialog;
  }

  static String _part(int value) => value.toString().padLeft(2, '0');

  static int _readPart(TextEditingController controller) {
    return int.tryParse(controller.text.trim()) ?? 0;
  }
}

class _AdjustTimeField extends StatelessWidget {
  const _AdjustTimeField({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          maxLength: 2,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(
            color: Colors.white,
            fontSize: 42,
            fontWeight: FontWeight.w400,
            height: 1.15,
          ),
          decoration: InputDecoration(
            counterText: '',
            filled: true,
            fillColor: const Color(0xff2f2c29),
            contentPadding: const EdgeInsets.symmetric(vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(4),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          textAlign: TextAlign.left,
          style: const TextStyle(
            color: Color(0xffaaa6a0),
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _AdjustTimeSeparator extends StatelessWidget {
  const _AdjustTimeSeparator();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Text(
        ':',
        style: TextStyle(
          color: Colors.white,
          fontSize: 42,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _TimeFormatDialog extends StatelessWidget {
  const _TimeFormatDialog({
    required this.formats,
    required this.currentSeconds,
    required this.currentIncrement,
  });

  final List<(String, int, int)> formats;
  final int? currentSeconds;
  final int currentIncrement;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      backgroundColor: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 430, maxHeight: 690),
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
        decoration: BoxDecoration(
          color: const Color(0xff1f1d1a),
          borderRadius: BorderRadius.circular(6),
          boxShadow: const [
            BoxShadow(
              color: Color(0x80000000),
              blurRadius: 16,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Presets',
              style: TextStyle(
                color: Color(0xffaaa6a0),
                fontSize: 28,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 10),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: formats.length,
                itemBuilder: (context, index) {
                  final format = formats[index];
                  return _TimeFormatRow(
                    label: format.$1,
                    selected:
                        currentSeconds == format.$2 &&
                        currentIncrement == format.$3,
                    onTap: () => Navigator.of(context).pop(format),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white,
                  textStyle: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                child: const Text('CANCEL'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimeFormatRow extends StatelessWidget {
  const _TimeFormatRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w400,
                  height: 1.1,
                ),
              ),
            ),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected
                      ? const Color(0xff8ac263)
                      : const Color(0xff56534f),
                  width: 3,
                ),
              ),
              child: selected
                  ? Center(
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: const BoxDecoration(
                          color: Color(0xff8ac263),
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _ClockSide extends StatelessWidget {
  const _ClockSide({
    required this.time,
    required this.moves,
    required this.controlLabel,
    required this.active,
    required this.onTap,
    required this.onSettings,
    this.rotated = false,
  });

  final String time;
  final int moves;
  final String controlLabel;
  final bool active;
  final bool rotated;
  final VoidCallback onTap;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    final content = LayoutBuilder(
      builder: (context, constraints) {
        final double timeSize = math
            .min(constraints.maxWidth * 0.34, constraints.maxHeight * 0.42)
            .clamp(76.0, 138.0)
            .toDouble();
        final backgroundColor = active
            ? PrototypeColors.burgundy
            : const Color(0xffefe3c7);
        final foregroundColor = active
            ? PrototypeColors.cream
            : PrototypeColors.navy;
        final accentColor = active
            ? PrototypeColors.gold
            : PrototypeColors.burgundy;
        final mutedColor = active
            ? const Color(0xdff6f0e2)
            : const Color(0xcc7d2434);
        return Material(
          color: backgroundColor,
          child: InkWell(
            onTap: onTap,
            splashColor: active
                ? const Color(0x18f6f0e2)
                : const Color(0x187d2434),
            highlightColor: active
                ? const Color(0x10f6f0e2)
                : const Color(0x107d2434),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.topRight,
                    child: Text(
                      'Moves: $moves',
                      style: TextStyle(
                        color: mutedColor,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          time,
                          style: TextStyle(
                            color: foregroundColor,
                            fontFamily: 'monospace',
                            fontSize: timeSize,
                            fontWeight: FontWeight.w900,
                            height: 0.9,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: _ClockTimeControl(
                      label: controlLabel,
                      foregroundColor: foregroundColor,
                      accentColor: accentColor,
                      onTap: onSettings,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    return rotated ? RotatedBox(quarterTurns: 2, child: content) : content;
  }
}

class _ClockTimeControl extends StatelessWidget {
  const _ClockTimeControl({
    required this.label,
    required this.foregroundColor,
    required this.accentColor,
    required this.onTap,
  });

  final String label;
  final Color foregroundColor;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.tune, color: accentColor, size: 34),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: foregroundColor,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClockControls extends StatelessWidget {
  const _ClockControls({
    required this.running,
    required this.soundOn,
    required this.onBack,
    required this.onReset,
    required this.onToggleRun,
    required this.onSettings,
    required this.onSound,
  });

  final bool running;
  final bool soundOn;
  final VoidCallback onBack;
  final VoidCallback onReset;
  final VoidCallback onToggleRun;
  final VoidCallback onSettings;
  final VoidCallback onSound;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 96,
      color: Colors.black,
      child: Row(
        children: [
          _ClockControlButton(
            icon: Icons.arrow_back,
            tooltip: 'Back',
            onTap: onBack,
          ),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _ClockControlButton(
                  icon: Icons.replay,
                  tooltip: 'Reset',
                  onTap: onReset,
                ),
                _ClockControlButton(
                  icon: running ? Icons.pause : Icons.play_arrow,
                  tooltip: running ? 'Pause' : 'Start',
                  size: 48,
                  onTap: onToggleRun,
                ),
                _ClockControlButton(
                  icon: Icons.tune,
                  tooltip: 'Clock settings',
                  onTap: onSettings,
                ),
                _ClockControlButton(
                  icon: soundOn ? Icons.volume_up : Icons.volume_off,
                  tooltip: soundOn ? 'Mute' : 'Unmute',
                  onTap: onSound,
                ),
              ],
            ),
          ),
          const SizedBox(width: 18),
        ],
      ),
    );
  }
}

class _ClockControlButton extends StatelessWidget {
  const _ClockControlButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.size = 38,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
      onPressed: onTap,
      iconSize: size,
      splashRadius: 30,
      style: IconButton.styleFrom(
        foregroundColor: PrototypeColors.cream,
        backgroundColor: Colors.transparent,
      ),
      icon: Icon(icon),
    );
  }
}

class SavedAnalysesScreen extends StatelessWidget {
  const SavedAnalysesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AppState>().signedIn;

    return PrototypeRouteScaffold(
      title: 'Saved Analyses',
      children: [
        const SizedBox(height: 14),
        if (!signedIn)
          PrototypeCard(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                const Icon(
                  Icons.lock_outline,
                  color: PrototypeColors.burgundy,
                  size: 26,
                ),
                const SizedBox(height: 8),
                const SerifText(
                  'No saved analyses',
                  size: 17,
                  weight: FontWeight.w700,
                ),
                const SizedBox(height: 4),
                const Text(
                  'Sign in to keep analyses across sessions.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0x9921304e), fontSize: 12.5),
                ),
                const SizedBox(height: 14),
                PrototypeButton(
                  label: 'Sign in',
                  onTap: () => showAuthSheet(context),
                ),
              ],
            ),
          )
        else
          ...savedAnalyses.map(
            (item) => PrototypeOptionTile(
              title: item.title,
              subtitle: item.subtitle,
              icon: '♜',
              onTap: () =>
                  openPrototypeRoute(context, const AnalysisBoardScreen()),
            ),
          ),
      ],
    );
  }
}

class PrototypeOptionTile extends StatelessWidget {
  const PrototypeOptionTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    super.key,
  });

  final String title;
  final String subtitle;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: cardDecoration(radius: 14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0x147d2434),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: const Color(0x337d2434)),
                ),
                child: Text(
                  icon,
                  style: const TextStyle(
                    color: PrototypeColors.burgundy,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: PrototypeColors.navy,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: Color(0x9921304e),
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: PrototypeColors.burgundy),
            ],
          ),
        ),
      ),
    );
  }
}

class PrototypeOutlineButton extends StatelessWidget {
  const PrototypeOutlineButton({
    required this.label,
    required this.onTap,
    super.key,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: PrototypeColors.navy,
        side: const BorderSide(color: PrototypeColors.navy, width: 1.5),
        padding: const EdgeInsets.symmetric(vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
        textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
      ),
      child: Text(label),
    );
  }
}

class SegmentedPills extends StatelessWidget {
  const SegmentedPills({
    required this.labels,
    required this.selected,
    required this.onSelected,
    super.key,
  });

  final List<String> labels;
  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0x1021304e),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x2021304e)),
      ),
      child: Row(
        children: labels
            .map(
              (label) => Expanded(
                child: GestureDetector(
                  onTap: () => onSelected(label),
                  child: TabPill(label, selected: selected == label),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class LeaderboardPreview extends StatelessWidget {
  const LeaderboardPreview({super.key});

  @override
  Widget build(BuildContext context) {
    return PrototypeCard(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: EdgeInsets.zero,
      child: Column(
        children: clubPlayers
            .take(4)
            .map(
              (player) => Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 11,
                ),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: Color(0x1421304e))),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 12,
                      backgroundColor: const Color(0x24a98a3f),
                      child: Text(
                        '${player.rank}',
                        style: const TextStyle(
                          color: Color(0xff79622a),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            player.name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '@${player.username}',
                            style: const TextStyle(
                              color: Color(0x8c21304e),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${player.rating}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class NewsList extends StatelessWidget {
  const NewsList({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          NewsTile('Swiss round 4 is live', 'Main Campus · Hall B'),
          SizedBox(height: 10),
          NewsTile(
            'Round robin registration opens soon',
            'Round robin · 6 players',
          ),
        ],
      ),
    );
  }
}

class NewsTile extends StatelessWidget {
  const NewsTile(this.title, this.subtitle, {super.key});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: cardDecoration(radius: 13),
      child: Row(
        children: [
          const Icon(Icons.campaign_outlined, color: PrototypeColors.burgundy),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0x9921304e),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading({
    required this.title,
    this.action,
    this.onAction,
    this.margin = EdgeInsets.zero,
    super.key,
  });

  final String title;
  final String? action;
  final VoidCallback? onAction;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: margin,
      child: Row(
        children: [
          SerifText(title, size: 16, weight: FontWeight.w700),
          const Spacer(),
          if (action != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                foregroundColor: PrototypeColors.burgundy,
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                textStyle: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
              child: Text(action!),
            ),
        ],
      ),
    );
  }
}

void openTournamentGameDetail(
  BuildContext context,
  MatchSeed match,
  String roundLabel,
) {
  openPrototypeRoute(
    context,
    TournamentGameDetailScreen(match: match, roundLabel: roundLabel),
  );
}

List<String> _parseStoredMoves(String? value) {
  final source = value?.trim();
  if (source == null || source.isEmpty) return const [];

  final tokens = source
      .replaceAll(RegExp(r'\{[^}]*\}'), ' ')
      .replaceAll(RegExp(r'\([^)]*\)'), ' ')
      .split(RegExp(r'\s+'));
  final moves = <String>[];

  for (final rawToken in tokens) {
    var token = rawToken.trim();
    if (token.isEmpty) continue;
    if (RegExp(r'^\d+\.(\.\.)?$').hasMatch(token)) continue;
    token = token.replaceFirst(RegExp(r'^\d+\.(\.\.)?'), '');
    if (token.isEmpty) continue;
    if (const {'1-0', '0-1', '1/2-1/2', '*', 'live'}.contains(token)) {
      continue;
    }
    moves.add(token);
  }

  return moves;
}

String _formatStoredMoves(List<String> moves) {
  return moves
      .asMap()
      .entries
      .map((entry) {
        final index = entry.key;
        final move = entry.value;
        return index.isEven ? '${(index ~/ 2) + 1}. $move' : move;
      })
      .join('  ');
}

String _sideToMoveLabel(List<String> moves) {
  return moves.length.isEven ? 'White to move' : 'Black to move';
}

String _normalizePuzzleMove(String move) {
  return move.replaceAll(RegExp(r'[+#?!]'), '').trim();
}

void openPrototypeRoute(BuildContext context, Widget screen) {
  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
}

class PrototypeCard extends StatelessWidget {
  const PrototypeCard({
    required this.child,
    this.margin = EdgeInsets.zero,
    this.padding = const EdgeInsets.all(14),
    super.key,
  });

  final Widget child;
  final EdgeInsets margin;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: cardDecoration(),
      child: child,
    );
  }
}

class AppNotice extends StatelessWidget {
  const AppNotice({required this.text, super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return PrototypeCard(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xcc21304e),
          fontSize: 12,
          height: 1.35,
        ),
      ),
    );
  }
}

BoxDecoration cardDecoration({double radius = 14}) {
  return BoxDecoration(
    color: PrototypeColors.surface,
    border: Border.all(color: const Color(0x2421304e)),
    borderRadius: BorderRadius.circular(radius),
    boxShadow: const [
      BoxShadow(color: Color(0x0d21304e), blurRadius: 3, offset: Offset(0, 1)),
    ],
  );
}

class PrototypeButton extends StatelessWidget {
  const PrototypeButton({required this.label, required this.onTap, super.key});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onTap,
      style: FilledButton.styleFrom(
        backgroundColor: PrototypeColors.burgundy,
        foregroundColor: PrototypeColors.cream,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
      ),
      child: Text(label),
    );
  }
}

class HeaderNotificationButton extends StatelessWidget {
  const HeaderNotificationButton({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final notification = latestNotificationFor(state);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          tooltip: 'Latest notification',
          onPressed: () => openLatestNotification(context, notification),
          icon: const Icon(Icons.notifications_none),
          style: IconButton.styleFrom(
            backgroundColor: PrototypeColors.surface,
            foregroundColor: PrototypeColors.navy,
            fixedSize: const Size(42, 42),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13),
              side: const BorderSide(color: Color(0x3021304e)),
            ),
          ),
        ),
        if (state.signedIn)
          Positioned(
            right: 7,
            top: 7,
            child: Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                color: PrototypeColors.burgundy,
                shape: BoxShape.circle,
                border: Border.all(color: PrototypeColors.surface, width: 1.5),
              ),
            ),
          ),
      ],
    );
  }
}

class AppNotificationSeed {
  const AppNotificationSeed({
    required this.title,
    required this.body,
    required this.time,
    this.actionLabel,
  });

  final String title;
  final String body;
  final String time;
  final String? actionLabel;
}

AppNotificationSeed latestNotificationFor(AppState state) {
  if (!state.signedIn) {
    return const AppNotificationSeed(
      title: 'Sign in for notifications',
      body:
          'Club invitations, registration updates, and round notices will appear here after you sign in.',
      time: 'Account required',
      actionLabel: 'Sign in',
    );
  }

  for (final entry in state.myRegistrations.entries) {
    final registration = entry.value;
    if (registration.status == 'pending') {
      return const AppNotificationSeed(
        title: 'Registration pending',
        body: 'Your tournament registration is waiting for organizer approval.',
        time: 'Latest',
      );
    }
    if (registration.status == 'confirmed' && !registration.checkedIn) {
      return const AppNotificationSeed(
        title: 'You are registered',
        body:
            'Your check-in code is ready. Open the tournament page before the event.',
        time: 'Latest',
      );
    }
  }

  final featured = state.featuredTournament;
  if (featured != null && featured.status == 'active') {
    return AppNotificationSeed(
      title: 'Tournament is active',
      body:
          '${featured.name} is live. Open the tournament to follow pairings, rounds, and results.',
      time: 'Now',
    );
  }

  return const AppNotificationSeed(
    title: 'No new notifications',
    body:
        'You are all caught up. New club and tournament updates will appear here.',
    time: 'Latest',
  );
}

void openLatestNotification(
  BuildContext context,
  AppNotificationSeed notification,
) {
  openPrototypeRoute(context, NotificationScreen(notification: notification));
}

class NotificationScreen extends StatelessWidget {
  const NotificationScreen({required this.notification, super.key});

  final AppNotificationSeed notification;

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Notifications',
      children: [
        const SizedBox(height: 16),
        PrototypeCard(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0x147d2434),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.notifications_none,
                      color: PrototypeColors.burgundy,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notification.time,
                          style: const TextStyle(
                            color: Color(0x9921304e),
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          notification.title,
                          style: const TextStyle(
                            color: PrototypeColors.navy,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                notification.body,
                style: const TextStyle(
                  color: Color(0xcc21304e),
                  fontSize: 13.5,
                  height: 1.45,
                ),
              ),
              if (notification.actionLabel != null) ...[
                const SizedBox(height: 18),
                PrototypeButton(
                  label: notification.actionLabel!,
                  onTap: () => showAuthSheet(context),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class LivePill extends StatelessWidget {
  const LivePill({this.small = false, super.key});

  final bool small;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: small ? 9 : 10,
        vertical: small ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: PrototypeColors.burgundy,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: small ? 5 : 6,
            height: small ? 5 : 6,
            decoration: const BoxDecoration(
              color: PrototypeColors.cream,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            'Live',
            style: TextStyle(
              color: PrototypeColors.cream,
              fontSize: small ? 10 : 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final upcoming = status == 'upcoming';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: upcoming ? const Color(0x1fa98a3f) : const Color(0x1021304e),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: upcoming ? const Color(0x55a98a3f) : const Color(0x2421304e),
        ),
      ),
      child: Text(
        upcoming ? 'Soon' : 'Done',
        style: TextStyle(
          color: upcoming ? const Color(0xff79622a) : const Color(0x9921304e),
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class ChipPill extends StatelessWidget {
  const ChipPill(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0x0d21304e),
        border: Border.all(color: const Color(0x2621304e)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: PrototypeColors.navy,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class GoldPill extends StatelessWidget {
  const GoldPill(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0x1fa98a3f),
        border: Border.all(color: const Color(0x55a98a3f)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xff79622a),
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class TabPill extends StatelessWidget {
  const TabPill(this.label, {this.selected = false, super.key});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: selected ? PrototypeColors.burgundy : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: selected ? PrototypeColors.cream : PrototypeColors.navy,
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class SerifText extends StatelessWidget {
  const SerifText(
    this.text, {
    required this.size,
    required this.weight,
    this.height,
    this.maxLines,
    this.overflow,
    super.key,
  });

  final String text;
  final double size;
  final FontWeight weight;
  final double? height;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      maxLines: maxLines,
      overflow: overflow,
      style: TextStyle(
        color: PrototypeColors.navy,
        fontFamily: 'Georgia',
        fontSize: size,
        fontWeight: weight,
        height: height,
        decoration: TextDecoration.none,
      ),
    );
  }
}

enum AuthMode { signIn, signUp, forgot }

void showAuthSheet(BuildContext context, {bool createAccount = false}) {
  context.read<AppState>().clearError();
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => AuthFlowScreen(
        initialMode: createAccount ? AuthMode.signUp : AuthMode.signIn,
      ),
    ),
  );
}

class AuthFlowScreen extends StatefulWidget {
  const AuthFlowScreen({required this.initialMode, super.key});

  final AuthMode initialMode;

  @override
  State<AuthFlowScreen> createState() => _AuthFlowScreenState();
}

class _AuthFlowScreenState extends State<AuthFlowScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _universityController = TextEditingController();
  final _chessComController = TextEditingController();
  final _lichessController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _recoveryController = TextEditingController();

  late AuthMode _mode = widget.initialMode;
  bool _showSignInPassword = false;
  bool _showSignUpPassword = false;
  bool _showConfirmPassword = false;
  String _recoveryNotice = '';

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _universityController.dispose();
    _chessComController.dispose();
    _lichessController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _recoveryController.dispose();
    super.dispose();
  }

  void _setMode(AuthMode mode) {
    context.read<AppState>().clearError();
    setState(() {
      _mode = mode;
      _recoveryNotice = '';
    });
  }

  void _continueAsGuest() {
    context.read<AppState>().clearError();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PrototypeColors.screen,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Form(
              key: _formKey,
              child: ListView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: _mode == AuthMode.signIn
                    ? const EdgeInsets.fromLTRB(22, 28, 22, 40)
                    : const EdgeInsets.fromLTRB(22, 24, 22, 40),
                children: [
                  if (_mode == AuthMode.signIn) _buildSignIn(),
                  if (_mode == AuthMode.signUp) _buildSignUp(),
                  if (_mode == AuthMode.forgot) _buildForgot(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSignIn() {
    final state = context.watch<AppState>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthBrandHeader(logoSize: 56, titleSize: 23),
        const SizedBox(height: 30),
        const SerifText(
          'Sign into your Club player account',
          size: 22,
          weight: FontWeight.w700,
          height: 1.3,
        ),
        const SizedBox(height: 22),
        AuthField(
          controller: _emailController,
          label: 'Email',
          hintText: 'Enter email',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          validator: emailValue,
        ),
        const SizedBox(height: 16),
        AuthField(
          controller: _passwordController,
          label: 'Password',
          hintText: 'Enter password',
          obscureText: !_showSignInPassword,
          textInputAction: TextInputAction.done,
          validator: passwordValue,
          suffix: PasswordToggle(
            visible: _showSignInPassword,
            onPressed: () =>
                setState(() => _showSignInPassword = !_showSignInPassword),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => _setMode(AuthMode.forgot),
            style: TextButton.styleFrom(
              foregroundColor: PrototypeColors.burgundy,
              padding: const EdgeInsets.symmetric(vertical: 10),
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            child: const Text('Forgot password?'),
          ),
        ),
        AuthErrorText(error: state.error),
        PrototypeAuthButton(
          label: state.authLoading ? 'Working...' : 'Sign in',
          onTap: state.authLoading || !state.appwriteReady
              ? null
              : _submitSignIn,
        ),
        const SizedBox(height: 10),
        AuthGuestButton(onTap: _continueAsGuest),
        const AuthDivider(),
        AuthSocialButton(
          icon: const Icon(Icons.apple, size: 20, color: Colors.black),
          label: 'Continue with Apple',
          onTap: _showSocialUnavailable,
        ),
        const SizedBox(height: 10),
        AuthSocialButton(
          icon: const Text(
            'G',
            style: TextStyle(
              color: PrototypeColors.burgundy,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
          label: 'Continue with Google',
          onTap: _showSocialUnavailable,
        ),
        AuthInlineSwitch(
          prefix: 'New to the club?',
          action: 'Sign up',
          onTap: () => _setMode(AuthMode.signUp),
        ),
      ],
    );
  }

  Widget _buildSignUp() {
    final state = context.watch<AppState>();
    final score = passwordScore(_passwordController.text);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthBrandHeader(
          logoSize: 46,
          titleSize: 20,
          leading: RoundBackButton(onPressed: _backFromSignUp),
        ),
        const SizedBox(height: 24),
        const SerifText(
          'Create your player account',
          size: 21,
          weight: FontWeight.w700,
        ),
        const SizedBox(height: 20),
        AuthField(
          controller: _nameController,
          label: 'Full name',
          hintText: 'Enter full name',
          textInputAction: TextInputAction.next,
          validator: requiredValue,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _emailController,
          label: 'Email',
          hintText: 'student@ju.edu.jo',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          validator: emailValue,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _phoneController,
          label: 'Phone number',
          hintText: '07** *** ***',
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _universityController,
          label: 'University ID',
          hintText: 'Enter University ID',
          helperText: 'Kept private - never shown on your public profile',
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _chessComController,
          label: 'Chess.com username',
          optional: true,
          hintText: 'Enter username',
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _lichessController,
          label: 'Lichess username',
          optional: true,
          hintText: 'Enter username',
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _passwordController,
          label: 'Password',
          hintText: 'Example: JuChess@2026',
          obscureText: !_showSignUpPassword,
          textInputAction: TextInputAction.next,
          validator: passwordValue,
          onChanged: (_) => setState(() {}),
          suffix: PasswordToggle(
            visible: _showSignUpPassword,
            onPressed: () =>
                setState(() => _showSignUpPassword = !_showSignUpPassword),
          ),
        ),
        const PasswordRequirements(),
        if (_passwordController.text.isNotEmpty) PasswordStrength(score: score),
        const SizedBox(height: 14),
        AuthField(
          controller: _confirmPasswordController,
          label: 'Confirm password',
          hintText: 'Re-enter password',
          obscureText: !_showConfirmPassword,
          textInputAction: TextInputAction.done,
          validator: (value) {
            final required = passwordValue(value);
            if (required != null) return required;
            if (value != _passwordController.text) {
              return 'Passwords do not match';
            }
            return null;
          },
          suffix: PasswordToggle(
            visible: _showConfirmPassword,
            onPressed: () =>
                setState(() => _showConfirmPassword = !_showConfirmPassword),
          ),
        ),
        const SizedBox(height: 22),
        AuthErrorText(error: state.error),
        PrototypeAuthButton(
          label: state.authLoading ? 'Working...' : 'Create account',
          onTap: state.authLoading || !state.appwriteReady
              ? null
              : _submitSignUp,
        ),
        AuthInlineSwitch(
          prefix: 'Already a member?',
          action: 'Sign in',
          onTap: () => _setMode(AuthMode.signIn),
        ),
        AuthGuestTextButton(onTap: _continueAsGuest),
      ],
    );
  }

  Widget _buildForgot() {
    final state = context.watch<AppState>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SquareBackButton(onPressed: () => _setMode(AuthMode.signIn)),
        const SizedBox(height: 24),
        const AuthBrandHeader(logoSize: 50, titleSize: 21),
        const SizedBox(height: 26),
        const SerifText(
          'Forgot your password?',
          size: 21,
          weight: FontWeight.w700,
        ),
        const SizedBox(height: 8),
        const Text(
          'Enter your username, email, or University ID, then choose how you would like to receive your one-time code.',
          style: TextStyle(
            color: Color(0xa621304e),
            fontSize: 13.5,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 20),
        AuthField(
          controller: _recoveryController,
          label: 'Username, email, or University ID',
          hintText: 'Enter username, email, or University ID',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          validator: requiredValue,
        ),
        const SizedBox(height: 18),
        const Text(
          'Send code via',
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Row(
          children: const [
            Expanded(
              child: RecoveryMethodCard(
                icon: Icons.mail_outline,
                label: 'Email',
                selected: true,
              ),
            ),
            SizedBox(width: 10),
            Expanded(
              child: RecoveryMethodCard(
                icon: Icons.phone_iphone,
                label: 'SMS',
                selected: false,
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),
        AuthErrorText(error: state.error),
        if (_recoveryNotice.isNotEmpty) ...[
          Text(
            _recoveryNotice,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: PrototypeColors.gold,
              fontSize: 12,
              fontWeight: FontWeight.w800,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
        ],
        PrototypeAuthButton(
          label: state.authLoading ? 'Working...' : 'Continue',
          onTap: state.authLoading || !state.appwriteReady
              ? null
              : _submitForgot,
        ),
        const SizedBox(height: 14),
        const Text(
          'If an account matches, a recovery link will be sent. Password recovery is email based.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0x8021304e),
            fontSize: 11.5,
            height: 1.5,
          ),
        ),
      ],
    );
  }

  Future<void> _submitSignIn() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final success = await context.read<AppState>().signIn(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (success && mounted) Navigator.of(context).pop();
  }

  Future<void> _submitSignUp() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final success = await context.read<AppState>().signUp(
      _nameController.text.trim(),
      _emailController.text.trim(),
      _passwordController.text,
      _universityController.text.trim(),
      _phoneController.text.trim(),
    );

    if (success && mounted) Navigator.of(context).pop();
  }

  Future<void> _submitForgot() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final value = _recoveryController.text.trim();
    if (!value.contains('@')) {
      context.read<AppState>().setError(
        'Password recovery needs the email tied to your account.',
      );
      return;
    }

    final success = await context.read<AppState>().sendPasswordRecovery(value);
    if (success && mounted) {
      setState(() {
        _recoveryNotice = 'Recovery email sent. Check your inbox.';
      });
    }
  }

  void _showSocialUnavailable() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Social sign-in will be available soon.')),
    );
  }

  void _backFromSignUp() {
    if (widget.initialMode == AuthMode.signUp) {
      Navigator.of(context).pop();
      return;
    }

    _setMode(AuthMode.signIn);
  }
}

class AuthBrandHeader extends StatelessWidget {
  const AuthBrandHeader({
    required this.logoSize,
    required this.titleSize,
    this.leading,
    super.key,
  });

  final double logoSize;
  final double titleSize;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (leading != null) ...[leading!, const SizedBox(width: 12)],
        ClipOval(
          child: Image.asset(
            'assets/juchess-logo.png',
            width: logoSize,
            height: logoSize,
            fit: BoxFit.cover,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: _AuthBrandCopy(titleSize: titleSize)),
      ],
    );
  }
}

class _AuthBrandCopy extends StatelessWidget {
  const _AuthBrandCopy({required this.titleSize});

  final double titleSize;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SerifText(
          'JuChess',
          size: titleSize,
          weight: FontWeight.w700,
          height: 1.1,
        ),
        const SizedBox(height: 2),
        const Text(
          'University of Jordan Chess Club',
          style: TextStyle(color: Color(0x9e21304e), fontSize: 11.5),
        ),
      ],
    );
  }
}

class RoundBackButton extends StatelessWidget {
  const RoundBackButton({required this.onPressed, super.key});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      icon: const Icon(Icons.arrow_back, size: 20),
      style: IconButton.styleFrom(
        backgroundColor: PrototypeColors.surface,
        foregroundColor: PrototypeColors.navy,
        fixedSize: const Size(42, 42),
        shape: const CircleBorder(side: BorderSide(color: Color(0x3821304e))),
      ),
    );
  }
}

class SquareBackButton extends StatelessWidget {
  const SquareBackButton({required this.onPressed, super.key});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: IconButton(
        onPressed: onPressed,
        icon: const Icon(Icons.chevron_left, size: 24),
        style: IconButton.styleFrom(
          backgroundColor: PrototypeColors.surface,
          foregroundColor: PrototypeColors.navy,
          fixedSize: const Size(42, 42),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0x2e21304e)),
          ),
        ),
      ),
    );
  }
}

class AuthField extends StatelessWidget {
  const AuthField({
    required this.controller,
    required this.label,
    required this.hintText,
    this.optional = false,
    this.helperText,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.validator,
    this.onChanged,
    this.suffix,
    super.key,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final bool optional;
  final String? helperText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RichText(
          text: TextSpan(
            style: const TextStyle(
              color: Colors.black,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
            children: [
              TextSpan(text: label),
              if (optional)
                const TextSpan(
                  text: ' (optional)',
                  style: TextStyle(
                    color: Color(0x8021304e),
                    fontWeight: FontWeight.w400,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          obscureText: obscureText,
          validator: validator,
          onChanged: onChanged,
          style: const TextStyle(
            color: PrototypeColors.navy,
            fontSize: 15,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(color: Color(0x6121304e)),
            filled: true,
            fillColor: PrototypeColors.surface,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 13,
            ),
            suffixIcon: suffix,
            suffixIconConstraints: const BoxConstraints(
              minWidth: 48,
              minHeight: 48,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0x4721304e)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: PrototypeColors.burgundy),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: PrototypeColors.burgundy),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: PrototypeColors.burgundy),
            ),
          ),
        ),
        if (helperText != null) ...[
          const SizedBox(height: 5),
          Text(
            helperText!,
            style: const TextStyle(color: Color(0x8c21304e), fontSize: 11.5),
          ),
        ],
      ],
    );
  }
}

class PasswordToggle extends StatelessWidget {
  const PasswordToggle({
    required this.visible,
    required this.onPressed,
    super.key,
  });

  final bool visible;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      icon: Icon(visible ? Icons.visibility_off_outlined : Icons.visibility),
      color: const Color(0x9921304e),
      tooltip: visible ? 'Hide password' : 'Show password',
      style: IconButton.styleFrom(
        fixedSize: const Size(48, 48),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}

class PasswordRequirements extends StatelessWidget {
  const PasswordRequirements({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 8, left: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '1. At least 8 characters',
            style: TextStyle(
              color: Color(0xa621304e),
              fontSize: 12,
              height: 1.7,
            ),
          ),
          Text(
            '2. Use a mix of letters, numbers, and a symbol',
            style: TextStyle(
              color: Color(0xa621304e),
              fontSize: 12,
              height: 1.7,
            ),
          ),
        ],
      ),
    );
  }
}

class PasswordStrength extends StatelessWidget {
  const PasswordStrength({required this.score, super.key});

  final int score;

  @override
  Widget build(BuildContext context) {
    final color = score >= 3
        ? PrototypeColors.gold
        : score >= 2
        ? PrototypeColors.burgundy
        : const Color(0x8021304e);
    final label = score >= 3
        ? 'Strong'
        : score >= 2
        ? 'Medium'
        : 'Weak';

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(
              3,
              (index) => Expanded(
                child: Container(
                  height: 5,
                  margin: EdgeInsets.only(right: index == 2 ? 0 : 5),
                  decoration: BoxDecoration(
                    color: index < score ? color : const Color(0x1a21304e),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 22),
      child: Row(
        children: const [
          Expanded(child: Divider(color: Color(0x2921304e))),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              'or continue with',
              style: TextStyle(color: Color(0x8021304e), fontSize: 12),
            ),
          ),
          Expanded(child: Divider(color: Color(0x2921304e))),
        ],
      ),
    );
  }
}

class AuthSocialButton extends StatelessWidget {
  const AuthSocialButton({
    required this.icon,
    required this.label,
    required this.onTap,
    super.key,
  });

  final Widget icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: PrototypeColors.navy,
        backgroundColor: PrototypeColors.surface,
        side: const BorderSide(color: Color(0x4021304e)),
        padding: const EdgeInsets.symmetric(vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [icon, const SizedBox(width: 10), Text(label)],
      ),
    );
  }
}

class AuthInlineSwitch extends StatelessWidget {
  const AuthInlineSwitch({
    required this.prefix,
    required this.action,
    required this.onTap,
    super.key,
  });

  final String prefix;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$prefix ',
            style: const TextStyle(color: Color(0xa621304e), fontSize: 13.5),
          ),
          TextButton(
            onPressed: onTap,
            style: TextButton.styleFrom(
              foregroundColor: PrototypeColors.burgundy,
              padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
              textStyle: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w900,
              ),
            ),
            child: Text(action),
          ),
        ],
      ),
    );
  }
}

class AuthGuestButton extends StatelessWidget {
  const AuthGuestButton({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: const Icon(Icons.person_outline, size: 18),
      label: const Text('Continue as guest'),
      style: OutlinedButton.styleFrom(
        foregroundColor: PrototypeColors.navy,
        backgroundColor: PrototypeColors.surface,
        side: const BorderSide(color: Color(0x4021304e)),
        padding: const EdgeInsets.symmetric(vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class AuthGuestTextButton extends StatelessWidget {
  const AuthGuestTextButton({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: PrototypeColors.navy,
        padding: const EdgeInsets.symmetric(vertical: 10),
        textStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
      ),
      child: const Text('Continue as guest'),
    );
  }
}

class PrototypeAuthButton extends StatelessWidget {
  const PrototypeAuthButton({
    required this.label,
    required this.onTap,
    super.key,
  });

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onTap,
      style: FilledButton.styleFrom(
        backgroundColor: PrototypeColors.burgundy,
        foregroundColor: PrototypeColors.cream,
        disabledBackgroundColor: const Color(0x667d2434),
        disabledForegroundColor: PrototypeColors.cream,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
      ),
      child: Text(label),
    );
  }
}

class RecoveryMethodCard extends StatelessWidget {
  const RecoveryMethodCard({
    required this.icon,
    required this.label,
    required this.selected,
    super.key,
  });

  final IconData icon;
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 82,
      decoration: BoxDecoration(
        color: selected ? const Color(0x147d2434) : PrototypeColors.surface,
        border: Border.all(
          color: selected ? PrototypeColors.burgundy : const Color(0x2e21304e),
          width: 1.5,
        ),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: PrototypeColors.burgundy, size: 24),
          const SizedBox(height: 7),
          Text(
            label,
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class AuthErrorText extends StatelessWidget {
  const AuthErrorText({required this.error, super.key});

  final String? error;

  @override
  Widget build(BuildContext context) {
    if (error == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        error!,
        style: const TextStyle(
          color: PrototypeColors.burgundy,
          fontSize: 12,
          fontWeight: FontWeight.w800,
          height: 1.35,
        ),
      ),
    );
  }
}

String? requiredValue(String? value) {
  if (value == null || value.trim().isEmpty) return 'Required';
  return null;
}

String? emailValue(String? value) {
  final required = requiredValue(value);
  if (required != null) return required;
  final email = value!.trim();
  if (!email.contains('@') || !email.contains('.')) {
    return 'Enter a valid email';
  }
  return null;
}

String? passwordValue(String? value) {
  if (value == null || value.length < 8) return 'Use at least 8 characters';
  return null;
}

int passwordScore(String value) {
  var score = 0;
  if (value.length >= 8) score++;
  if (RegExp(r'[0-9]').hasMatch(value)) score++;
  if (RegExp(r'[^A-Za-z0-9]').hasMatch(value)) score++;
  return score;
}

class TournamentSeed {
  const TournamentSeed({
    required this.rowId,
    required this.id,
    required this.name,
    required this.meta,
    required this.chips,
    required this.current,
    required this.format,
    required this.timeControl,
    required this.players,
    required this.location,
    required this.description,
    this.capacity,
    this.roundsTotal,
    this.currentRound,
    this.startsAt,
    this.status = 'active',
    this.registeredPlayers = const [],
    this.publishedRounds = const [],
    this.bracketSnapshot,
  });

  final String rowId;
  final String id;
  final String name;
  final String meta;
  final List<String> chips;
  final String current;
  final String format;
  final String timeControl;
  final int players;
  final int? capacity;
  final int? roundsTotal;
  final int? currentRound;
  final String location;
  final String description;
  final String? startsAt;
  final String status;
  final List<PlayerSeed> registeredPlayers;
  final List<RoundSeed> publishedRounds;
  final PublishedBracketSnapshot? bracketSnapshot;

  String get playerLabel {
    final cap = capacity;
    return cap == null ? '$players players' : '$players/$cap players';
  }

  String get roundsLabel {
    final total = roundsTotal;
    final current = currentRound;
    if (current != null && total != null) return 'Round $current of $total';
    if (total != null) return '$total rounds';
    return this.current;
  }
}

class PlayerSeed {
  const PlayerSeed(this.rank, this.name, this.rating, this.username);

  final int rank;
  final String name;
  final int rating;
  final String username;
}

class GameSeed {
  const GameSeed(this.title, this.subtitle, this.result);

  final String title;
  final String subtitle;
  final String result;
}

class LiveBoardSeed {
  const LiveBoardSeed(this.board, this.white, this.black, this.note);

  final int board;
  final String white;
  final String black;
  final String note;
}

class RoundSeed {
  const RoundSeed(this.label, this.games);

  final String label;
  final List<MatchSeed> games;
}

class PublishedBracketSnapshot {
  const PublishedBracketSnapshot({
    required this.type,
    required this.title,
    this.rounds = const [],
    this.winners = const [],
    this.losers = const [],
    this.finalRounds = const [],
  });

  final String type;
  final String title;
  final List<RoundSeed> rounds;
  final List<RoundSeed> winners;
  final List<RoundSeed> losers;
  final List<RoundSeed> finalRounds;

  bool get isDouble => type == 'double';
}

class MatchSeed {
  const MatchSeed(
    this.white,
    this.black,
    this.result, {
    this.gameId,
    this.matchNumber,
    this.nextIndex,
    this.pgn,
  });

  final String white;
  final String black;
  final String result;
  final String? gameId;
  final int? matchNumber;
  final int? nextIndex;
  final String? pgn;
}

class SavedAnalysisSeed {
  const SavedAnalysisSeed(this.title, this.subtitle);

  final String title;
  final String subtitle;
}

class PuzzleSeed {
  const PuzzleSeed({
    required this.title,
    required this.theme,
    required this.rating,
    required this.icon,
    required this.setupMoves,
    required this.solutionMoves,
  });

  final String title;
  final String theme;
  final int rating;
  final String icon;
  final List<String> setupMoves;
  final List<String> solutionMoves;
}

const clubPlayers = [
  PlayerSeed(1, 'Ibrahim Ahmad', 1810, 'ibrahim_ahmad'),
  PlayerSeed(2, 'Omar Saleh', 1740, 'omar_saleh'),
  PlayerSeed(3, 'Leen Haddad', 1685, 'leen_haddad'),
  PlayerSeed(4, 'Yazan Khaled', 1602, 'yazan_khaled'),
  PlayerSeed(5, 'Sara Nasser', 1550, 'sara_nasser'),
  PlayerSeed(6, 'Mohammad Al-Khatib', 1490, 'mohammad_alkhatib'),
  PlayerSeed(7, 'Rania Odeh', 1465, 'rania_odeh'),
  PlayerSeed(8, 'Khaled Mansour', 1430, 'khaled_mansour'),
  PlayerSeed(9, 'Tala Suleiman', 1395, 'tala_suleiman'),
  PlayerSeed(10, 'Hasan Qasem', 1370, 'hasan_qasem'),
  PlayerSeed(11, 'Noor Barakat', 1340, 'noor_barakat'),
  PlayerSeed(12, 'Zaid Hamdan', 1310, 'zaid_hamdan'),
  PlayerSeed(13, 'Amr Zaidan', 1295, 'amr_zaidan'),
  PlayerSeed(14, 'Lina Shami', 1270, 'lina_shami'),
  PlayerSeed(15, 'Fadi Rimawi', 1245, 'fadi_rimawi'),
  PlayerSeed(16, 'Dana Aqel', 1220, 'dana_aqel'),
  PlayerSeed(17, 'Nour Alami', 1198, 'nour_alami'),
  PlayerSeed(18, 'Tamer Qasem', 1184, 'tamer_qasem'),
  PlayerSeed(19, 'Salma Nouri', 1166, 'salma_nouri'),
  PlayerSeed(20, 'Adam Kareem', 1148, 'adam_kareem'),
];

class DoubleEliminationRoundSets {
  const DoubleEliminationRoundSets({
    required this.winners,
    required this.losers,
    required this.finalRounds,
  });

  final List<RoundSeed> winners;
  final List<RoundSeed> losers;
  final List<RoundSeed> finalRounds;
}

const bracketByeName = 'Bye';

List<RoundSeed> buildSingleEliminationRounds(
  TournamentSeed event, {
  String prefix = '',
  int? forceActiveRound,
  List<List<int>> matchNumbers = const [],
}) {
  final players = _bracketPlayerNames(event);
  final counts = _bracketRoundCounts(players.length);
  final labels = counts
      .map((count) => '$prefix${_bracketRoundName(count)}')
      .toList();
  final activeRound =
      forceActiveRound ?? _activeBracketRoundIndex(labels, event);
  final bracketSize = _nextPowerOfTwo(players.length);
  var current = _openingBracketNames(players, bracketSize);
  final rounds = <RoundSeed>[];

  for (var roundIndex = 0; roundIndex < labels.length; roundIndex++) {
    final complete =
        event.status == 'completed' ||
        (event.status == 'active' && roundIndex < activeRound);
    final live = event.status == 'active' && roundIndex == activeRound;
    final sourceCode = _bracketRoundCode(labels[roundIndex]);
    final games = <MatchSeed>[];
    final winners = <String>[];

    for (var index = 0; index + 1 < current.length; index += 2) {
      final matchIndex = games.length;
      final byeResult = _byeResult(current[index], current[index + 1]);
      final result =
          byeResult ??
          (live
              ? 'live'
              : complete
              ? (matchIndex.isEven ? '1-0' : '0-1')
              : '-');
      final nextIndex = roundIndex < labels.length - 1 ? matchIndex ~/ 2 : null;
      final match = MatchSeed(
        current[index],
        current[index + 1],
        result,
        matchNumber:
            roundIndex < matchNumbers.length &&
                matchIndex < matchNumbers[roundIndex].length
            ? matchNumbers[roundIndex][matchIndex]
            : null,
        nextIndex: nextIndex,
      );
      games.add(match);
      winners.add(
        byeResult != null || complete
            ? _matchWinner(match)
            : _matchWinner(match, sourceCode, matchIndex + 1),
      );
    }

    rounds.add(RoundSeed(labels[roundIndex], games));
    current = winners;
  }

  return _mergePublishedBracketRounds(rounds, event.publishedRounds);
}

List<RoundSeed> _mergePublishedBracketRounds(
  List<RoundSeed> generated,
  List<RoundSeed> published,
) {
  if (published.isEmpty) return generated;

  final merged = <RoundSeed>[];
  final maxRounds = math.max(generated.length, published.length);
  for (var roundIndex = 0; roundIndex < maxRounds; roundIndex++) {
    final generatedRound = roundIndex < generated.length
        ? generated[roundIndex]
        : null;
    final publishedRound = roundIndex < published.length
        ? published[roundIndex]
        : null;

    if (generatedRound == null) {
      merged.add(publishedRound!);
      continue;
    }
    if (publishedRound == null) {
      merged.add(generatedRound);
      continue;
    }

    merged.add(
      RoundSeed(
        generatedRound.label,
        _mergePublishedBracketMatches(
          generatedRound.games,
          publishedRound.games,
        ),
      ),
    );
  }
  return merged;
}

List<MatchSeed> _mergePublishedBracketMatches(
  List<MatchSeed> generated,
  List<MatchSeed> published,
) {
  final matches = <MatchSeed>[];
  final maxMatches = math.max(generated.length, published.length);
  for (var index = 0; index < maxMatches; index++) {
    final generatedMatch = index < generated.length ? generated[index] : null;
    final publishedMatch = index < published.length ? published[index] : null;

    if (generatedMatch == null) {
      matches.add(publishedMatch!);
      continue;
    }
    if (publishedMatch == null) {
      matches.add(generatedMatch);
      continue;
    }

    matches.add(
      MatchSeed(
        publishedMatch.white,
        publishedMatch.black,
        publishedMatch.result,
        gameId: publishedMatch.gameId,
        matchNumber: generatedMatch.matchNumber ?? publishedMatch.matchNumber,
        nextIndex: generatedMatch.nextIndex ?? publishedMatch.nextIndex,
        pgn: publishedMatch.pgn,
      ),
    );
  }
  return matches;
}

DoubleEliminationRoundSets buildDoubleEliminationRounds(TournamentSeed event) {
  final winnerRoundActive = RegExp(
    r'winner|w-',
    caseSensitive: false,
  ).hasMatch(event.current);
  final numbering = _buildDoubleEliminationMatchNumbering(
    _bracketRoundCounts(
      _bracketPlayerNames(event).length,
    ).map((count) => math.max(1, count ~/ 2)).toList(),
  );
  final winners = buildSingleEliminationRounds(
    event,
    prefix: 'W-',
    forceActiveRound: winnerRoundActive ? null : 999,
    matchNumbers: numbering.winners,
  );
  final firstLoserPool = _losersFromRound(
    winners.isNotEmpty ? winners.first : null,
    winners.isNotEmpty ? winners.first.label : 'W-Round',
  );
  final incomingLosers = winners.length > 2
      ? winners.sublist(1, winners.length - 1).map((round) {
          final losers = _losersFromRound(round, round.label);
          return losers.length > 2 ? losers.reversed.toList() : losers;
        }).toList()
      : <List<String>>[];
  final loserRounds = _buildLoserRounds(
    firstLoserPool,
    incomingLosers,
    event,
    _lowerBracketRoundLabelsFromWinnerRounds([
      for (final round in winners) round.label,
    ]),
    numbering.losers,
  );
  final winnersFinal = winners.isNotEmpty ? winners.last : null;
  final winnersFinalMatch = winnersFinal?.games.isNotEmpty == true
      ? winnersFinal!.games.first
      : null;
  final loserFinalOpponent =
      loserRounds.isNotEmpty && loserRounds.last.games.isNotEmpty
      ? _matchWinner(loserRounds.last.games.first)
      : firstLoserPool.isNotEmpty
      ? firstLoserPool.first
      : 'Lower bracket survivor';
  final loserFinal = MatchSeed(
    _matchLoser(winnersFinalMatch, winnersFinal?.label ?? 'W-Final', 1),
    loserFinalOpponent,
    event.status == 'active' ? 'live' : '-',
    matchNumber: numbering.lowerFinal,
  );
  final grandFinal = MatchSeed(
    _matchWinner(winnersFinalMatch, winnersFinal?.label ?? 'W-Final', 1),
    _matchWinner(loserFinal, 'Lower Final', 1),
    event.status == 'completed' ? '1-0' : '-',
    matchNumber: numbering.grandFinal,
  );

  return DoubleEliminationRoundSets(
    winners: winners,
    losers: [
      ...loserRounds,
      RoundSeed('Lower Final', [loserFinal]),
    ],
    finalRounds: [
      RoundSeed('Grand Final', [grandFinal]),
      RoundSeed('Reset if needed', [
        MatchSeed(
          'Winner of ${numbering.grandFinal}',
          'Reset only if needed',
          '-',
          matchNumber: numbering.resetFinal,
        ),
      ]),
    ],
  );
}

class DoubleEliminationMatchNumbering {
  const DoubleEliminationMatchNumbering({
    required this.winners,
    required this.losers,
    required this.lowerFinal,
    required this.grandFinal,
    required this.resetFinal,
  });

  final List<List<int>> winners;
  final List<List<int>> losers;
  final int lowerFinal;
  final int grandFinal;
  final int resetFinal;
}

DoubleEliminationMatchNumbering _buildDoubleEliminationMatchNumbering(
  List<int> winnerMatchCounts,
) {
  final winners = [for (final _ in winnerMatchCounts) <int>[]];
  final losers = <List<int>>[];
  var next = 1;

  List<int> allocate(int count, {bool descending = false}) {
    final numbers = [for (var index = 0; index < count; index++) next + index];
    next += count;
    return descending ? numbers.reversed.toList() : numbers;
  }

  if (winnerMatchCounts.isNotEmpty) {
    winners[0] = allocate(winnerMatchCounts[0]);
  }

  var poolCount = winnerMatchCounts.isNotEmpty ? winnerMatchCounts[0] : 0;
  var poolDescending = false;

  for (
    var winnerRoundIndex = 1;
    winnerRoundIndex < winnerMatchCounts.length - 1;
    winnerRoundIndex++
  ) {
    if (poolCount >= 2) {
      final matchCount = poolCount ~/ 2;
      losers.add(allocate(matchCount, descending: poolDescending));
      poolCount = matchCount + (poolCount % 2);
    }

    winners[winnerRoundIndex] = allocate(winnerMatchCounts[winnerRoundIndex]);

    final incomingCount = winnerMatchCounts[winnerRoundIndex];
    if (incomingCount > 0) {
      final pairCount = math.min(poolCount, incomingCount);
      if (pairCount > 0) {
        poolDescending = incomingCount > 2;
        losers.add(allocate(pairCount, descending: poolDescending));
      }
      poolCount = poolCount + incomingCount - pairCount;
    }
  }

  while (poolCount > 1) {
    final matchCount = poolCount ~/ 2;
    losers.add(allocate(matchCount, descending: poolDescending));
    poolCount = matchCount + (poolCount % 2);
  }

  final finalWinnerRoundIndex = winnerMatchCounts.length - 1;
  if (finalWinnerRoundIndex > 0) {
    winners[finalWinnerRoundIndex] = allocate(
      winnerMatchCounts[finalWinnerRoundIndex],
    );
  }

  return DoubleEliminationMatchNumbering(
    winners: winners,
    losers: losers,
    lowerFinal: next,
    grandFinal: next + 1,
    resetFinal: next + 2,
  );
}

List<String> _bracketPlayerNames(TournamentSeed event) {
  if (event.registeredPlayers.isNotEmpty) {
    return event.registeredPlayers.map((player) => player.name).toList();
  }

  if (event.publishedRounds.isNotEmpty) {
    return [
      for (final match in event.publishedRounds.first.games) ...[
        match.white,
        match.black,
      ],
    ];
  }

  final declared = event.players > 0
      ? event.players
      : event.capacity ?? clubPlayers.length;
  final count = math.max(2, math.min(clubPlayers.length, declared));
  return clubPlayers.take(count).map((player) => player.name).toList();
}

List<int> _bracketRoundCounts(int playerCount) {
  final counts = <int>[_nextPowerOfTwo(playerCount)];
  var next = (counts.last / 2).floor();
  while (next >= 2) {
    counts.add(next);
    next = (next / 2).floor();
  }
  return counts;
}

int _nextPowerOfTwo(int value) {
  var result = 1;
  while (result < value) {
    result *= 2;
  }
  return math.max(2, result);
}

List<String> _openingBracketNames(List<String> names, int bracketSize) {
  final slots = <String>[];
  final firstRoundMatches = math.max(1, bracketSize ~/ 2);
  final byeCount = math.max(0, bracketSize - names.length);
  var playerIndex = 0;

  for (var matchIndex = 0; matchIndex < firstRoundMatches; matchIndex++) {
    final white = playerIndex < names.length
        ? names[playerIndex++]
        : bracketByeName;
    final black = matchIndex >= firstRoundMatches - byeCount
        ? bracketByeName
        : playerIndex < names.length
        ? names[playerIndex++]
        : bracketByeName;
    slots.addAll([white, black]);
  }

  return slots;
}

String _bracketRoundName(int playersInRound) {
  if (playersInRound == 2) return 'Final';
  if (playersInRound == 4) return 'Semifinal';
  if (playersInRound == 8) return 'Quarterfinal';
  return 'Round of $playersInRound';
}

String _bracketRoundCode(String label) {
  final lower = label.toLowerCase();
  final survivor = RegExp(r'surviv(?:or|al)').hasMatch(lower);
  final qualifier = lower.contains('qualifier');
  final suffix = survivor
      ? 'S'
      : qualifier
      ? 'Q'
      : '';
  final prefix = lower.contains('minor')
      ? 'MN'
      : lower.contains('major')
      ? 'MJ'
      : '';
  if (lower.contains('quarterfinal')) return '${prefix}QF$suffix';
  if (lower.contains('semifinal')) return '${prefix}SF$suffix';
  if (lower.contains('final')) {
    return '${prefix}F$suffix';
  }
  final roundMatch = RegExp(
    r'round of\s*(\d+)',
    caseSensitive: false,
  ).firstMatch(label);
  if (roundMatch != null) {
    return '${prefix}R${roundMatch.group(1)}$suffix';
  }
  final lowerRoundMatch = RegExp(
    r'lower round\s*(\d+)',
    caseSensitive: false,
  ).firstMatch(label);
  if (lowerRoundMatch != null) return 'LR${lowerRoundMatch.group(1)}';
  final loserMatch = RegExp(
    r'l-round\s*(\d+)',
    caseSensitive: false,
  ).firstMatch(label);
  if (loserMatch != null) return 'L${loserMatch.group(1)}';
  return label.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '');
}

String? _byeResult(String white, String black) {
  final whiteBye = _isByeName(white);
  final blackBye = _isByeName(black);
  if (whiteBye && !blackBye) return '0-1';
  if (blackBye && !whiteBye) return '1-0';
  return null;
}

bool _isByeName(String name) => name == bracketByeName;

int _activeBracketRoundIndex(List<String> labels, TournamentSeed event) {
  if (event.status == 'completed') return labels.length;
  if (event.status != 'active') return 0;
  final currentRound = event.currentRound;
  if (currentRound != null && currentRound > 0) {
    return math.max(0, math.min(labels.length - 1, currentRound - 1));
  }

  final current = event.current.toLowerCase();
  final parsed = labels.indexWhere((label) {
    final lower = label.toLowerCase();
    if (current.contains('final') &&
        lower.contains('final') &&
        !lower.contains('semi')) {
      return true;
    }
    if (current.contains('semi') && lower.contains('semi')) return true;
    if (current.contains('quarter') && lower.contains('quarter')) return true;
    final count = RegExp(
      r'round of\s*(\d+)',
      caseSensitive: false,
    ).firstMatch(lower)?.group(1);
    return count != null && current.contains(count);
  });
  if (parsed >= 0) return parsed;
  return math.max(0, math.min(labels.length - 1, labels.length - 2));
}

List<String> _losersFromRound(RoundSeed? round, String sourceLabel) {
  if (round == null) return const [];
  return [
    for (var i = 0; i < round.games.length; i++)
      if (!_isByeName(_matchLoser(round.games[i], sourceLabel, i + 1)))
        _matchLoser(round.games[i], sourceLabel, i + 1),
  ];
}

List<RoundSeed> _buildLoserRounds(
  List<String> firstPool,
  List<List<String>> incomingPools,
  TournamentSeed event,
  List<String> lowerRoundLabels,
  List<List<int>> matchNumbers,
) {
  final rounds = <RoundSeed>[];
  var pool = [...firstPool];
  final complete = event.status == 'active' || event.status == 'completed';

  void reducePool({bool feedsDropIn = false}) {
    if (pool.length < 2) return;
    final pairable = pool.length.isEven
        ? pool
        : pool.sublist(0, pool.length - 1);
    final carry = pool.length.isEven ? <String>[] : <String>[pool.last];
    final roundNumber = rounds.length + 1;
    final roundMatchNumbers = rounds.length < matchNumbers.length
        ? matchNumbers[rounds.length]
        : const <int>[];
    final games = <MatchSeed>[];
    final winners = <String>[];

    for (var index = 0; index + 1 < pairable.length; index += 2) {
      final matchIndex = games.length;
      final match = MatchSeed(
        pairable[index],
        pairable[index + 1],
        complete ? (matchIndex.isEven ? '1-0' : '0-1') : '-',
        matchNumber: matchIndex < roundMatchNumbers.length
            ? roundMatchNumbers[matchIndex]
            : null,
        nextIndex: feedsDropIn ? matchIndex : matchIndex ~/ 2,
      );
      games.add(match);
      winners.add(
        complete
            ? _matchWinner(match)
            : _matchWinner(match, 'L$roundNumber', matchIndex + 1),
      );
    }

    rounds.add(RoundSeed('L-Round $roundNumber', games));
    pool = [...winners, ...carry];
  }

  void pairDropIns(List<String> incoming) {
    if (incoming.isEmpty) return;
    if (pool.isEmpty) {
      pool = [...incoming];
      return;
    }

    final pairCount = math.min(pool.length, incoming.length);
    final roundNumber = rounds.length + 1;
    final roundMatchNumbers = rounds.length < matchNumbers.length
        ? matchNumbers[rounds.length]
        : const <int>[];
    final games = <MatchSeed>[];
    final winners = <String>[];

    for (var index = 0; index < pairCount; index++) {
      final match = MatchSeed(
        pool[index],
        incoming[index],
        complete ? (index.isEven ? '1-0' : '0-1') : '-',
        matchNumber: index < roundMatchNumbers.length
            ? roundMatchNumbers[index]
            : null,
        nextIndex: index ~/ 2,
      );
      games.add(match);
      winners.add(
        complete
            ? _matchWinner(match)
            : _matchWinner(match, 'L$roundNumber', index + 1),
      );
    }

    rounds.add(RoundSeed('L-Round $roundNumber', games));
    pool = [...winners, ...pool.skip(pairCount), ...incoming.skip(pairCount)];
  }

  for (final incoming in incomingPools) {
    reducePool(feedsDropIn: incoming.isNotEmpty);
    pairDropIns(incoming);
  }
  while (pool.length > 1) {
    reducePool();
  }

  return _normalizeLowerBracketRounds(
    rounds,
    preferredLabels: lowerRoundLabels,
  );
}

List<RoundSeed> _normalizeLowerBracketRounds(
  List<RoundSeed> rounds, {
  List<String> preferredLabels = const [],
  String? firstWinnerRoundCode,
}) {
  final fallbackLabels = _lowerBracketRoundLabels(
    [for (final round in rounds) round.games.length],
    includesFinalRound: _isLowerBracketFinalRound(
      rounds.isEmpty ? null : rounds.last.label,
    ),
  );
  final includesFinalRound = _isLowerBracketFinalRound(
    rounds.isEmpty ? null : rounds.last.label,
  );
  final labels = [
    for (var i = 0; i < rounds.length; i++)
      if (includesFinalRound && i == rounds.length - 1)
        'Final'
      else if (i < preferredLabels.length)
        preferredLabels[i]
      else if (i < fallbackLabels.length)
        fallbackLabels[i]
      else
        rounds[i].label,
  ];
  final rawToLabel = {
    for (var i = 0; i < labels.length; i++) 'L${i + 1}': labels[i],
  };
  final codeToIndex = _lowerBracketCodeIndex(labels);
  final lastRoundIndex = rounds.length - 1;

  return [
    for (var i = 0; i < rounds.length; i++)
      RoundSeed(labels[i], [
        for (final match in rounds[i].games)
          _rewriteLowerBracketMatch(
            match,
            rawToLabel,
            finalFeed: i == lastRoundIndex,
            firstWinnerRoundCode: firstWinnerRoundCode,
            roundIndex: i,
            labels: labels,
            codeToIndex: codeToIndex,
          ),
      ]),
  ];
}

Map<String, int> _lowerBracketCodeIndex(List<String> labels) {
  final codes = <String, int>{};
  for (var i = 0; i < labels.length; i++) {
    codes[_bracketRoundCode(labels[i]).toUpperCase()] = i;
    for (final code in _lowerBracketLegacyCodes(i)) {
      codes[code] = i;
    }
    final unprefixed = labels[i].replaceFirst(
      RegExp(r'\b(?:minor|major)\s+', caseSensitive: false),
      '',
    );
    if (RegExp(r'\bminor\b', caseSensitive: false).hasMatch(labels[i])) {
      codes[_bracketRoundCode('$unprefixed survivor').toUpperCase()] = i;
      codes[_bracketRoundCode('$unprefixed Qualifier').toUpperCase()] = i;
      if (i == 0 &&
          RegExp(r'quarterfinal', caseSensitive: false).hasMatch(labels[i])) {
        codes[_bracketRoundCode('Round of 16 survivor').toUpperCase()] = i;
        codes[_bracketRoundCode('Round of 16 Qualifier').toUpperCase()] = i;
      }
    }
    if (RegExp(r'\bmajor\b', caseSensitive: false).hasMatch(labels[i])) {
      codes[_bracketRoundCode(unprefixed).toUpperCase()] = i;
    }
  }
  return codes;
}

List<String> _lowerBracketLegacyCodes(int index) {
  const aliases = [
    ['MNQF', 'QFQ', 'QFS', 'R16S', 'R16Q'],
    ['MJQF', 'QF'],
    ['MNSF', 'SFQ', 'SFS'],
    ['MJSF', 'SF'],
    ['MNF', 'FQ', 'FS'],
    ['MJF', 'F'],
  ];
  return index < aliases.length ? aliases[index] : const [];
}

MatchSeed _rewriteLowerBracketMatch(
  MatchSeed match,
  Map<String, String> rawToLabel, {
  required bool finalFeed,
  String? firstWinnerRoundCode,
  required int roundIndex,
  required List<String> labels,
  required Map<String, int> codeToIndex,
}) {
  return MatchSeed(
    _rewriteLowerBracketPlaceholder(
      match.white,
      rawToLabel,
      firstWinnerRoundCode: firstWinnerRoundCode,
      roundIndex: roundIndex,
      labels: labels,
      codeToIndex: codeToIndex,
    ),
    _rewriteLowerBracketPlaceholder(
      match.black,
      rawToLabel,
      firstWinnerRoundCode: firstWinnerRoundCode,
      roundIndex: roundIndex,
      labels: labels,
      codeToIndex: codeToIndex,
    ),
    match.result,
    matchNumber: match.matchNumber,
    nextIndex: finalFeed ? 0 : match.nextIndex,
  );
}

String _rewriteLowerBracketPlaceholder(
  String value,
  Map<String, String> rawToLabel, {
  String? firstWinnerRoundCode,
  required int roundIndex,
  required List<String> labels,
  required Map<String, int> codeToIndex,
}) {
  final winnerMatch = RegExp(
    r'^Winner L(\d+)-(\d+)$',
    caseSensitive: false,
  ).firstMatch(value);
  var rewritten = value;
  if (winnerMatch != null) {
    final label = rawToLabel['L${winnerMatch.group(1)}'];
    rewritten = label == null
        ? value
        : 'Winner ${_bracketRoundCode(label)}-${winnerMatch.group(2)}';
  } else {
    final genericWinnerDrop = RegExp(
      r'^Loser WRound-(\d+)$',
      caseSensitive: false,
    ).firstMatch(value);
    if (genericWinnerDrop != null && firstWinnerRoundCode != null) {
      rewritten = 'Loser $firstWinnerRoundCode-${genericWinnerDrop.group(1)}';
    }
  }

  final stageWinner = RegExp(
    r'^Winner ([A-Z0-9]+)-(\d+)$',
    caseSensitive: false,
  ).firstMatch(rewritten);
  if (stageWinner == null || roundIndex < 1) return rewritten;

  final sourceCode = stageWinner.group(1)!.toUpperCase();
  final sourceIndex = codeToIndex[sourceCode];
  final pointsToFutureStage = sourceIndex == null
      ? RegExp(r'^(?:FQ|F)$').hasMatch(sourceCode)
      : sourceIndex >= roundIndex;
  if (!pointsToFutureStage) return rewritten;

  return 'Winner ${_bracketRoundCode(labels[roundIndex - 1])}-${stageWinner.group(2)}';
}

List<String> _lowerBracketRoundLabels(
  List<int> matchCounts, {
  bool includesFinalRound = false,
}) {
  return [
    for (var i = 0; i < matchCounts.length; i++)
      _lowerBracketRoundLabel(
        matchCounts,
        i,
        includesFinalRound: includesFinalRound,
      ),
  ];
}

List<String> _lowerBracketRoundLabelsFromWinnerRounds(
  List<String> winnerRoundLabels,
) {
  final count = math.max(0, (winnerRoundLabels.length - 1) * 2);
  return [
    for (var index = 0; index < count; index++)
      index == count - 1 ? 'Lower Final' : 'Lower Round ${index + 1}',
  ];
}

String _lowerBracketRoundLabel(
  List<int> matchCounts,
  int index, {
  required bool includesFinalRound,
}) {
  if (includesFinalRound && index == matchCounts.length - 1) {
    return 'Lower Final';
  }
  return 'Lower Round ${index + 1}';
}

bool _isLowerBracketFinalRound(String? label) {
  if (label == null) return false;
  return RegExp(
    r'^(?:(?:l|lower)[-\s]*)?final$',
    caseSensitive: false,
  ).hasMatch(label.trim());
}

String _matchWinner(
  MatchSeed? match, [
  String sourceLabel = 'Round',
  int matchNumber = 1,
]) {
  if (match == null) {
    return 'Winner ${_bracketRoundCode(sourceLabel)}-$matchNumber';
  }
  if (match.result == '0-1') return match.black;
  if (match.result == '1-0') return match.white;
  if (match.matchNumber != null) return 'Winner of ${match.matchNumber}';
  return 'Winner ${_bracketRoundCode(sourceLabel)}-$matchNumber';
}

String _matchLoser(MatchSeed? match, String sourceLabel, int matchNumber) {
  if (match == null) {
    return 'Loser ${_bracketRoundCode(sourceLabel)}-$matchNumber';
  }
  if (match.result == '0-1') return match.white;
  if (match.result == '1-0') return match.black;
  if (match.matchNumber != null) return 'Loser of ${match.matchNumber}';
  return 'Loser ${_bracketRoundCode(sourceLabel)}-$matchNumber';
}

const sampleGames = [
  GameSeed('Ibrahim Ahmad vs Rania Odeh', 'Blitz 3+2 · Jun 29', '1-0'),
  GameSeed('Omar Saleh vs Ibrahim Ahmad', 'Rapid 10+0 · Jun 27', '1/2'),
  GameSeed('Ibrahim Ahmad vs Yazan Khaled', 'Blitz 5+0 · Jun 25', '1-0'),
  GameSeed('Leen Haddad vs Ibrahim Ahmad', 'Rapid 15+10 · Jun 21', '0-1'),
];

const liveBoards = [
  LiveBoardSeed(1, 'Ibrahim Ahmad', 'Rania Odeh', 'Semifinal'),
  LiveBoardSeed(2, 'Omar Saleh', 'Leen Haddad', 'Semifinal'),
  LiveBoardSeed(3, 'Yazan Khaled', 'Mira Nasser', 'Round game'),
];

const sampleRounds = [
  RoundSeed('Round 4', [
    MatchSeed('Ibrahim Ahmad', 'Rania Odeh', '1-0'),
    MatchSeed('Omar Saleh', 'Leen Haddad', 'live'),
    MatchSeed('Yazan Khaled', 'Mira Nasser', '1/2'),
  ]),
  RoundSeed('Round 3', [
    MatchSeed('Ibrahim Ahmad', 'Omar Saleh', '1/2'),
    MatchSeed('Rania Odeh', 'Yazan Khaled', '1-0'),
    MatchSeed('Leen Haddad', 'Mira Nasser', '0-1'),
  ]),
];

const stageOneRounds = [
  RoundSeed('Stage One - Round 1', [
    MatchSeed('Ibrahim Ahmad', 'Jana Taha', '1-0'),
    MatchSeed('Rania Odeh', 'Adam Kareem', '1-0'),
    MatchSeed('Omar Saleh', 'Salma Nouri', '1/2'),
  ]),
  RoundSeed('Stage One - Round 2', [
    MatchSeed('Leen Haddad', 'Hadi Zaid', '1-0'),
    MatchSeed('Yazan Khaled', 'Dina Faris', '0-1'),
    MatchSeed('Mira Nasser', 'Laith Hani', '1-0'),
  ]),
];

const stageTwoRounds = [
  RoundSeed('Stage Two - Playoffs', [
    MatchSeed('Ibrahim Ahmad', 'Rania Odeh', 'live'),
    MatchSeed('Omar Saleh', 'Leen Haddad', 'live'),
    MatchSeed('Dina Faris', 'Mira Nasser', '-'),
  ]),
  RoundSeed('Stage Two - Finals', [
    MatchSeed('Semifinal winner', 'Semifinal winner', '-'),
    MatchSeed('Third-place match', 'Pending opponent', '-'),
  ]),
];

const bracketRounds = [
  RoundSeed('Round of 16', [
    MatchSeed('Ibrahim Ahmad', 'Jana Taha', '1-0'),
    MatchSeed('Rania Odeh', 'Adam Kareem', '1-0'),
    MatchSeed('Omar Saleh', 'Salma Nouri', '1-0'),
    MatchSeed('Leen Haddad', 'Hadi Zaid', '1-0'),
    MatchSeed('Yazan Khaled', 'Dina Faris', '0-1'),
    MatchSeed('Mira Nasser', 'Laith Hani', '1-0'),
    MatchSeed('Khaled Mansour', 'Tamer Qasem', '1-0'),
    MatchSeed('Sara Haddad', 'Nour Alami', '0-1'),
  ]),
  RoundSeed('Quarterfinal', [
    MatchSeed('Ibrahim Ahmad', 'Rania Odeh', '1-0'),
    MatchSeed('Omar Saleh', 'Leen Haddad', '1-0'),
    MatchSeed('Dina Faris', 'Mira Nasser', '0-1'),
    MatchSeed('Khaled Mansour', 'Nour Alami', '1-0'),
  ]),
  RoundSeed('Semifinal', [
    MatchSeed('Ibrahim Ahmad', 'Rania Odeh', 'live'),
    MatchSeed('Omar Saleh', 'Leen Haddad', 'live'),
  ]),
  RoundSeed('Final', [MatchSeed('TBD', 'TBD', '-')]),
];

const doubleEliminationWinnersRounds = [
  RoundSeed('W-Round of 16', [
    MatchSeed('Ibrahim Ahmad', 'Zaid Hamdan', '1-0', matchNumber: 1),
    MatchSeed('Sara Nasser', 'Hasan Qasem', '1-0', matchNumber: 2),
    MatchSeed('Leen Haddad', 'Noor Barakat', '1-0', matchNumber: 3),
    MatchSeed('Yazan Khaled', 'Khaled Mansour', '1-0', matchNumber: 4),
    MatchSeed('Omar Saleh', 'Tala Suleiman', '1-0', matchNumber: 5),
    MatchSeed('Mohammad Al-Khatib', 'Rania Odeh', '1-0', matchNumber: 6),
    MatchSeed('Amr Zaidan', 'Lina Shami', '1-0', matchNumber: 7),
    MatchSeed('Dana Aqel', 'Fadi Rimawi', '1-0', matchNumber: 8),
  ]),
  RoundSeed('W-Quarterfinal', [
    MatchSeed('Ibrahim Ahmad', 'Sara Nasser', '1-0', matchNumber: 13),
    MatchSeed('Leen Haddad', 'Yazan Khaled', '1-0', matchNumber: 14),
    MatchSeed('Omar Saleh', 'Mohammad Al-Khatib', '1-0', matchNumber: 15),
    MatchSeed('Dana Aqel', 'Amr Zaidan', '1-0', matchNumber: 16),
  ]),
  RoundSeed('W-Semifinal', [
    MatchSeed('Ibrahim Ahmad', 'Leen Haddad', '1-0', matchNumber: 23),
    MatchSeed('Omar Saleh', 'Dana Aqel', '1-0', matchNumber: 24),
  ]),
  RoundSeed('W-Final', [
    MatchSeed('Ibrahim Ahmad', 'Omar Saleh', '1-0', matchNumber: 28),
  ]),
];

const doubleEliminationLosersRounds = [
  RoundSeed('Lower Round 1', [
    MatchSeed(
      'Zaid Hamdan',
      'Hasan Qasem',
      '1-0',
      matchNumber: 9,
      nextIndex: 0,
    ),
    MatchSeed(
      'Noor Barakat',
      'Khaled Mansour',
      '1-0',
      matchNumber: 10,
      nextIndex: 1,
    ),
    MatchSeed(
      'Tala Suleiman',
      'Rania Odeh',
      '1-0',
      matchNumber: 11,
      nextIndex: 2,
    ),
    MatchSeed(
      'Lina Shami',
      'Fadi Rimawi',
      '1-0',
      matchNumber: 12,
      nextIndex: 3,
    ),
  ]),
  RoundSeed('Lower Round 2', [
    MatchSeed('Sara Nasser', 'Zaid Hamdan', '1-0', matchNumber: 20),
    MatchSeed('Yazan Khaled', 'Noor Barakat', '1-0', matchNumber: 19),
    MatchSeed('Mohammad Al-Khatib', 'Tala Suleiman', '1-0', matchNumber: 18),
    MatchSeed('Amr Zaidan', 'Lina Shami', '1-0', matchNumber: 17),
  ]),
  RoundSeed('Lower Round 3', [
    MatchSeed(
      'Sara Nasser',
      'Yazan Khaled',
      '1-0',
      matchNumber: 22,
      nextIndex: 0,
    ),
    MatchSeed(
      'Mohammad Al-Khatib',
      'Amr Zaidan',
      '1-0',
      matchNumber: 21,
      nextIndex: 1,
    ),
  ]),
  RoundSeed('Lower Round 4', [
    MatchSeed('Leen Haddad', 'Sara Nasser', '0-1', matchNumber: 25),
    MatchSeed('Dana Aqel', 'Mohammad Al-Khatib', '0-1', matchNumber: 26),
  ]),
  RoundSeed('Lower Round 5', [
    MatchSeed('Sara Nasser', 'Mohammad Al-Khatib', '1-0', matchNumber: 27),
  ]),
  RoundSeed('Lower Final', [
    MatchSeed('Omar Saleh', 'Sara Nasser', 'live', matchNumber: 29),
  ]),
];

const doubleEliminationFinalRounds = [
  RoundSeed('Grand Final', [
    MatchSeed('Ibrahim Ahmad', 'Winner of 29', '-', matchNumber: 30),
  ]),
  RoundSeed('Reset if needed', [
    MatchSeed('Winner of 30', 'Reset only if needed', '-', matchNumber: 31),
  ]),
];

const savedAnalyses = [
  SavedAnalysisSeed("King's Indian prep vs Omar", '32 moves · Jun 25'),
  SavedAnalysisSeed('Rapid round 2 endgame', '18 moves · Jun 28'),
];

const puzzleSeeds = [
  PuzzleSeed(
    title: 'Finish Scholar\'s Mate',
    theme: 'Mate in 1',
    rating: 900,
    icon: 'M1',
    setupMoves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6'],
    solutionMoves: ['Qxf7#'],
  ),
  PuzzleSeed(
    title: 'Fool\'s Mate Punishment',
    theme: 'Mate in 1',
    rating: 700,
    icon: 'M1',
    setupMoves: ['f3', 'e5', 'g4'],
    solutionMoves: ['Qh4#'],
  ),
  PuzzleSeed(
    title: 'Castle Into Safety',
    theme: 'Best move',
    rating: 1050,
    icon: 'T',
    setupMoves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'],
    solutionMoves: ['O-O'],
  ),
];
