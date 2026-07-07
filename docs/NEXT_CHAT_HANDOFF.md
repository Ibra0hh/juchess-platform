# JuChess Next Chat Handoff

Read this file first when continuing the JuChess project in a new Codex chat.

## Core Rule

The prototypes are the design source of truth. Do not invent a new UI.

Locked prototype references:

- `docs/prototypes/web`
- `docs/prototypes/mobile`
- `docs/prototypes/admin`

The real apps must preserve the prototype layout, colors, labels, navigation,
cards, buttons, density, and behavior. Appwrite is the backend underneath the
same UI, not a reason to redesign the product.

## Repo And Git

- Repo path on this machine: `C:\Users\ibra_\Downloads\juchess-platform`
- GitHub repo: `Ibra0hh/juchess-platform`
- Current main branch is pushed.
- GitHub Pages output is built from the real React apps into `docs/web` and
  `docs/admin`. Prototype references remain under `docs/prototypes`.
- Public website: `https://ibra0hh.github.io/juchess-platform/web/`
- Admin website: `https://ibra0hh.github.io/juchess-platform/admin/`
- Root URL redirects to the public website:
  `https://ibra0hh.github.io/juchess-platform/`

Recent important commits:

- `cf3ffc5 Make tournament creation draft-only`
- `5439bf7 Fix GitHub Pages links`
- `8495ecb Update admin tournament status workflow`
- `2270110 Add stage tabs to tournament rounds`
- `649ba09 Match web tournament tabs to mobile`
- `2e22d72 Add mobile splash animation and logo icon`
- `f5e0e5f Refine mobile bracket connectors`
- `252e610 Add mobile bracket connector lines`
- `40d7f0d Fix mobile tournament bracket UI`
- `b8c604c Fix mobile tournament registration tab`
- `e0559f3 Port mobile prototype screens to Flutter`
- `7656b9a Make mobile tournaments open real details`
- `23ca78e Make tournaments cloud-backed across apps`

## App Structure

- `apps/web`: public React + TypeScript + Vite app.
- `apps/admin`: admin React + TypeScript + Vite app.
- `apps/mobile`: Flutter mobile/tablet app.
- `appwrite`: Appwrite schema and Functions.
- `docs/appwrite-schema.md`: backend contract.
- `docs/prototype-screen-checklist.md`: screen acceptance checklist.
- `graphify-out/GRAPH_REPORT.md`: generated codebase graph report if a future
  chat needs architecture exploration.

## Backend Boundary

Appwrite project:

- Endpoint: `https://cloud.appwrite.io/v1`
- Project ID: `juchess-platform`
- Database ID: `juchess`
- Public access guard Function ID: `access-guards`
- Admin Function ID: `admin-actions`

Important tables:

- Player-facing: `profiles`, `tournaments`, `registrations`, `games`,
  `standings`, `announcements`
- Admin-facing: `admin_profiles`, `admin_audit`, `identity_blocks`, `ip_blocks`

Important security rule:

- Admin app identity is separate from player identity.
- Admin app uses `admin_profiles` plus admin-only teams:
  `admin_super_admins` and `admin_staff`.
- Admin-only mutations go through Appwrite Functions, not frontend secrets.
- Web/mobile sign-in/sign-up call `access-guards` so blocked email,
  University ID, phone, and IP values are rejected.

## Current Working State

Implemented/working:

- Appwrite wrappers exist for web, admin, and Flutter.
- Web sign-in, sign-up, password recovery, tournament reads, and profile session
  state are wired with prototype fallback data.
- Admin app has separated admin access through `admin_profiles`.
- Admin can manage identity/IP blocks through server Functions.
- Admin tournament list tabs must be:
  Draft, Upcoming, Active, Completed, Archived.
- Admin create tournament is intentionally enabled only on the Draft tab.
- Admin create tournament currently saves every new tournament as `draft`.
- Admin create tournament should have only three steps:
  Basic information, Tournament format, Time control.
- Admin create tournament should not show Preview or Review steps.
- Admin create tournament Basic information step must stay simple:
  tournament name, description, number of players, typed location/platform,
  start date/time, registration deadline, and tournament design image placeholder.
- Admin create tournament Basic information step must not show:
  end date/time, Chess.com/Lichess.com/Main Campus chips, visibility controls,
  or access controls.
- Admin Tournaments includes an inline Tournament management panel below the
  tournament table. It edits the selected cloud tournament through
  `updateTournament` using the same admin table/panel visual style.
- Flutter app has Appwrite session detection, sign-in, sign-up, sign-out,
  tournament reads, tournament details, registration/cancel behavior, and
  prototype-style mobile screens.
- Mobile orientation is locked to portrait on phone; tablets can rotate.
- Mobile tournament Registration tab was corrected to show only the register or
  cancel action, matching the latest prototype request.
- Mobile tournament Bracket tab now uses prototype-style columns with:
  round chips, winner checkmarks, faded eliminated/TBD rows, live strips, and
  web-style bracket connector lines.
- Mobile splash now uses the JuChess logo, grid wash, warm glow, and falling
  chess pieces inspired by the web homepage.
- Android native launch screen and launcher icon use the club logo.
- Bottom Home tab in the Flutter app uses the club logo.

Tournament detail tab rules:

- Public website and Flutter mobile should match.
- Tournament detail tabs should be:
  Registration, Players, Rounds, Games, Standings.
- Single elimination and double elimination use bracket-style Rounds content.
- Swiss, Arena, League, Round robin, and similar formats keep the same top tabs
  but change the content inside Rounds/Games/Standings as appropriate.
