# JuChess project structure

JuChess is the University of Jordan Chess Club platform. Its public website,
admin control center, and Flutter app use one Appwrite project. This map shows
the maintained source and release paths; it groups dependencies, binary assets,
and generated bundles rather than enumerating each file.

## Repository map

```text
juchess-platform/
├── apps/
│   ├── web/                         React + TypeScript + Vite public site
│   │   ├── index.html               HTML shell, metadata, and loading view
│   │   ├── vite.config.ts           Dev, root Pages, and legacy /web builds
│   │   ├── src/
│   │   │   ├── main.tsx, App.tsx    Mount, router, providers, lazy routes
│   │   │   ├── screens/             Home, tournaments, auth, tools, profile, recruitment
│   │   │   ├── components/          Header/footer, chessboard, loaders, route guards
│   │   │   ├── context/             Account/session and hosted-play state
│   │   │   ├── hooks/               Shared UI and data lifecycle hooks
│   │   │   ├── lib/                 Appwrite adapters and feature helpers/tests
│   │   │   └── assets/              Assets imported into the Vite build
│   │   └── public/                  Static assets, PWA manifest, SEO, prototypes
│   │       ├── brand/, email/       Generated icon and email logo renditions
│   │       ├── palette/             Standalone brand guideline, fonts, design tokens
│   │       └── prototype/           Browser-renderable design references
│   ├── admin/                       React + TypeScript + Vite control center
│   │   ├── index.html, vite.config.ts
│   │   ├── src/
│   │   │   ├── main.tsx, App.tsx    Mount, admin session, navigation, tournament/player UI
│   │   │   ├── screens/             Recruitment, news, and announcements
│   │   │   ├── components/          Chessboard and shared branded email preview
│   │   │   ├── lib/                 Admin actions, permissions, refresh, wizard, CSV/email
│   │   │   └── assets/              Imported interface assets
│   │   ├── public/                  Admin logo, launcher/bookmark icons, prototype
│   │   └── test/                    Permissions, wizard, session, and utility tests
│   └── mobile/                      Flutter/Dart phone and tablet app
│       ├── lib/
│       │   ├── main.dart            AppwriteService, AppState, navigation, main screens
│       │   ├── game_review_core.dart
│       │   ├── game_review_stockfish.dart
│       │   └── stored_moves.dart
│       ├── assets/                  Logo, chess pieces, provider images
│       ├── test/                    Dart unit and widget tests
│       ├── android/, ios/            Native app IDs, signing config, icons, launch screens
│       ├── web/                     Flutter browser preview shell and icons
│       ├── linux/, macos/, windows/ Desktop runner scaffolds
│       └── pubspec.yaml, pubspec.lock
├── appwrite.config.json             CLI project binding; public identifiers only
├── appwrite/
│   ├── schema.json                  Tables, permissions, indexes, storage contract
│   ├── functions.json               Function IDs, runtimes, scopes, schedule
│   ├── functions/
│   │   ├── admin-actions/           Admin operations and authoritative tournament play
│   │   ├── player-actions/          Owner profile, registration, attendance, applications
│   │   ├── verification-actions/    Verification and password recovery
│   │   ├── access-guards/           Sign-in/signup identity and IP checks
│   │   └── attendance-actions/      Public, token-scoped attendance link actions
│   └── email-templates/             Native Appwrite Auth verification/recovery HTML
├── branding/
│   └── juchess-rook-mark.png        Master transparent Canva rook-and-clock artwork
├── scripts/
│   ├── sync-brand-assets.ps1         Rebuild/verify logo renditions from the master
│   ├── build-pages.mjs              Build both Vite clients and static route entrypoints
│   ├── export-palette.mjs           Export JSON and CSS color tokens
│   ├── test-palette.mjs             Validate tokens, clipboard, and deployed-copy parity
│   ├── validate-email-templates.mjs Validate HTML, layout markers, and link/code content
│   ├── migrate-*.ps1                Additive Appwrite schema/index migrations
│   ├── seed-*                      Explicit Appwrite test/demo data operations
│   └── generate-opening-book.mjs    Generate opening-book data
├── docs/
│   ├── PROJECT_STRUCTURE.md        This source and deployment map
│   ├── SYSTEM_ARCHITECTURE.md       Design diagrams, authority, and lifecycle contracts
│   ├── NEXT_CHAT_HANDOFF.md         Project history and implementation context
│   ├── appwrite-schema.md          Human-readable backend reference
│   ├── prototype-screen-checklist.md
│   ├── prototypes/                  Original web, mobile, and admin design references
│   ├── index.html, 404.html         Generated custom-domain app entry/fallback
│   ├── <route>/index.html           Generated static entry for direct route navigation
│   ├── web/, admin/                 Generated Vite clients and retained hashed bundles
│   ├── brand/, email/, palette/     Published copies of source assets
│   └── CNAME, .nojekyll             GitHub Pages hosting configuration
├── graphify-out/                    Repository index; may lag current source
├── .env.example                     Public client configuration example
├── package.json, package-lock.json  npm workspaces, checks, and deploy scripts
└── README.md, THIRD_PARTY_*.md      Entry point and third-party notices
```

