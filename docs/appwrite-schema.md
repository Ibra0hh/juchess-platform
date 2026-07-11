# JuChess Appwrite Schema

This is the first backend contract for the real JuChess apps. The public web app and Flutter app share player-facing tables. The admin app has a separate admin access table and admin-only teams.

## Project Platforms

- Web app: `localhost`, production web domain, and GitHub Pages/domain when published.
- Admin app: `localhost`, production admin domain.
- Flutter app: Android package `edu.ju.chess.juchess_mobile`.
- iOS bundle ID should use the same reverse-domain style when Xcode is available.

## Auth And Teams

- Client apps use the Account API for normal sign in, sign up, sessions, and password recovery.
- Admin screens must not expose API keys in browser code.
- Appwrite Teams:
  - `admin_super_admins`: super-admin access for the admin app only.
  - `admin_staff`: regular admin/organizer access for the admin app only.
  - `admins`: legacy player-profile role team; do not use for admin app authorization.
  - `organizers`: legacy player-profile role team; do not use for admin app authorization.
  - `members`: approved club members.
- Admin app authorization must use `admin_profiles` plus `admin_super_admins` or `admin_staff`, not the player `profiles.role` field.

## Tables

Database ID: `juchess`

Machine-readable contract: `appwrite/schema.json`

### `admin_profiles`

Private admin-panel identity table. This is separate from the player `profiles` table.

Fields:
- `accountId` string, required, unique. Appwrite Auth user ID.
- `email` email, required, unique.
- `displayName` string, required.
- `role` enum: `superAdmin`, `admin`, `organizer`.
- `status` enum: `active`, `suspended`.
- `teamId` string, optional. Usually `admin_super_admins` or `admin_staff`.
- `membershipId` string, optional Appwrite team membership ID.
- `createdByAdminId` string, optional `admin_profiles` row ID.
- `createdAt` datetime, required.
- `notes` string, optional.

Permissions:
- No direct browser reads/writes.
- Admin Function reads/writes.
- `superAdmin` can create and suspend admin profiles.
- Active rows are required for every admin function route except `GET /`.

### `profiles`

Member profile connected to Appwrite Auth user.

Fields:
- `accountId` string, required, unique.
- `displayName` string, required.
- `universityId` string, optional, unique when present.
- `email` email, required.
- `phone` string, optional, unique when present. Stored in normalized `+962...` format for Jordan numbers.
- `rating` integer, default `1200`.
- `role` enum: `member`, `organizer`, `admin`.
- `status` enum: `pending`, `active`, `suspended`.
- `avatarFileId` string, optional.
- `chessComUsername` string, optional, unique. Saved after a successful Chess.com import.
- `lichessUsername` string, optional, unique. Saved after a successful Lichess import.

Permissions:
- Owner can read/update limited profile fields.
- Members can read public profile fields.
- Admin Function handles role/status changes.

### `tournaments`

Club tournament/event definitions.

Fields:
- `slug` string, required, unique.
- `name` string, required.
- `status` enum: `draft`, `upcoming`, `active`, `completed`, `archived`.
- `format` string, required.
- `timeControl` string, required.
- `roundsTotal` integer, optional.
- `currentRound` integer, optional.
- `startsAt` datetime, optional.
- `endsAt` datetime, optional.
- `playMode` enum: `inPerson`, `online`; defaults to `inPerson`.
- `location` string, optional.
- `capacity` integer, optional.
- `description` string, optional.
- `bracketSnapshot` longtext, optional. JSON snapshot of the published knockout bracket; web and mobile use this as the canonical bracket after publish.
- `physicalBoards` integer, default `3`, between `1` and `64`. Shared venue board count used by the admin Procedure scheduler.
- `createdByProfileId` string, required.

Permissions:
- Public/member read for published events.
- Admin Function writes.

### `registrations`

Player signups for tournaments.

Fields:
- `tournamentId` string, required.
- `profileId` string, required.
- `status` enum: `pending`, `confirmed`, `waitlisted`, `cancelled`.
- `seed` integer, optional.
- `checkInCode` string, optional.
- `checkedIn` boolean, default `false`.

Permissions:
- Player can read own registrations.
- Tournament organizer/admin can read registrations.
- Admin Function confirms/checks in players.

### `games`

Tournament pairings and results.

Fields:
- `tournamentId` string, required.
- `round` integer, required.
- `board` integer, required.
- `whiteProfileId` string, required.
- `blackProfileId` string, required.
- `status` enum: `scheduled`, `live`, `completed`, `forfeit`.
- `result` enum: `1-0`, `0-1`, `1/2-1/2`, `*`.
- `pgn` text, optional. The admin function enforces a 50,000-character limit.
- `procedureWave` integer, optional. Planned batch within the round.
- `physicalBoard` integer, optional. Venue board assigned by the Procedure scheduler.
- `queuePosition` integer, optional. Stable per-round procedure order.
- `startedAt` datetime, optional.
- `finishedAt` datetime, optional.

