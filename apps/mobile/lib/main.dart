import 'dart:async';

import 'package:appwrite/appwrite.dart';
import 'package:appwrite/models.dart' as models;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

void main() {
  runApp(const JuChessApp());
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

  Future<models.User> signIn({
    required String email,
    required String password,
  }) async {
    await account.createEmailPasswordSession(email: email, password: password);
    return account.get();
  }

  Future<models.User> signUp({
    required String name,
    required String email,
    required String password,
    String? universityId,
  }) async {
    final user = await account.create(
      userId: ID.unique(),
      email: email,
      password: password,
      name: name,
    );

    await account.createEmailPasswordSession(email: email, password: password);
    await _createProfile(user, universityId: universityId);
    return account.get();
  }

  Future<void> signOut() async {
    await account.deleteSession(sessionId: 'current');
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

  Future<void> _createProfile(models.User user, {String? universityId}) async {
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
      name: name,
      meta: '${_formatDate(startsAt)} · $location',
      chips: [
        roundsTotal == null ? format : '$format · $roundsTotal rounds',
        timeControl,
        capacity == null ? '$players players' : '$players/$capacity players',
      ],
      current: _roundLabel(rawStatus, currentRound, roundsTotal),
      status: rawStatus,
    );
  }
}

class AppState extends ChangeNotifier {
  AppState(this.service) {
    unawaited(bootstrap());
  }

  final AppwriteService service;
  int tab = 0;
  bool authLoading = false;
  bool dataLoading = false;
  String tournamentFilter = 'active';
  String? userName;
  String? userEmail;
  String? error;
  List<TournamentSeed> tournamentItems = fallbackTournaments;

  bool get appwriteReady => service.ready;
  bool get signedIn => userEmail != null;

  List<TournamentSeed> get visibleTournaments {
    final filtered = tournamentItems
        .where((item) => item.status == tournamentFilter)
        .toList();
    return filtered.isEmpty ? tournamentItems : filtered;
  }

  TournamentSeed get featuredTournament {
    final active = tournamentItems.where((item) => item.status == 'active');
    if (active.isNotEmpty) return active.first;
    if (tournamentItems.isNotEmpty) return tournamentItems.first;
    return fallbackTournaments.first;
  }

  void selectTab(int value) {
    tab = value;
    notifyListeners();
  }

  void selectTournamentFilter(String value) {
    tournamentFilter = value;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    await Future.wait([loadCurrentUser(), loadTournaments()]);
  }

  Future<void> loadCurrentUser() async {
    if (!service.ready) return;

    try {
      final user = await service.currentUser();
      userName = user.name.isNotEmpty ? user.name : user.email;
      userEmail = user.email;
      error = null;
    } catch (_) {
      userName = null;
      userEmail = null;
    }

    notifyListeners();
  }

