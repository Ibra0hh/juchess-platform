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
  static const endpoint = String.fromEnvironment('APPWRITE_ENDPOINT');
  static const projectId = String.fromEnvironment('APPWRITE_PROJECT_ID');
  static const databaseId = String.fromEnvironment('APPWRITE_DATABASE_ID');
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
  static const accessGuardFunctionId = String.fromEnvironment(
    'APPWRITE_ACCESS_GUARD_FUNCTION_ID',
    defaultValue: 'access-guards',
  );
  static const recoveryUrl = String.fromEnvironment(
    'APPWRITE_RECOVERY_URL',
    defaultValue: 'https://juchess.ju.edu.jo/reset-password',
  );
}

class AppwriteService {
  AppwriteService() {
    if (AppConfig.endpoint.isNotEmpty && AppConfig.projectId.isNotEmpty) {
      client.setEndpoint(AppConfig.endpoint).setProject(AppConfig.projectId);
    }
  }

  final Client client = Client();
  late final Account account = Account(client);
  late final TablesDB tablesDB = TablesDB(client);
  late final Storage storage = Storage(client);
  late final Functions functions = Functions(client);

  bool get ready =>
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

  Future<Map<String, String?>> assertCurrentUserAllowed(
    models.User user,
  ) async {
    final profile = await loadProfileIdentity(user.$id);
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

  Future<void> registerForTournament({
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

    if (existing.rows.isNotEmpty) {
      final activeRows = existing.rows.where(
        (row) => row.data['status'] != 'cancelled',
      );
      if (activeRows.isNotEmpty) return;

      for (final row in existing.rows) {
        await tablesDB.updateRow(
          databaseId: AppConfig.databaseId,
          tableId: AppConfig.registrationsTableId,
          rowId: row.$id,
          data: {'status': 'confirmed', 'checkedIn': false},
        );
        break;
      }
      return;
    }

    await tablesDB.createRow(
      databaseId: AppConfig.databaseId,
      tableId: AppConfig.registrationsTableId,
      rowId: ID.unique(),
      data: {
        'tournamentId': tournamentRowId,
        'profileId': profileId,
        'status': 'confirmed',
        'checkedIn': false,
        'checkInCode': _checkInCode(),
      },
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
      await tablesDB.updateRow(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.registrationsTableId,
        rowId: row.$id,
        data: {'status': 'cancelled', 'checkedIn': false},
      );
    }
  }

  Future<Set<String>> loadRegisteredTournamentIds(String profileId) async {
    final response = await tablesDB.listRows(
      databaseId: AppConfig.databaseId,
      tableId: AppConfig.registrationsTableId,
      queries: [
        Query.equal('profileId', profileId),
        Query.notEqual('status', 'cancelled'),
        Query.limit(500),
      ],
      total: false,
      ttl: 30,
    );

    return response.rows
        .map((row) => row.data['tournamentId']?.toString())
        .whereType<String>()
        .toSet();
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
    final counts = await _loadRegistrationCounts();
    final response = await tablesDB.listRows(
      databaseId: AppConfig.databaseId,
      tableId: AppConfig.tournamentsTableId,
      queries: [Query.limit(100)],
      total: false,
      ttl: 30,
    );

    final rows =
        uniqueTournamentsByFormat(
          response.rows
              .map((row) => _mapTournament(row, counts))
              .whereType<TournamentSeed>(),
        )..sort((a, b) {
          final status = _statusOrder(
            a.status,
          ).compareTo(_statusOrder(b.status));
          return status == 0 ? a.name.compareTo(b.name) : status;
        });

    return rows;
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
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
        ],
      );
    } catch (_) {
      // Account creation is still valid if the profile row is blocked by table permissions.
    }
  }

  Future<Map<String, int>> _loadRegistrationCounts() async {
    final counts = <String, int>{};

    try {
      final response = await tablesDB.listRows(
        databaseId: AppConfig.databaseId,
        tableId: AppConfig.registrationsTableId,
        queries: [Query.limit(500)],
        total: false,
        ttl: 30,
      );

      for (final row in response.rows) {
        final tournamentId = row.data['tournamentId']?.toString();
        final status = row.data['status']?.toString();
        if (tournamentId == null || status == 'cancelled') continue;
        counts[tournamentId] = (counts[tournamentId] ?? 0) + 1;
      }
    } catch (_) {
      return counts;
    }

    return counts;
  }

  TournamentSeed? _mapTournament(models.Row row, Map<String, int> counts) {
    final data = row.data;
    final format = data['format']?.toString();
    final timeControl = data['timeControl']?.toString();
    final rawStatus = data['status']?.toString() ?? 'upcoming';

    if (format == null || timeControl == null) return null;
    if (rawStatus == 'draft' || rawStatus == 'cancelled') return null;
    final displayFormat = normalizeTournamentFormat(format);

    final roundsTotal = _asInt(data['roundsTotal']);
    final currentRound = _asInt(data['currentRound']);
    final capacity = _asInt(data['capacity']);
    final players = counts[row.$id] ?? 0;
    final displayedPlayers = capacity == null
        ? players
        : players.clamp(0, capacity).toInt();
    final location = data['location']?.toString() ?? 'University of Jordan';
    final startsAt = data['startsAt']?.toString();

    return TournamentSeed(
      rowId: row.$id,
      id: tournamentFormatId(displayFormat),
      name: displayFormat,
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
    );
  }
}