- Multi-stage Rounds content should include a small inner nav with:
  Stage one and Stage two.

Most recent phone verification:

- Device used: `SM A346E`, adb id `RZCW30XCC4Z`
- Installed with `flutter run -d RZCW30XCC4Z ...`
- Verified splash, Home tab logo, and mobile bracket visually by screenshots.

## Commands

From repo root:

```powershell
npm install
npm run dev:web
npm run dev:admin
npm run build:web
npm run build:admin
npm run build:pages
npm run mobile:analyze
npm run mobile:test
```

Build and publish GitHub Pages after web/admin React changes:

```powershell
npm run build:pages
git status --short
git add apps/web apps/admin docs
git commit -m "<message>"
git push origin main
```

Run Flutter mobile with Appwrite config:

```powershell
cd apps/mobile
flutter run `
  --dart-define=APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 `
  --dart-define=APPWRITE_PROJECT_ID=juchess-platform `
  --dart-define=APPWRITE_DATABASE_ID=juchess `
  --dart-define=APPWRITE_ACCESS_GUARD_FUNCTION_ID=access-guards `
  --dart-define=APPWRITE_RECOVERY_URL=https://juchess.ju.edu.jo/reset-password
```

Run on a specific Android device or emulator:

```powershell
flutter devices
flutter run -d <DEVICE_ID> `
  --dart-define=APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 `
  --dart-define=APPWRITE_PROJECT_ID=juchess-platform `
  --dart-define=APPWRITE_DATABASE_ID=juchess `
  --dart-define=APPWRITE_ACCESS_GUARD_FUNCTION_ID=access-guards `
  --dart-define=APPWRITE_RECOVERY_URL=https://juchess.ju.edu.jo/reset-password
```

Take an Android screenshot:

```powershell
adb exec-out screencap -p > C:\Users\ibra_\AppData\Local\Temp\juchess-screen.png
```

Dump Android UI tree:

```powershell
adb shell uiautomator dump /sdcard/juchess.xml
adb pull /sdcard/juchess.xml C:\Users\ibra_\AppData\Local\Temp\juchess.xml
```

## Android Studio Emulator Workflow

If the physical phone is not available, Codex can still test Flutter using an
Android Studio emulator, as long as the emulator is running on the same Windows
machine where Codex is running.

What the user should do before leaving:

1. Open Android Studio.
2. Open the project folder if useful:
   `C:\Users\ibra_\Downloads\juchess-platform\apps\mobile`
   or the full repo folder:
   `C:\Users\ibra_\Downloads\juchess-platform`
3. Open Device Manager.
4. Create or start an Android Virtual Device.
   A Pixel phone profile is fine, for example Pixel 7 or Pixel 8.
5. Use an API level already installed on the machine, preferably API 35 or 36.
6. Keep the emulator running.
7. Keep Android Studio / emulator / Codex machine awake and reachable remotely.

What Codex can do after the emulator is running:

```powershell
adb devices
flutter devices
flutter run -d <EMULATOR_ID> ...
adb exec-out screencap -p > C:\Users\ibra_\AppData\Local\Temp\emulator.png
adb shell input tap <x> <y>
adb shell input swipe <x1> <y1> <x2> <y2> <durationMs>
```

Codex does not need the user to open a special folder in Android Studio to see
the emulator. The key requirement is that the Android emulator process is
running and visible to `adb devices` / `flutter devices`.

If no emulator appears:

```powershell
flutter doctor
adb kill-server
adb start-server
adb devices
```

If the Android SDK path is missing, Android Studio usually fixes it after
opening Settings > Languages & Frameworks > Android SDK and installing:

- Android SDK Platform
- Android SDK Platform-Tools
- Android Emulator
- Android SDK Command-line Tools

## Current Priorities / Next Work

Recommended next steps:

1. Preserve the latest admin create tournament contract above.
2. Continue Flutter mobile UI fidelity screen-by-screen from
   `docs/prototypes/mobile/JuChess.mobile.dc.html`.
3. Keep connecting real Appwrite data after each screen matches the prototype.
4. Continue porting web screens from prototype to real React:
   Home, Games, Leaderboard, Profile, Sign In, Sign Up, Forgot Password.
5. Continue improving admin app while preserving the admin prototype layout.
6. Build out real tournament management:
   participants, rounds, procedure, standings, games/results, announcements.
7. Add chess features later:
   PGN upload, review, analysis, move quality badges, then engine/Stockfish.

## Important User Preferences

- The user strongly wants exact prototype fidelity.
- Do not redesign unless explicitly asked.
- If the user says something is wrong visually, inspect the real screen or
  screenshot and fix the specific mismatch.
- When mobile work is changed, install it on the Android target and verify with
  screenshots when possible.
- Avoid showing Appwrite/cloud wording to end users inside the app. User-facing
  copy should say normal product phrases such as "No tournaments published yet."
- The user often asks to see screenshots in the Android emulator or hosted web.
  Inspect the real screen before saying a visual change is done.

## Known Verification Status

Latest verified commands on July 7, 2026:

```powershell
npm run build:admin
npm run lint:admin
npm run build:pages
```

Status:

- `npm run build:admin` passed.
- `npm run build:pages` passed and rebuilt `docs/web` plus `docs/admin`.
- `npm run lint:admin` passed with existing warnings in
  `apps/admin/public/prototype/support.js`.

Earlier mobile verification commands:

```powershell
npm run mobile:analyze
npm run mobile:test
```

Both passed after the mobile splash/logo work.

For web/admin, run before claiming a new change is complete:

```powershell
npm run build:web
npm run build:admin
```
