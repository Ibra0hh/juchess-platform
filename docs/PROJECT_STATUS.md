# JuChess Project Status

## Non-Negotiable Product Rule

The real apps must match the prototypes. Do not invent a new UI.

Source-of-truth prototype folders:

- `docs/prototypes/web`
- `docs/prototypes/mobile`
- `docs/prototypes/admin`

Implementation must preserve the prototype colors, layout density, labels,
screen names, navigation, cards, buttons, and behavior. Appwrite is the backend
layer under the same UI, not a redesign trigger.

## Current Workspace

- Root: `C:\Users\ibra_\Downloads\juchess-platform`
- Web app: `apps/web`
- Admin app: `apps/admin`
- Mobile/tablet app: `apps/mobile`
- Appwrite config and functions: `appwrite`
- Backend schema plan: `docs/appwrite-schema.md`

## Current Technical State

- Appwrite CLI is installed.
- React/Vite web and admin apps exist.
- Flutter mobile/tablet app exists.
- Appwrite client wrappers are present.
- Admin Function stub exists at `appwrite/functions/admin-actions`.
- Flutter app has been corrected to follow the mobile prototype direction.

## Verified So Far

- `npm run build:web` passed before the latest prototype-reference copy.
- `npm run build:admin` passed before the latest prototype-reference copy.
- `npm run mobile:analyze` passes.
- `npm run mobile:test` passes.
- `node appwrite/functions/admin-actions/src/main.js` import check passed.

## Immediate Next Work

1. Replace the invented React web shell with a faithful port of the web prototype.
2. Replace the invented React admin shell with a faithful port of the admin prototype.
3. Continue expanding the Flutter app screen-by-screen from the mobile prototype.
4. Create the real Appwrite project, tables, buckets, teams, and function deployment.
5. Connect prototype screens to Appwrite data without changing the UI.

## Appwrite Boundary

Client apps can use normal Appwrite Auth, TablesDB reads/writes allowed by
permissions, Storage, and Realtime.

Admin-only actions must go through Appwrite Functions. Do not expose server API
keys in React or Flutter client code.
