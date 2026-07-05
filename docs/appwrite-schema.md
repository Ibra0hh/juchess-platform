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

### `profiles`

Member profile connected to Appwrite Auth user.

Fields:
- `accountId` string, required, unique.
- `displayName` string, required.
- `universityId` string, optional, unique when present.
- `email` email, required.
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

The function currently has a health-check stub and should be expanded after the Appwrite project and tables exist.