class AppState extends ChangeNotifier {
  AppState(this.service) {
    unawaited(bootstrap());
  }

  final AppwriteService service;
  int tab = _initialPreviewTab();
  bool authLoading = false;
  bool dataLoading = false;
  String tournamentFilter = 'active';
  String? userName = _initialPreviewUserName();
  String? userEmail = _initialPreviewEmail();
  String? profileId;
  String? error;
  List<TournamentSeed> tournamentItems = const [];
  Set<String> registeredTournamentRowIds = <String>{};

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
          registeredTournamentRowIds = await service
              .loadRegisteredTournamentIds(profileId!);
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
        registeredTournamentRowIds = await service.loadRegisteredTournamentIds(
          profileId!,
        );
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
      final profile = await service.loadProfileIdentity(user.$id);
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
      profileId = profile['profileId'];
      if (profileId != null) {
        registeredTournamentRowIds = await service.loadRegisteredTournamentIds(
          profileId!,
        );
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
      final profile = await service.loadProfileIdentity(user.$id);
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
      profileId = profile['profileId'];
      if (profileId != null) {
        registeredTournamentRowIds = await service.loadRegisteredTournamentIds(
          profileId!,
        );
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
    registeredTournamentRowIds = <String>{};
    notifyListeners();
  }

  bool isRegisteredFor(TournamentSeed event) {
    return registeredTournamentRowIds.contains(event.rowId);
  }

  Future<bool> registerForTournament(TournamentSeed event) async {
    if (!signedIn) {
      error = 'Sign in to register for this tournament.';
      notifyListeners();
      return false;
    }

    if (_isMemberPreview()) {
      registeredTournamentRowIds = {...registeredTournamentRowIds, event.rowId};
      error = null;
      notifyListeners();
      return true;
    }

    if (!service.ready || profileId == null) {
      error = 'Account service is not ready yet.';
      notifyListeners();
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
      registeredTournamentRowIds = {...registeredTournamentRowIds, event.rowId};
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
      registeredTournamentRowIds = {...registeredTournamentRowIds}
        ..remove(event.rowId);
      error = null;
      notifyListeners();
      return true;
    }

    if (!service.ready || profileId == null) {
      error = 'Account service is not ready yet.';
      notifyListeners();
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
      registeredTournamentRowIds = {...registeredTournamentRowIds}
        ..remove(event.rowId);
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
  if (status == 'active') return 0;
  if (status == 'upcoming') return 1;
  return 2;
}

String _checkInCode() {
  final value = DateTime.now().microsecondsSinceEpoch % 900000;
  return (value + 100000).toString();
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
  const JuChessApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => AppwriteService()),
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
                      NavigationRail(
                        backgroundColor: PrototypeColors.header,
                        selectedIndex: state.tab,
                        onDestinationSelected: state.selectTab,
                        labelType: NavigationRailLabelType.all,
                        indicatorColor: PrototypeColors.burgundy,
                        selectedIconTheme: const IconThemeData(
                          color: PrototypeColors.cream,
                        ),
                        selectedLabelTextStyle: const TextStyle(
                          color: PrototypeColors.burgundy,
                          fontWeight: FontWeight.w700,
                        ),
                        leading: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          child: ClipOval(
                            child: Image.asset(
                              'assets/juchess-logo.png',
                              width: 46,
                              height: 46,
                            ),
                          ),
                        ),
                        destinations: const [
                          NavigationRailDestination(
                            icon: Icon(Icons.home_outlined),
                            selectedIcon: Icon(Icons.home),
                            label: Text('Home'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.emoji_events_outlined),
                            selectedIcon: Icon(Icons.emoji_events),
                            label: Text('Tournaments'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.grid_view_outlined),
                            selectedIcon: Icon(Icons.grid_view),
                            label: Text('Games'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.tune),
                            selectedIcon: Icon(Icons.tune),
                            label: Text('Tools'),
                          ),
                          NavigationRailDestination(
                            icon: Icon(Icons.person_outline),
                            selectedIcon: Icon(Icons.person),
                            label: Text('Profile'),
                          ),
                        ],
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

class AppScroll extends StatelessWidget {
  const AppScroll({required this.children, super.key});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
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
    this.showGuest = false,
    super.key,
  });

  final String title;
  final String? subtitle;
  final bool showGuest;

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
          if (showGuest) const GuestPill(),
        ],
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final featuredTournament = context.watch<AppState>().featuredTournament;

