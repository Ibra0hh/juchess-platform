# JuChess Appwrite Schema

This is the first backend contract for the real JuChess apps. The web app, admin app, and Flutter app should all use these same table IDs and field names.

## Project Platforms

- Web app: `localhost`, production web domain, and GitHub Pages/domain when published.
- Admin app: `localhost`, production admin domain.
- Flutter app: Android package `edu.ju.chess.juchess_mobile`.
- iOS bundle ID should use the same reverse-domain style when Xcode is available.

## Auth And Teams

- Client apps use the Account API for normal sign in, sign up, sessions, and password recovery.
- Admin screens must not expose API keys in browser code.
- Appwrite Teams:
  - `admins`: full club operators.
  - `organizers`: can manage assigned tournaments.
  - `members`: approved club members.

## Tables

Database ID: `juchess`

Machine-readable contract: `appwrite/schema.json`

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

Permissions:
- Owner can read/update limited profile fields.
- Members can read public profile fields.
- Admin Function handles role/status changes.

### `tournaments`

Club tournament/event definitions.

Fields:
- `slug` string, required, unique.
- `name` string, required.
- `status` enum: `draft`, `upcoming`, `active`, `completed`, `cancelled`.
- `format` string, required.
- `timeControl` string, required.
- `roundsTotal` integer, optional.
- `currentRound` integer, optional.
- `startsAt` datetime, optional.
- `endsAt` datetime, optional.
- `location` string, optional.
- `capacity` integer, optional.
- `description` string, optional.
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
- `pgn` string, optional.
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

Posters, QR codes, and downloadable event files.

## First Server Function

Function ID: `admin-actions`

Responsibilities:
- Approve member accounts.
- Create/update tournaments.
- Confirm registrations and check-ins.
- Publish pairings/results.
- Recalculate standings.
- Manage announcements.
- Manage profile roles and status.
- Manage identity and IP blocks.

Implemented routes:
- `GET /`
- `GET /blocks`
- `POST /blocks/identity`
- `POST /blocks/identity/:id/unblock`
- `POST /blocks/ip`
- `POST /blocks/ip/:id/unblock`
- `POST /tournaments`
- `PATCH /tournaments/:id`
- `DELETE /tournaments/:id`
- `POST /registrations/:id/confirm`
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