Permissions:
- Members can read published games.
- Admin Function writes pairings/results.

### `standings`

Tournament standings snapshot.

Fields:
- `tournamentId` string, required.
- `profileId` string, required.
- `rank` integer, required.
- `points` float, required.
- `tieBreak` float, optional.
- `played` integer, default `0`.
- `wins` integer, default `0`.
- `draws` integer, default `0`.
- `losses` integer, default `0`.

Permissions:
- Members can read published standings.
- Admin Function recalculates/writes standings.

### `announcements`

Club notices shown on the web, mobile, and admin dashboards.

Fields:
- `title` string, required.
- `body` string, required.
- `audience` enum: `public`, `members`, `organizers`, `admins`.
- `status` enum: `draft`, `published`, `archived`.
- `publishedAt` datetime, optional.
- `createdByProfileId` string, required.

Permissions:
- Public can read published public announcements.
- Members can read member announcements.
- Admin Function writes.

### `admin_audit`

Append-only operational log for admin actions.

Fields:
- `actorProfileId` string, required.
- `action` string, required.
- `targetTable` string, optional.
- `targetRowId` string, optional.
- `payload` string, optional JSON string.
- `createdAt` datetime, required.

Permissions:
- Admins can read.
- Admin Function writes.

### `identity_blocks`

Admin-managed block list for player identity values.

Fields:
- `type` enum: `email`, `universityId`, `phone`.
- `value` string, required. Email and University ID are lowercase; Jordan phones are normalized to `+962...`.
- `reason` string, optional admin note.
- `status` enum: `active`, `lifted`.
- `targetUserId` string, optional Appwrite user ID. When present, blocking also disables the Appwrite account and deletes sessions.
- `targetProfileId` string, optional profile row ID. When present, blocking also suspends the profile.
- `createdByProfileId` string, required.
- `createdAt` datetime, required.
- `liftedByProfileId` string, optional.
- `liftedAt` datetime, optional.

Permissions:
- Admin Function writes.
- Guard Function reads active rows and only returns allowed/blocked, never the list.

### `ip_blocks`

Admin-managed network block list.

Fields:
- `ipRange` string, required. Supports a single IPv4 address or an IPv4 CIDR range.
- `reason` string, optional admin note.
- `status` enum: `active`, `lifted`.
- `createdByProfileId` string, required.
- `createdAt` datetime, required.
- `liftedByProfileId` string, optional.
- `liftedAt` datetime, optional.

Permissions:
- Admin Function writes.
- Guard Function reads active rows and only returns allowed/blocked.

## Storage Buckets

### `avatars`

Profile images.

### `tournament-assets`

Public completed-tournament photos, videos, posters, QR codes, and downloadable event files.

- Public clients have read access so web and mobile can render and download galleries.
- `admin_super_admins`, `admin_staff`, and the legacy admin/organizer teams can create, update, and delete files.
- Gallery files use `ju-media--<tournament-row-id>--<timestamp>--<original-name>` so every client can group Storage files by tournament without a second metadata table.
- Maximum file size is 200 MB. Common image and video formats are allowed.

## First Server Function

Function ID: `admin-actions`

Execute permissions:
- `team:admin_super_admins`
- `team:admin_staff`

Admin execution contract:
- The admin React app creates a short Account JWT and sends it as the execution header `juchess-admin-jwt`.
- The Function validates that JWT with the Account API, then checks `admin_profiles`.
- CLI/console executions without that JWT must return `401 Admin session is required.`

Responsibilities:
- Approve member accounts.
- Permanently delete player profiles and Auth accounts only when they have no tournament game history or admin access; dependent registrations, check-ins, and standings are removed first.
- Create/update tournaments.
- Confirm registrations and check-ins.
- Publish pairings/results.
- Recalculate standings.
- Manage announcements.
- Manage profile roles and status.
- Manage identity and IP blocks.
- Manage admin-panel access through separate admin profiles and admin-only teams.

Implemented routes:
- `GET /`
- `GET /admin/session`
- `GET /admin/admins`
- `POST /admin/admins`
- `POST /admin/admins/:id/status`
- `GET /blocks`
- `POST /blocks/identity`
- `POST /blocks/identity/:id/unblock`
- `POST /blocks/ip`
- `POST /blocks/ip/:id/unblock`
- `POST /tournaments`
- `PATCH /tournaments/:id`
- `DELETE /tournaments/:id`
- `POST /registrations/:id/confirm`
- `POST /registrations/:id/status`
- `POST /games/:id/result`
- `POST /profiles/:id/role`
- `POST /profiles/:id/status`
- `POST /announcements`

## First Guard Function

Function ID: `access-guards`

Responsibilities:
- Check sign-in/sign-up identity values against active block rows.
- Check request IP against active IP blocks.
- Return only `{ allowed: true }` or blocked metadata, without exposing the block lists to clients.

Implemented routes:
- `GET /`
- `POST /check`