    return AppScroll(
      children: [
        const PrototypeHeader(
          title: 'JuChess',
          subtitle: 'University of Jordan Chess Club',
          showGuest: true,
        ),
        const GuestCard(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: featuredTournament == null
              ? EmptyTournamentCard(
                  onTap: () => context.read<AppState>().selectTab(1),
                )
              : FeaturedTournamentCard(
                  event: featuredTournament,
                  onTap: () =>
                      openTournamentDetail(context, featuredTournament),
                ),
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
          title: 'Announcements',
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const NewsList(),
      ],
    );
  }
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
                      ? 'Signed in as ${state.userName}'
                      : "You're browsing as a guest",
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  state.signedIn
                      ? 'Registrations and analyses stay saved to your account'
                      : 'Sign in to register and save analyses',
                  style: const TextStyle(
                    color: Color(0x9921304e),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
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
        ],
      ),
    );
  }
}

class FeaturedTournamentCard extends StatelessWidget {
  const FeaturedTournamentCard({
    required this.event,
    required this.onTap,
    super.key,
  });

  final TournamentSeed event;
  final VoidCallback onTap;

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
              const Text(
                'FEATURED TOURNAMENT',
                style: TextStyle(
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

    return AppScroll(
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
                    context.read<AppState>().selectTournamentFilter('active'),
                child: TabPill('Active', selected: selected == 'active'),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () =>
                    context.read<AppState>().selectTournamentFilter('upcoming'),
                child: TabPill('Upcoming', selected: selected == 'upcoming'),
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
  String tab = 'overview';

  TournamentSeed get event => widget.event;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final registered = state.isRegisteredFor(event);
    final tabs = _tabsFor(event);

    return Scaffold(
      backgroundColor: PrototypeColors.screen,
      body: SafeArea(
        child: SingleChildScrollView(
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
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: tabs
                            .map(
                              (item) => Padding(
                                padding: const EdgeInsets.only(right: 7),
                                child: GestureDetector(
                                  onTap: () => setState(() => tab = item.key),
                                  child: DetailTabPill(
                                    item.label,
                                    selected: tab == item.key,
                                    live:
                                        item.key == 'games' &&
                                        event.status == 'active',
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ),
                  if (tab == 'overview')
                    _TournamentOverview(
                      event: event,
                      registered: registered,
                      onRegister: () async {
                        if (!state.signedIn) {
                          showAuthSheet(context);
                          return;
                        }
                        final appState = context.read<AppState>();
                        final messenger = ScaffoldMessenger.of(context);
                        final wasRegistered = appState.isRegisteredFor(event);
                        final ok = wasRegistered
                            ? await appState.cancelTournamentRegistration(event)
                            : await appState.registerForTournament(event);
                        if (!mounted) return;
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(
                              ok
                                  ? wasRegistered
                                        ? 'Registration cancelled.'
                                        : 'Registration saved.'
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
                  else if (tab == 'games')
                    _TournamentLiveTab(event: event)
                  else
                    _TournamentPlayersTab(event: event),
                ],
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
      items.add(const DetailTab('games', 'Games'));
    } else {
      items.add(const DetailTab('rounds', 'Rounds'));
      items.add(const DetailTab('games', 'Games'));
      items.add(const DetailTab('main', 'Standings'));
    }
    if (!items.any((item) => item.key == tab)) tab = 'overview';
    return items;
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: selected ? PrototypeColors.navy : Colors.transparent,
        border: Border.all(color: const Color(0x4021304e)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
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
          Text(
            label,
            style: TextStyle(
              color: selected ? PrototypeColors.cream : PrototypeColors.navy,
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
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
  });

  final TournamentSeed event;
  final bool registered;
  final VoidCallback onRegister;
  final VoidCallback onMain;

  @override
  Widget build(BuildContext context) {
    final completed = event.status == 'completed';

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PrototypeButton(
            label: completed
                ? 'View final ${_mainTabLabel(event).toLowerCase()}'
                : registered
                ? 'Cancel registration'
                : 'Register',
            onTap: completed ? onMain : onRegister,
          ),
        ],
      ),
    );
  }
}

class _TournamentLiveTab extends StatelessWidget {
  const _TournamentLiveTab({required this.event});

  final TournamentSeed event;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Column(
        children: liveBoards
            .map(
              (game) => PrototypeCard(
                margin: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Board ${game.board}',
                          style: const TextStyle(
                            color: Color(0x8021304e),
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          game.note,
                          style: const TextStyle(
                            color: Color(0x7321304e),
                            fontSize: 11,
                          ),
                        ),
                        const Spacer(),
                        const LivePill(small: true),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              PlayerColorLine(
                                color: PrototypeColors.surface,
                                name: game.white,
                                border: true,
                              ),
                              const SizedBox(height: 6),
                              PlayerColorLine(
                                color: const Color(0xff232a36),
                                name: game.black,
                              ),
                            ],
                          ),
                        ),
                        PrototypeOutlineButton(
                          label: 'Watch',
                          onTap: () => openPrototypeRoute(
                            context,
                            const AnalysisBoardScreen(mode: 'live'),
                          ),
                        ),
                      ],
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
      if (_isDoubleElimination(event)) {
        return TournamentDoubleEliminationBracketView(event: event);
      }
      return TournamentBracketView(rounds: buildSingleEliminationRounds(event));
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: PrototypeCard(
        margin: EdgeInsets.zero,
        padding: EdgeInsets.zero,
        child: Column(
          children: clubPlayers.take(event.players.clamp(4, 10).toInt()).map((
            player,
          ) {
            final points = (10 - player.rank) / 2;
            return StandingRow(
              rank: player.rank,
              name: player.name,
              rating: player.rating,
              points: points < 0 ? '0' : points.toStringAsFixed(1),
              record: '${player.rank + 1}-${player.rank % 2}-${player.rank}',
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
      final target = (index * 186.0).clamp(0.0, max);
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
                    round: widget.rounds[i],
                    roundIndex: i,
                    maxMatches: widget.rounds.first.games.length,
                  ),
                  if (i != widget.rounds.length - 1)
                    BracketConnector(
                      roundIndex: i,
                      sourceMatches: widget.rounds[i].games,
                      targetMatches: widget.rounds[i + 1].games.length,
                      maxMatches: widget.rounds.first.games.length,
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

  static const matchHeight = 90.0;
  static const baseGap = 12.0;
  static const basePitch = matchHeight + baseGap;
  static const labelBand = 29.0;
  static const connectorWidth = 46.0;

  static double roundOffset(int roundIndex) {
    final step = 1 << roundIndex;
    return basePitch * (step - 1) / 2;
  }

  static double matchTop(int roundIndex, int matchIndex) {
    return labelBand +
        roundOffset(roundIndex) +
        matchIndex * basePitch * (1 << roundIndex);
  }

  static double matchCenter(int roundIndex, int matchIndex) {
    return matchTop(roundIndex, matchIndex) + matchHeight / 2;
  }

  static double boardHeight(int maxMatches) {
    return labelBand + maxMatches * basePitch - baseGap;
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
    required this.round,
    required this.roundIndex,
    required this.maxMatches,
    super.key,
  });

  final RoundSeed round;
  final int roundIndex;
  final int maxMatches;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 172,
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
              top: BracketMetrics.matchTop(roundIndex, i),
              left: 0,
              right: 0,
              height: BracketMetrics.matchHeight,
              child: BracketMatchCard(match: round.games[i]),
            ),
        ],
      ),
    );
  }
}

class BracketConnector extends StatelessWidget {
  const BracketConnector({
    required this.roundIndex,
    required this.sourceMatches,
    required this.targetMatches,
    required this.maxMatches,
    super.key,
  });

  final int roundIndex;
  final List<MatchSeed> sourceMatches;
  final int targetMatches;
  final int maxMatches;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: BracketMetrics.connectorWidth,
      height: BracketMetrics.boardHeight(maxMatches),
      child: CustomPaint(
        painter: BracketConnectorPainter(
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
    required this.roundIndex,
    required this.sourceMatches,
    required this.targetMatches,
  });

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

      final sourceY = BracketMetrics.matchCenter(roundIndex, sourceIndex);
      final targetY = BracketMetrics.matchCenter(roundIndex + 1, targetIndex);
      final midX = size.width / 2;
      final paint = switch (match.result.toLowerCase()) {
        'live' => livePaint,
        '1-0' || '0-1' => decidedPaint,
        _ => mutedPaint,
      };

      final path = Path()
        ..moveTo(0, sourceY)
        ..lineTo(midX, sourceY)
        ..lineTo(midX, targetY)
        ..lineTo(size.width, targetY);
      canvas.drawPath(path, paint);
      canvas.drawCircle(Offset(size.width, targetY), 2.0, endPaint);
    }
  }

  @override
  bool shouldRepaint(covariant BracketConnectorPainter oldDelegate) {
    return oldDelegate.roundIndex != roundIndex ||
        oldDelegate.sourceMatches != sourceMatches ||
        oldDelegate.targetMatches != targetMatches;
  }
}

class BracketMatchCard extends StatelessWidget {
  const BracketMatchCard({required this.match, super.key});

  final MatchSeed match;

  bool get _live => match.result.toLowerCase() == 'live';
  bool get _whiteWon => match.result == '1-0';
  bool get _blackWon => match.result == '0-1';

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: PrototypeColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0x2e21304e)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          BracketPlayerRow(
            name: match.white,
            winner: _whiteWon,
            faded: _blackWon,
            bottomBorder: true,
          ),
          BracketPlayerRow(
            name: match.black,
            winner: _blackWon,
            faded: _whiteWon,
            bottomBorder: false,
          ),
          if (_live)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
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
  }
}

class BracketPlayerRow extends StatelessWidget {
  const BracketPlayerRow({
    required this.name,
    required this.winner,
    required this.faded,
    required this.bottomBorder,
    super.key,
  });

  final String name;
  final bool winner;
  final bool faded;
  final bool bottomBorder;

  bool get _pending =>
      name == 'TBD' ||
      name.startsWith('Winner ') ||
      name.startsWith('Loser ') ||
      name.startsWith('Reset ');

  @override
  Widget build(BuildContext context) {
    final opacity = _pending ? 0.45 : (faded ? 0.42 : 1.0);
    return Expanded(
      child: Opacity(
        opacity: opacity,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            border: bottomBorder
                ? const Border(bottom: BorderSide(color: Color(0x1421304e)))
                : null,
          ),
          child: Row(
            children: [
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
                    fontStyle: _pending ? FontStyle.italic : FontStyle.normal,
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
    final rounds = widget.event.status == 'upcoming'
        ? <RoundSeed>[]
        : _roundsForStage(widget.event, _stageTab);
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
            (round) => PrototypeCard(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    round.label,
                    style: const TextStyle(
                      color: PrototypeColors.burgundy,
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 9),
                  ...round.games.map(
                    (game) => MatchLine(
                      white: game.white,
                      black: game.black,
                      result: game.result,
                    ),
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
    final shown = event.players == 0 ? 8 : event.players.clamp(4, 16).toInt();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: PrototypeCard(
        margin: EdgeInsets.zero,
        padding: EdgeInsets.zero,
        child: Column(
          children: clubPlayers
              .take(shown)
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
  if (!_hasStageRounds(event)) return sampleRounds;
  return stageTab == 'stage-two' ? stageTwoRounds : stageOneRounds;
}

bool _hasBracketTab(TournamentSeed event) {
  final lower = event.format.toLowerCase();
  return lower.contains('knockout') || lower.contains('elimination');
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
    super.key,
  });

  final bool flipped;
  final List<String> moves;
  final void Function(List<String> moves, String result) onChanged;

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
      game.move(move);
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

    final san = game.san_moves().last?.toString();
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
                    onTap: () => _handleSquareTap(square, game, legalMoves),
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
  static const presets = [
    ('3+2', 180, 2),
    ('5+0', 300, 0),
    ('10+5', 600, 5),
    ('15+10', 900, 10),
  ];

  String preset = '5+0';
  int white = 300;
  int black = 300;
  int increment = 0;
  String turn = 'white';
  bool running = false;
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
      toggleRun();
      return;
    }
    setState(() {
      if (side == 'white' && turn == 'white') {
        white += increment;
        turn = 'black';
      } else if (side == 'black' && turn == 'black') {
        black += increment;
        turn = 'white';
      }
    });
  }

  void applyPreset((String, int, int) value) {
    timer?.cancel();
    setState(() {
      preset = value.$1;
      white = value.$2;
      black = value.$2;
      increment = value.$3;
      running = false;
      turn = 'white';
    });
  }

  @override
  Widget build(BuildContext context) {
    return PrototypeRouteScaffold(
      title: 'Chess Clock',
      children: [
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SegmentedPills(
            labels: presets.map((item) => item.$1).toList(),
            selected: preset,
            onSelected: (label) =>
                applyPreset(presets.firstWhere((item) => item.$1 == label)),
          ),
        ),
        const SizedBox(height: 14),
        ClockPanel(
          label: 'Black',
          time: _clock(black),
          active: running && turn == 'black',
          onTap: () => tapSide('black'),
        ),
        ClockPanel(
          label: 'White',
          time: _clock(white),
          active: running && turn == 'white',
          onTap: () => tapSide('white'),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: PrototypeOutlineButton(
                  label: 'Reset',
                  onTap: () =>
                      applyPreset(presets.firstWhere((p) => p.$1 == preset)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrototypeButton(
                  label: running ? 'Pause' : 'Resume',
                  onTap: toggleRun,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _clock(int seconds) {
    final minutes = seconds ~/ 60;
    final rest = seconds % 60;
    return '$minutes:${rest.toString().padLeft(2, '0')}';
  }
}

class ClockPanel extends StatelessWidget {
  const ClockPanel({
    required this.label,
    required this.time,
    required this.active,
    required this.onTap,
    super.key,
  });

  final String label;
  final String time;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          height: 170,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: active ? PrototypeColors.navy : PrototypeColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: active ? PrototypeColors.navy : const Color(0x3821304e),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: active ? PrototypeColors.cream : PrototypeColors.navy,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                time,
                style: TextStyle(
                  color: active ? PrototypeColors.cream : PrototypeColors.navy,
                  fontFamily: 'monospace',
                  fontSize: 52,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                active ? 'Running...' : 'Tap to start opponent',
                style: TextStyle(
                  color: active
                      ? const Color(0xccf7f1e3)
                      : const Color(0x9921304e),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
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

class GuestPill extends StatelessWidget {
  const GuestPill({super.key});

  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AppState>().signedIn;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: signedIn ? const Color(0x147d2434) : const Color(0x1021304e),
        border: Border.all(
          color: signedIn ? const Color(0x337d2434) : const Color(0x2e21304e),
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        signedIn ? 'Signed In' : 'Guest Mode',
        style: TextStyle(
          color: signedIn ? PrototypeColors.burgundy : const Color(0xcc21304e),
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
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

class MatchSeed {
  const MatchSeed(this.white, this.black, this.result, {this.nextIndex});

  final String white;
  final String black;
  final String result;
  final int? nextIndex;
}

class SavedAnalysisSeed {
  const SavedAnalysisSeed(this.title, this.subtitle);

  final String title;
  final String subtitle;
}

const clubPlayers = [
  PlayerSeed(1, 'Ibrahim Ahmad', 1810, 'ibrahim_ahmad'),
  PlayerSeed(2, 'Omar Saleh', 1740, 'omarsaleh'),
  PlayerSeed(3, 'Leen Haddad', 1685, 'leen_haddad'),
  PlayerSeed(4, 'Yazan Khaled', 1602, 'yazan_k'),
  PlayerSeed(5, 'Rania Odeh', 1578, 'rania_odeh'),
  PlayerSeed(6, 'Mira Nasser', 1535, 'mira_n'),
  PlayerSeed(7, 'Khaled Mansour', 1498, 'khaledm'),
  PlayerSeed(8, 'Sara Haddad', 1464, 'sara_h'),
  PlayerSeed(9, 'Nour Alami', 1432, 'nour_alami'),
  PlayerSeed(10, 'Tamer Qasem', 1408, 'tamer_q'),
  PlayerSeed(11, 'Laith Hani', 1384, 'laith_h'),
  PlayerSeed(12, 'Dina Faris', 1365, 'dina_f'),
  PlayerSeed(13, 'Hadi Zaid', 1344, 'hadi_zaid'),
  PlayerSeed(14, 'Salma Nouri', 1328, 'salma_n'),
  PlayerSeed(15, 'Adam Kareem', 1305, 'adam_k'),
  PlayerSeed(16, 'Jana Taha', 1288, 'jana_t'),
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

List<RoundSeed> buildSingleEliminationRounds(
  TournamentSeed event, {
  String prefix = '',
  int? forceActiveRound,
}) {
  final players = _bracketPlayerNames(event);
  final counts = _bracketRoundCounts(players.length);
  final labels = counts
      .map((count) => '$prefix${_bracketRoundName(count)}')
      .toList();
  final activeRound =
      forceActiveRound ?? _activeBracketRoundIndex(labels, event);
  final baseSize = _previousPowerOfTwo(players.length);
  final hasPlayIn = players.length != baseSize;
  final byeCount = hasPlayIn ? math.max(0, baseSize * 2 - players.length) : 0;
  final byes = players.take(byeCount).toList();
  var current = hasPlayIn ? players.skip(byeCount).toList() : players;
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
      final result = live
          ? 'live'
          : complete
          ? (matchIndex.isEven ? '1-0' : '0-1')
          : '-';
      final nextIndex = hasPlayIn && roundIndex == 0
          ? ((byeCount + matchIndex) / 2).floor()
          : null;
      final match = MatchSeed(
        current[index],
        current[index + 1],
        result,
        nextIndex: nextIndex,
      );
      games.add(match);
      winners.add(
        complete ? _matchWinner(match) : 'Winner $sourceCode-${matchIndex + 1}',
      );
    }

    rounds.add(RoundSeed(labels[roundIndex], games));
    current = hasPlayIn && roundIndex == 0
        ? _interleaveNames(byes, winners)
        : winners;
  }

  return rounds;
}

DoubleEliminationRoundSets buildDoubleEliminationRounds(TournamentSeed event) {
  final winnerRoundActive = RegExp(
    r'winner|w-',
    caseSensitive: false,
  ).hasMatch(event.current);
  final winners = buildSingleEliminationRounds(
    event,
    prefix: 'W-',
    forceActiveRound: winnerRoundActive ? null : 999,
  );
  final firstLoserPool = _losersFromRound(
    winners.isNotEmpty ? winners.first : null,
    'W-Round',
  );
  final incomingLosers = winners.length > 2
      ? winners
            .sublist(1, winners.length - 1)
            .map((round) => _losersFromRound(round, round.label))
            .toList()
      : <List<String>>[];
  final loserRounds = _buildLoserRounds(firstLoserPool, incomingLosers, event);
  final winnersFinal = winners.isNotEmpty ? winners.last : null;
  final winnersFinalMatch = winnersFinal?.games.isNotEmpty == true
      ? winnersFinal!.games.first
      : null;
  final loserFinalOpponent =
      loserRounds.isNotEmpty && loserRounds.last.games.isNotEmpty
      ? _matchWinner(loserRounds.last.games.first)
      : firstLoserPool.isNotEmpty
      ? firstLoserPool.first
      : 'Losers qualifier';
  final loserFinal = MatchSeed(
    _matchLoser(winnersFinalMatch, winnersFinal?.label ?? 'W-Final', 1),
    loserFinalOpponent,
    event.status == 'active' ? 'live' : '-',
  );
  final grandFinal = MatchSeed(
    _matchWinner(winnersFinalMatch, winnersFinal?.label ?? 'W-Final', 1),
    loserFinal.result == 'live' ? 'Winner L-Final' : _matchWinner(loserFinal),
    event.status == 'completed' ? '1-0' : '-',
  );

  return DoubleEliminationRoundSets(
    winners: winners,
    losers: [
      ...loserRounds,
      RoundSeed('L-Final', [loserFinal]),
    ],
    finalRounds: [
      RoundSeed('Grand Final', [grandFinal]),
      const RoundSeed('Reset if needed', [
        MatchSeed('Winner Grand Final', 'Reset only if needed', '-'),
      ]),
    ],
  );
}

List<String> _bracketPlayerNames(TournamentSeed event) {
  final declared = event.players > 0
      ? event.players
      : event.capacity ?? clubPlayers.length;
  final count = math.max(2, math.min(clubPlayers.length, declared));
  return clubPlayers.take(count).map((player) => player.name).toList();
}

List<int> _bracketRoundCounts(int playerCount) {
  final baseSize = _previousPowerOfTwo(playerCount);
  final counts = playerCount == baseSize
      ? <int>[playerCount]
      : <int>[playerCount, baseSize];
  var next = (counts.last / 2).floor();
  while (next >= 2) {
    counts.add(next);
    next = (next / 2).floor();
  }
  return counts;
}

int _previousPowerOfTwo(int value) {
  var result = 1;
  while (result * 2 <= value) {
    result *= 2;
  }
  return math.max(2, result);
}

String _bracketRoundName(int playersInRound) {
  if (playersInRound == 2) return 'Final';
  if (playersInRound == 4) return 'Semifinal';
  if (playersInRound == 8) return 'Quarterfinal';
  return 'Round of $playersInRound';
}

String _bracketRoundCode(String label) {
  final lower = label.toLowerCase();
  if (lower.contains('final') && !lower.contains('semi')) return 'F';
  if (lower.contains('semifinal')) return 'SF';
  if (lower.contains('quarterfinal')) return 'QF';
  final roundMatch = RegExp(
    r'round of\s*(\d+)',
    caseSensitive: false,
  ).firstMatch(label);
  if (roundMatch != null) return 'R${roundMatch.group(1)}';
  final loserMatch = RegExp(
    r'l-round\s*(\d+)',
    caseSensitive: false,
  ).firstMatch(label);
  if (loserMatch != null) return 'L${loserMatch.group(1)}';
  return label.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '');
}

int _activeBracketRoundIndex(List<String> labels, TournamentSeed event) {
  if (event.status == 'completed') return labels.length;
  if (event.status != 'active') return 0;
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

List<String> _interleaveNames(List<String> byes, List<String> winners) {
  final rows = <String>[];
  final maxLength = math.max(byes.length, winners.length);
  for (var index = 0; index < maxLength; index++) {
    if (index < byes.length) rows.add(byes[index]);
    if (index < winners.length) rows.add(winners[index]);
  }
  return rows;
}

List<String> _losersFromRound(RoundSeed? round, String sourceLabel) {
  if (round == null) return const [];
  return [
    for (var i = 0; i < round.games.length; i++)
      _matchLoser(round.games[i], sourceLabel, i + 1),
  ];
}

List<RoundSeed> _buildLoserRounds(
  List<String> firstPool,
  List<List<String>> incomingPools,
  TournamentSeed event,
) {
  final rounds = <RoundSeed>[];
  var pool = [...firstPool];

  void reducePool() {
    if (pool.length < 2) return;
    final pairable = pool.length.isEven
        ? pool
        : pool.sublist(0, pool.length - 1);
    final carry = pool.length.isEven ? <String>[] : <String>[pool.last];
    final roundNumber = rounds.length + 1;
    final complete = event.status == 'active' || event.status == 'completed';
    final games = <MatchSeed>[];
    final winners = <String>[];

    for (var index = 0; index + 1 < pairable.length; index += 2) {
      final matchIndex = games.length;
      final match = MatchSeed(
        pairable[index],
        pairable[index + 1],
        complete ? (matchIndex.isEven ? '1-0' : '0-1') : '-',
      );
      games.add(match);
      winners.add(
        complete
            ? _matchWinner(match)
            : 'Winner L$roundNumber-${matchIndex + 1}',
      );
    }

    rounds.add(RoundSeed('L-Round $roundNumber', games));
    pool = [...winners, ...carry];
  }

  for (final incoming in incomingPools) {
    reducePool();
    pool = [...pool, ...incoming];
  }
  while (pool.length > 1) {
    reducePool();
  }

  return [
    for (var i = 0; i < rounds.length; i++)
      RoundSeed(
        i == rounds.length - 1 && rounds[i].games.length == 1
            ? 'L-Semifinal'
            : 'L-Round ${i + 1}',
        rounds[i].games,
      ),
  ];
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
  return 'Winner ${_bracketRoundCode(sourceLabel)}-$matchNumber';
}

String _matchLoser(MatchSeed? match, String sourceLabel, int matchNumber) {
  if (match == null) {
    return 'Loser ${_bracketRoundCode(sourceLabel)}-$matchNumber';
  }
  if (match.result == '0-1') return match.white;
  if (match.result == '1-0') return match.black;
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
    MatchSeed('Ibrahim Ahmad', 'Zaid Hamdan', '1-0'),
    MatchSeed('Sara Nasser', 'Hasan Qasem', '1-0'),
    MatchSeed('Leen Haddad', 'Noor Barakat', '1-0'),
    MatchSeed('Yazan Khaled', 'Khaled Mansour', '1-0'),
    MatchSeed('Omar Saleh', 'Tala Suleiman', '1-0'),
    MatchSeed('Mohammad Al-Khatib', 'Rania Odeh', '1-0'),
    MatchSeed('Amr Zaidan', 'Lina Shami', '1-0'),
    MatchSeed('Dana Aqel', 'Fadi Rimawi', '1-0'),
  ]),
  RoundSeed('W-Quarterfinal', [
    MatchSeed('Ibrahim Ahmad', 'Sara Nasser', '1-0'),
    MatchSeed('Leen Haddad', 'Yazan Khaled', '1-0'),
    MatchSeed('Omar Saleh', 'Mohammad Al-Khatib', '1-0'),
    MatchSeed('Dana Aqel', 'Amr Zaidan', '1-0'),
  ]),
  RoundSeed('W-Semifinal', [
    MatchSeed('Ibrahim Ahmad', 'Leen Haddad', '1-0'),
    MatchSeed('Omar Saleh', 'Dana Aqel', '1-0'),
  ]),
  RoundSeed('W-Final', [MatchSeed('Ibrahim Ahmad', 'Omar Saleh', '1-0')]),
];

const doubleEliminationLosersRounds = [
  RoundSeed('L-Round 1', [
    MatchSeed('Zaid Hamdan', 'Hasan Qasem', '1-0', nextIndex: 0),
    MatchSeed('Noor Barakat', 'Khaled Mansour', '1-0', nextIndex: 1),
    MatchSeed('Tala Suleiman', 'Rania Odeh', '1-0', nextIndex: 2),
    MatchSeed('Lina Shami', 'Fadi Rimawi', '1-0', nextIndex: 3),
  ]),
  RoundSeed('L-Round 2', [
    MatchSeed('Sara Nasser', 'Zaid Hamdan', '1-0'),
    MatchSeed('Yazan Khaled', 'Noor Barakat', '1-0'),
    MatchSeed('Mohammad Al-Khatib', 'Tala Suleiman', '1-0'),
    MatchSeed('Amr Zaidan', 'Lina Shami', '1-0'),
  ]),
  RoundSeed('L-Round 3', [
    MatchSeed('Sara Nasser', 'Yazan Khaled', '1-0', nextIndex: 0),
    MatchSeed('Mohammad Al-Khatib', 'Amr Zaidan', '1-0', nextIndex: 1),
  ]),
  RoundSeed('L-Round 4', [
    MatchSeed('Leen Haddad', 'Sara Nasser', '0-1'),
    MatchSeed('Dana Aqel', 'Mohammad Al-Khatib', '0-1'),
  ]),
  RoundSeed('L-Semifinal', [
    MatchSeed('Sara Nasser', 'Mohammad Al-Khatib', '1-0'),
  ]),
  RoundSeed('L-Final', [MatchSeed('Omar Saleh', 'Sara Nasser', 'live')]),
];

const doubleEliminationFinalRounds = [
  RoundSeed('Grand Final', [MatchSeed('Ibrahim Ahmad', 'Winner L-Final', '-')]),
  RoundSeed('Reset if needed', [
    MatchSeed('Winner Grand Final', 'Reset only if needed', '-'),
  ]),
];

const savedAnalyses = [
  SavedAnalysisSeed("King's Indian prep vs Omar", '32 moves · Jun 25'),
  SavedAnalysisSeed('Rapid round 2 endgame', '18 moves · Jun 28'),
];