## Where to make a change

| Feature | Main client files | Server/data boundary |
| --- | --- | --- |
| Account access and profile completion | `apps/web/src/lib/auth.ts`, `context/AuthContext.tsx`, `screens/AuthPage.tsx`, `OAuthCallbackPage.tsx`, `CompleteProfilePage.tsx`; Flutter `main.dart` | Appwrite Account, `access-guards`, `player-actions`; public `profiles` separate from `profile_private` |
| Verification and recovery | `screens/VerifyEmailPage.tsx`, `ForgotPasswordPage.tsx`, `lib/emailVerification.ts`, `passwordRecovery.ts`; Flutter account flow | `verification-actions/src/main.js`, `passwordRecovery.js`, private challenge tables, Appwrite Messaging |
| Public tournament pages | `apps/web/src/screens/TournamentsPage.tsx`, `TournamentDetailPage.tsx`, `lib/juchess.ts`; Flutter tournament screens | Published tournament, registration, game, bracket, and standing rows |
| Tournament admin | `apps/admin/src/App.tsx`, `lib/adminData.ts`, `lib/tournamentWizard.ts` | `admin-actions` validates lifecycle, publication, procedure, results, and standings |
| Hosted games | Web `OnlineGamesPage.tsx`, `lib/onlineTournament.ts`, `context/TournamentPlayProvider.tsx`; Flutter game UI | `admin-actions` owns legal moves, clocks, PGN, results, and standings; Appwrite Realtime invalidates client reads |
| Board and offline analysis | Web/admin `components/JuChessBoard.tsx`; web `GamesPage.tsx`, `lib/gameReview.ts`, `externalGames.ts`; mobile `game_review_*.dart` | Client chess libraries and Stockfish; analysis is separate from competitive play |
| Attendance | Web `AttendanceConfirmPage.tsx`, `lib/attendance.ts`; admin tournament controls; Flutter | `player-actions`, `attendance-actions`, scheduled `admin-actions`, and `attendance_confirmations` |
| Working-team applications | Web `RecruitmentPage.tsx`, `lib/recruitment.ts`; admin `RecruitmentScreen.tsx` | `crew_applications` via `player-actions`; private `crew_application_reviews` via `admin-actions` |
| News, announcements, player email | Admin `screens/CommunicationsScreen.tsx`, `components/BrandedEmailPreview.tsx`, `lib/announcementEmail.ts`, `lib/playerEmail.ts`; public Home/News | `admin-actions`, `announcements`, private recipient identity, Appwrite Messaging |
| Access and moderation | Admin `App.tsx`, `lib/adminPermissions.ts`, `lib/adminJwt.ts` | `admin_profiles` and confirmed admin-team memberships; server checks permissions and writes audit records |

Web paths in the table are relative to `apps/web/src/` unless fully qualified;
admin paths are relative to `apps/admin/src/`. Flutter screen/state code lives
in `apps/mobile/lib/main.dart`. Each Function deploys from its own directory
with a `src/main.js` entrypoint, package manifest, lockfile, and `test/` suite.