  Future<bool> signIn(String email, String password) async {
    if (!service.ready) {
      error = 'Appwrite is not configured yet.';
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
  ) async {
    if (!service.ready) {
      error = 'Appwrite is not configured yet.';
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

  Future<void> signOut() async {
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
      tournamentItems = fallbackTournaments;
      return;
    }

    dataLoading = true;
    notifyListeners();

    try {
      final loaded = await service.loadTournaments();
      tournamentItems = loaded.isEmpty ? fallbackTournaments : loaded;
      error = null;
    } catch (caught) {
      tournamentItems = fallbackTournaments;
      error = appwriteMessage(caught);
    } finally {
      dataLoading = false;
      notifyListeners();
    }
  }
}

String appwriteMessage(Object error) {
  if (error is AppwriteException && error.message != null) {
    return error.message!;
  }

  return error.toString();
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

class PrototypeShell extends StatelessWidget {
  const PrototypeShell({super.key});

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
          child: FeaturedTournamentCard(
            event: context.watch<AppState>().featuredTournament,
            onTap: () => context.read<AppState>().selectTab(1),
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
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const LeaderboardPreview(),
        SectionHeading(
          title: 'Upcoming',
          margin: const EdgeInsets.fromLTRB(16, 22, 16, 10),
        ),
        const UpcomingList(),
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
                      ? 'Registrations and analyses will sync with Appwrite'
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
        if (!state.appwriteReady)
          const AppNotice(
            text:
                'Appwrite is not configured yet. Showing prototype tournament data.',
          ),
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
    return PrototypeCard(
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
          Text(
            event.current,
            style: const TextStyle(
              color: PrototypeColors.burgundy,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
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

class UpcomingList extends StatelessWidget {
  const UpcomingList({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          UpcomingTile(
            'Masters Six · Double Round-Robin Invitational',
            'Sun, Jul 12 · 10:00 AM',
          ),
          SizedBox(height: 10),
          UpcomingTile('Autumn Swiss Open', 'Sat, Sep 19 · 3:00 PM'),
        ],
      ),
    );
  }
}

class UpcomingTile extends StatelessWidget {
  const UpcomingTile(this.title, this.subtitle, {super.key});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: cardDecoration(radius: 13),
      child: Row(
        children: [
          const Icon(
            Icons.calendar_month_outlined,
            color: PrototypeColors.burgundy,
          ),
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

void showAuthSheet(BuildContext context, {bool createAccount = false}) {
  final formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  final universityController = TextEditingController();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  var signup = createAccount;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: PrototypeColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
    ),
    builder: (sheetContext) {
      return StatefulBuilder(
        builder: (modalContext, setModalState) {
          final state = modalContext.watch<AppState>();

          return SafeArea(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                18,
                18,
                18,
                MediaQuery.of(modalContext).viewInsets.bottom + 18,
              ),
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SerifText(
                      signup ? 'Create account' : 'Sign in',
                      size: 24,
                      weight: FontWeight.w700,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      signup
                          ? 'Create your club profile to register for tournaments.'
                          : 'Use your JuChess Appwrite account.',
                      style: const TextStyle(
                        color: Color(0x9921304e),
                        fontSize: 12.5,
                      ),
                    ),
                    if (!state.appwriteReady) ...[
                      const SizedBox(height: 12),
                      const Text(
                        'Appwrite is not configured yet.',
                        style: TextStyle(
                          color: PrototypeColors.burgundy,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (signup) ...[
                      AuthField(
                        controller: nameController,
                        label: 'Full name',
                        validator: requiredValue,
                      ),
                      const SizedBox(height: 10),
                      AuthField(
                        controller: universityController,
                        label: 'University ID',
                      ),
                      const SizedBox(height: 10),
                    ],
                    AuthField(
                      controller: emailController,
                      label: 'Email',
                      keyboardType: TextInputType.emailAddress,
                      validator: requiredValue,
                    ),
                    const SizedBox(height: 10),
                    AuthField(
                      controller: passwordController,
                      label: 'Password',
                      obscureText: true,
                      validator: passwordValue,
                    ),
                    if (state.error != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        state.error!,
                        style: const TextStyle(
                          color: PrototypeColors.burgundy,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    PrototypeButton(
                      label: state.authLoading
                          ? 'Working...'
                          : signup
                          ? 'Create account'
                          : 'Sign in',
                      onTap: state.authLoading || !state.appwriteReady
                          ? () {}
                          : () async {
                              if (!(formKey.currentState?.validate() ??
                                  false)) {
                                return;
                              }

                              final appState = modalContext.read<AppState>();
                              final success = signup
                                  ? await appState.signUp(
                                      nameController.text.trim(),
                                      emailController.text.trim(),
                                      passwordController.text,
                                      universityController.text.trim(),
                                    )
                                  : await appState.signIn(
                                      emailController.text.trim(),
                                      passwordController.text,
                                    );

                              if (success && modalContext.mounted) {
                                Navigator.of(modalContext).pop();
                              }
                            },
                    ),
                    TextButton(
                      onPressed: () => setModalState(() => signup = !signup),
                      child: Text(
                        signup
                            ? 'Do you have an account? Sign in'
                            : 'New to the club? Sign up',
                        style: const TextStyle(
                          color: PrototypeColors.burgundy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    },
  ).whenComplete(() {
    nameController.dispose();
    universityController.dispose();
    emailController.dispose();
    passwordController.dispose();
  });
}

class AuthField extends StatelessWidget {
  const AuthField({
    required this.controller,
    required this.label,
    this.keyboardType,
    this.obscureText = false,
    this.validator,
    super.key,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final bool obscureText;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: Color(0x9921304e)),
        filled: true,
        fillColor: const Color(0xfffffaf0),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(11),
          borderSide: const BorderSide(color: Color(0x2421304e)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(11),
          borderSide: const BorderSide(color: PrototypeColors.burgundy),
        ),
      ),
    );
  }
}

String? requiredValue(String? value) {
  if (value == null || value.trim().isEmpty) return 'Required';
  return null;
}

String? passwordValue(String? value) {
  if (value == null || value.length < 8) return 'Use at least 8 characters';
  return null;
}

class TournamentSeed {
  const TournamentSeed({
    required this.name,
    required this.meta,
    required this.chips,
    required this.current,
    this.status = 'active',
  });

  final String name;
  final String meta;
  final List<String> chips;
  final String current;
  final String status;
}

class PlayerSeed {
  const PlayerSeed(this.rank, this.name, this.rating);

  final int rank;
  final String name;
  final int rating;
}

const fallbackTournaments = [
  TournamentSeed(
    name: 'University of Jordan Rapid Championship',
    meta: 'Sat, Jul 4 · 4:00 PM · Main Campus · Hall B',
    chips: ['Swiss · 7 rounds', '15+10 Rapid', '12/16 players'],
    current: 'Round 4 of 7',
  ),
  TournamentSeed(
    name: 'JU Blitz Knockout Cup',
    meta: 'Thu, Jul 2 · 6:00 PM · Student Union · Room 12',
    chips: ['Single elimination', '3+2 Blitz', '16 players'],
    current: 'Semifinal',
  ),
  TournamentSeed(
    name: 'Summer Bullet Arena',
    meta: 'Today · 8:00 PM · Online · Club server',
    chips: ['Arena · 60 min', '1+0 Bullet', '10 players'],
    current: 'In progress',
  ),
  TournamentSeed(
    name: 'Amman Universities Team Battle',
    meta: 'Jul 1 – Jul 8 · 5:00 PM · JU Sports Complex · Hall 2',
    chips: ['Team · 4 boards', '10+0 Rapid', '4 teams'],
    current: 'Match Day 2 of 3',
  ),
  TournamentSeed(
    name: 'Masters Six Invitational',
    meta: 'Sun, Jul 12 · 10:00 AM · Library Seminar Room',
    chips: ['Double round-robin', '25+10 Classical', '6 players'],
    current: 'Registration',
    status: 'upcoming',
  ),
];

const players = [
  PlayerSeed(1, 'Ibrahim Ahmad', 1810),
  PlayerSeed(2, 'Omar Saleh', 1740),
  PlayerSeed(3, 'Leen Haddad', 1685),
  PlayerSeed(4, 'Yazan Khaled', 1602),
];
