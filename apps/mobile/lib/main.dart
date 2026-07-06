import 'dart:async';
import 'dart:convert';

import 'package:appwrite/appwrite.dart';
import 'package:appwrite/enums.dart' as enums;
import 'package:appwrite/models.dart' as models;
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
      final data = response.rows.first.data;
      return {
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
      final data = response.rows.first.data;
      return {
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
        response.rows
            .map((row) => _mapTournament(row, counts))
            .whereType<TournamentSeed>()
            .toList()
          ..sort((a, b) {
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
    final name = data['name']?.toString();
    final format = data['format']?.toString();
    final timeControl = data['timeControl']?.toString();
    final rawStatus = data['status']?.toString() ?? 'upcoming';

    if (name == null || format == null || timeControl == null) return null;
    if (rawStatus == 'draft' || rawStatus == 'cancelled') return null;

    final roundsTotal = _asInt(data['roundsTotal']);
    final currentRound = _asInt(data['currentRound']);
    final capacity = _asInt(data['capacity']);
    final players = counts[row.$id] ?? 0;
    final location = data['location']?.toString() ?? 'University of Jordan';
    final startsAt = data['startsAt']?.toString();

    return TournamentSeed(
      id: data['slug']?.toString() ?? row.$id,
      name: name,
      meta: '${_formatDate(startsAt)} · $location',
      chips: [
        roundsTotal == null ? format : '$format · $roundsTotal rounds',
        timeControl,
        capacity == null ? '$players players' : '$players/$capacity players',
      ],
      current: _roundLabel(rawStatus, currentRound, roundsTotal),
      format: format,
      timeControl: timeControl,
      players: players,
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
  String? error;
  List<TournamentSeed> tournamentItems = const [];

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
        if (displayName != null && displayName.isNotEmpty) {
          userName = displayName;
        }
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
      userName = displayName != null && displayName.isNotEmpty
          ? displayName
          : user.name.isNotEmpty
          ? user.name
          : user.email;
      userEmail = user.email;
      error = null;
    } catch (caught) {
      if (service.ready) {
        try {
          await service.signOut();
        } catch (_) {}
      }
      userName = null;
      userEmail = null;
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
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
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
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
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
    notifyListeners();
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
        home: const PrototypeShell(),
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
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(
                    Icons.home,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.emoji_events_outlined),
                  selectedIcon: Icon(
                    Icons.emoji_events,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Tournaments',
                ),
                NavigationDestination(
                  icon: Icon(Icons.grid_view_outlined),
                  selectedIcon: Icon(
                    Icons.grid_view,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Games',
                ),
                NavigationDestination(
                  icon: Icon(Icons.tune),
                  selectedIcon: Icon(
                    Icons.tune,
                    color: PrototypeColors.burgundy,
                  ),
                  label: 'Tools',
                ),
                NavigationDestination(
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
          title: 'News',
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const NewsList(),
        SectionHeading(
          title: 'Club leaderboard',
          action: 'View all',
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const LeaderboardPreview(),
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
    const actions = [
      ('♞', 'Game Review'),
      ('♟', 'Analysis Board'),
      ('5:00', 'Chess Clock'),
      ('♛', 'Leaderboard'),
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
              (item) => Container(
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

class TournamentDetailScreen extends StatelessWidget {
  const TournamentDetailScreen({required this.event, super.key});

  final TournamentSeed event;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PrototypeColors.screen,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.arrow_back),
                        color: PrototypeColors.navy,
                        tooltip: 'Back',
                      ),
                      const SizedBox(width: 4),
                      const Expanded(
                        child: SerifText(
                          'Tournament',
                          size: 21,
                          weight: FontWeight.w700,
                        ),
                      ),
                      if (event.status == 'active')
                        const LivePill(small: true)
                      else
                        StatusPill(event.status),
                    ],
                  ),
                  const SizedBox(height: 12),
                  PrototypeCard(
                    margin: EdgeInsets.zero,
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 17),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SerifText(
                          event.name,
                          size: 23,
                          weight: FontWeight.w700,
                          height: 1.12,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          event.meta,
                          style: const TextStyle(
                            color: Color(0x9921304e),
                            fontSize: 12.8,
                          ),
                        ),
                        const SizedBox(height: 13),
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
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  GridView.count(
                    crossAxisCount: 2,
                    childAspectRatio: 1.42,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    physics: const NeverScrollableScrollPhysics(),
                    shrinkWrap: true,
                    children: [
                      TournamentInfoTile(
                        label: 'Format',
                        value: event.format,
                        icon: Icons.account_tree_outlined,
                      ),
                      TournamentInfoTile(
                        label: 'Time control',
                        value: event.timeControl,
                        icon: Icons.timer_outlined,
                      ),
                      TournamentInfoTile(
                        label: 'Players',
                        value: event.playerLabel,
                        icon: Icons.groups_outlined,
                      ),
                      TournamentInfoTile(
                        label: 'Location',
                        value: event.location,
                        icon: Icons.place_outlined,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  PrototypeCard(
                    margin: EdgeInsets.zero,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SerifText(
                          'Details',
                          size: 18,
                          weight: FontWeight.w700,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          event.description,
                          style: const TextStyle(
                            color: Color(0xcc21304e),
                            fontSize: 13,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  PrototypeCard(
                    margin: EdgeInsets.zero,
                    child: Column(
                      children: [
                        TournamentStep(
                          label: 'Participants',
                          value: event.playerLabel,
                          done: event.players > 0,
                        ),
                        const TournamentDivider(),
                        TournamentStep(
                          label: 'Rounds',
                          value: event.roundsLabel,
                          done: event.currentRound != null,
                        ),
                        const TournamentDivider(),
                        TournamentStep(
                          label: 'Standings',
                          value: event.status == 'completed'
                              ? 'Final standings'
                              : 'Updates during play',
                          done: event.status != 'upcoming',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  PrototypeButton(
                    label: event.status == 'upcoming'
                        ? 'Register'
                        : event.status == 'completed'
                        ? 'View standings'
                        : 'Open live tournament',
                    onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('${event.name} is open.')),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
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
    return const AppScroll(
      children: [
        PrototypeHeader(title: 'Games'),
        SizedBox(height: 16),
        BigActionCard(
          title: 'Game Review',
          subtitle: 'Review recent tournament games',
          icon: '♞',
          filled: true,
        ),
        BigActionCard(
          title: 'New Analysis',
          subtitle: 'Set up a board and record lines',
          icon: '♝',
        ),
      ],
    );
  }
}

class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AppScroll(
      children: [
        PrototypeHeader(title: 'Tools'),
        SizedBox(height: 16),
        ToolTile(
          title: 'Chess Clock',
          subtitle: 'Run over-the-board time controls',
          icon: '5:00',
        ),
        ToolTile(
          title: 'Saved Analyses',
          subtitle: 'Open lines saved to your profile',
          icon: '♜',
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
    this.filled = false,
    super.key,
  });

  final String title;
  final String subtitle;
  final String icon;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
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
          ],
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
    super.key,
  });

  final String title;
  final String subtitle;
  final String icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
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
        children: players
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
                      child: Text(
                        player.name,
                        style: const TextStyle(fontWeight: FontWeight.w700),
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
          NewsTile(
            'Rapid Championship round 4 is live',
            'Main Campus · Hall B',
          ),
          SizedBox(height: 10),
          NewsTile(
            'Masters Six registration opens soon',
            'Round-robin invitational · 6 players',
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
    this.margin = EdgeInsets.zero,
    super.key,
  });

  final String title;
  final String? action;
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
            Text(
              action!,
              style: const TextStyle(
                color: PrototypeColors.burgundy,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
        ],
      ),
    );
  }
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
      const SnackBar(content: Text('Social sign-in is not configured yet.')),
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
  const PlayerSeed(this.rank, this.name, this.rating);

  final int rank;
  final String name;
  final int rating;
}

const players = [
  PlayerSeed(1, 'Ibrahim Ahmad', 1810),
  PlayerSeed(2, 'Omar Saleh', 1740),
  PlayerSeed(3, 'Leen Haddad', 1685),
  PlayerSeed(4, 'Yazan Khaled', 1602),
];