## How the pieces connect

```text
Public website ─┐
Flutter app ────┼── Appwrite Account, TablesDB, Storage, and Realtime
Admin panel ────┘           │
                            ├── Functions validate permissions and canonical writes
                            ├── juchess database persists player/tournament state
                            └── Messaging delivers branded transactional/admin emails
```

- **Shared environment:** `https://cloud.appwrite.io/v1`, project
  `juchess-platform`, database `juchess`. Web/admin use public `VITE_APPWRITE_*`
  settings; Flutter uses public `--dart-define=APPWRITE_…` settings.
- **Private identities:** clients never embed server keys. Verified account
  sessions and owner/admin Functions protect contact details; player profile
  roles do not authorize admin access.
- **Tournament authority:** published pairings, brackets, clocks, moves, results,
  and standings come from Appwrite. Clients render and refresh that state.
- **Media:** profile files are in `avatars`; tournament photos/videos are in
  `tournament-assets`. Brand assets are static and ship with each client.
- **Compatibility:** `/web/` remains a legacy public build, `/admin/` is its
  own build, and custom-domain routes use the root router. Do not edit generated
  Pages files by hand or discard older hashed bundles.

## Brand assets

The logo master is the visible rook-and-clock mark from page 1 of the
[Canva logo design](https://canva.link/rtuia6i0h16qtil). The department badges
and page background are separate artwork. The master PNG preserves the
artwork’s aspect ratio and transparency.

On Windows, update the master and regenerate the derived files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-brand-assets.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sync-brand-assets.ps1 -Check
```

- Web uses the compact burgundy mark on cream and the ivory mark on dark
  surfaces. `brand/` contains the favicon, touch icon, and mask-safe install
  icons; the 512 px rendition also supplies link-sharing metadata.
- Admin serves its local copy so dev and `/admin/` work without a root site.
- Flutter uses its bundled mark and per-platform launcher/splash images.
  The Flutter web and desktop runner icons are also derived from the master.
- New verification/recovery emails use the ivory mark, and admin-composed
  emails use burgundy. Keep `/email/juchess-email-logo.png` reachable because
  previously delivered messages and cached clients still reference it.
- The [mobile prototype](prototypes/mobile/JuChess.mobile.dc.html) is a
  separate interactive design reference with iPhone, Android, and Tablet
  previews; the shipped app comes from `apps/mobile/`.

## Development, validation, and releases

| Surface | Develop and verify | Release destination |
| --- | --- | --- |
| Public web | `npm install`, `npm run dev:web`, `npm run check:web` | [juchess.page](https://juchess.page/) and `/web/` |
| Admin | `npm run dev:admin`, `npm run check:admin` | [juchess.page/admin](https://juchess.page/admin/) |
| Flutter | `flutter pub get` in `apps/mobile`; `npm run mobile:analyze`, `npm run mobile:test` | Android APK/device, or signed Android/iOS distribution through the applicable store |
| Appwrite | `npm run check:functions`, `npm run test:functions`, `npm run check:email-templates` | Ready, active Appwrite deployments for changed Functions; native Auth templates are saved separately |

1. Build both web clients with `npm run build:pages`. Inspect source and
   generated files, commit the scoped change, and push `main`. GitHub Pages
   publishes `main:/docs`. Verify the custom domain, not just the build output.
2. If a Function changed, deploy that Function only with the authenticated
   Appwrite CLI. Wait for the deployment to be ready and active, then check a
   safe live route. Publish linked static assets before activating a Function
   that references their new URLs. No test email goes out without explicit
   recipient approval.
3. For native releases use the platform's build/signing workflow and verify a
   connected phone or emulator when available. The Android application ID is
   `edu.ju.chess.juchess_mobile`; the iOS bundle ID is
   `edu.ju.chess.juchessMobile`. Android can build a local sideload APK using the
   debug signing fallback; a store release needs the production signing setup.
   iOS archives require a macOS/Xcode signing environment. Pages does not deploy
   native app binaries.

For lifecycle diagrams and deeper invariants, see
[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md). Treat the current source and
live deployment configuration as authoritative when historical handoff notes
differ.
