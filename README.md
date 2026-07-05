# JuChess Platform

Real JuChess application workspace.

## Apps

- `apps/web`: public web app, React + TypeScript + Vite.
- `apps/admin`: admin operations app, React + TypeScript + Vite.
- `apps/mobile`: Flutter app for iPhone, Android, and tablet layouts.
- `appwrite`: Appwrite CLI config and the first server Function.
- `docs/appwrite-schema.md`: shared backend contract.
- `docs/prototype-screen-checklist.md`: locked implementation checklist for
  web, admin, mobile, and tablet screens.
- `appwrite/schema.json`: machine-readable Appwrite table/function contract.

## Product Rule

The existing JuChess prototypes are the visual and workflow source of truth.

Do not invent a new app UI. The real web, admin, and Flutter apps must port the
prototype screens faithfully: same navigation, colors, density, labels, cards,
buttons, screen names, and behavior. Appwrite is the backend layer underneath
that UI, not a reason to redesign the product.

## Local Commands

Install web dependencies:

```bash
npm install
```

Run web app:

```bash
npm run dev:web
```

Run admin app:

```bash
npm run dev:admin
```

Run Flutter app:

```bash
cd apps/mobile
flutter run
```

Run Flutter with Appwrite config:

```bash
flutter run \
  --dart-define=APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
  --dart-define=APPWRITE_PROJECT_ID=YOUR_PROJECT_ID \
  --dart-define=APPWRITE_DATABASE_ID=juchess
```

## Appwrite Setup

The CLI is installed on this machine.

Next steps after you provide/login to an Appwrite account:

```bash
appwrite login
appwrite init project
```

Then update:

- `appwrite.config.json`
- `apps/web/.env` from `apps/web/.env.example`
- `apps/admin/.env` from `apps/admin/.env.example`
- Flutter `--dart-define` values

Admin-only mutations must go through Appwrite Functions, not browser API keys.

## Current Implementation Slice

- Web sign-in, sign-up, password recovery, tournament reads, and profile
  session state are wired to Appwrite with prototype fallback data.
- Admin sign-in, admin/organizer role guard, tournament reads, and tournament
  creation are wired to Appwrite. Writes go through the `admin-actions`
  Function.
- Flutter has Appwrite config, session detection, sign-in, sign-up, sign-out,
  and tournament reads while preserving the prototype visual structure.
- The `admin-actions` Function has concrete admin mutation routes for
  tournaments, registrations, games, profiles, and announcements.
- The prototype checklist is the acceptance source for each future screen port.
