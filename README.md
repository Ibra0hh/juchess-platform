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
  --dart-define=APPWRITE_PROJECT_ID=juchess-platform \
  --dart-define=APPWRITE_DATABASE_ID=juchess
```

## Appwrite Setup

The live Appwrite Cloud project is `juchess-platform` under the JuChess
organization account. Local web/admin env files should use:

```bash
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=juchess-platform
VITE_APPWRITE_DATABASE_ID=juchess
VITE_APPWRITE_ACCESS_GUARD_FUNCTION_ID=access-guards
```

The admin app also needs:

```bash
VITE_APPWRITE_ADMIN_FUNCTION_ID=admin-actions
```

Provisioned resources:

- Teams: `admin_super_admins`, `admin_staff`, `admins`, `organizers`, `members`.
  The admin app uses only `admin_super_admins` and `admin_staff` for access.
- Platforms: `localhost`, `127.0.0.1`, `ibra0hh.github.io`, Android
  `edu.ju.chess.juchess_mobile`, and iOS `edu.ju.chess.juchessMobile`.
- TablesDB database `juchess` with tables from `appwrite/schema.json`.
- Storage buckets: `avatars`, `tournament-assets`.
- Function: `admin-actions`, runtime `node-22`, deployed from
  `appwrite/functions/admin-actions`.
- Function: `access-guards`, runtime `node-22`, deployed from
  `appwrite/functions/access-guards`.

Admin-only mutations must go through Appwrite Functions, not browser API keys.
Admin panel identity is separated from player identity: the admin app checks the
private `admin_profiles` table through the `admin-actions` Function, while the
web/mobile apps use the public player `profiles` table. Admin function calls
send a short Account JWT in the `juchess-admin-jwt` execution header, and the
Function rejects admin routes without it.
To redeploy the admin function after edits:

```bash
appwrite functions create-deployment \
  --function-id admin-actions \
  --code appwrite/functions/admin-actions \
  --activate true \
  --entrypoint src/main.js \
  --commands "npm install"
```

To deploy the public access guard function:

```bash
appwrite functions create-deployment \
  --function-id access-guards \
  --code appwrite/functions/access-guards \
  --activate true \
  --entrypoint src/main.js \
  --commands "npm install"
```

## Current Implementation Slice

- Web sign-in, sign-up, password recovery, tournament reads, and profile
  session state are wired to Appwrite with prototype fallback data.
- Admin sign-in now uses separate admin-only teams and `admin_profiles`, not the
  player `profiles.role` field. Super admins can create/suspend admin access
  from the admin panel.
- Admin can create and lift identity/IP blocks. Blocking with an Appwrite user
  ID disables the account and deletes its sessions.
- Web and Flutter sign-in/sign-up call the `access-guards` Function so blocked
  emails, University IDs, phones, and IPs cannot continue.
- Flutter has Appwrite config, session detection, sign-in, sign-up, sign-out,
  and tournament reads while preserving the prototype visual structure.
- The `admin-actions` Function has concrete admin mutation routes for admin
  access, tournaments, registrations, games, profiles, blocks, and announcements.
- The prototype checklist is the acceptance source for each future screen port.
