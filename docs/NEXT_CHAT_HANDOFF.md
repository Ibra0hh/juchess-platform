# JuChess Complete New-Chat Handoff

Last updated: July 17, 2026

This file is both a complete project handoff and a copy-paste prompt for a new
AI chat. It describes the intended product, the actual implementation, the
backend contract, deployment state, known limitations, and the working rules
that must not be lost between chats.

## July 17 Google onboarding and membership state

- Google OAuth now follows one explicit, tested post-authentication tree:
  a missing or incomplete JuChess profile routes to `/complete-profile`; a
  complete profile routes to `/profile`. The completion form requires full
  name, university, University ID, and phone, while Chess.com and Lichess
  usernames remain optional.
- Email/password users remain signed out until email verification. The
  `player-actions` Function also rejects unverified accounts directly, so an
  unverified client cannot bypass the website and create a profile.
- There is no player approval or pending-member state. A complete profile save
  creates an active member. Suspended profiles cannot save around moderation.
- The live `profiles.status` enum is `active,suspended` with default `active`.
  All 10 legacy pending values were migrated. Four verified, complete legacy
  members are public; six incomplete, unverified, or orphaned legacy records
  remain owner/admin-only so canonical chat and fair-play references are not
  destroyed. The unauthenticated API exposes 10 active profiles and zero
  pending profiles.
- `player-actions` deployment `6a5a2d6bcf3c577351e2` is ready and active.
- `npm run check:web`, `npm run check:functions`, `npm run test:functions`, and
  `npm run check:email-templates` passed. The Function suite has 25 passing
  tests and the web suite has 50 passing tests.
- Appwrite accepted one real verification request and one real password-
  recovery request for the approved address `7ibrahem0h@gmail.com`. The
  account's verified flag was restored immediately and the temporary test
  session was deleted. Gmail delivery/rendering and the one-time links still
  require confirmation from the recipient; do not claim inbox delivery yet.

## Copy-Paste Prompt For The New Chat

```text
You are continuing the JuChess platform. Work as the implementation engineer,
not as a consultant. Inspect the real repository and current deployed state
before changing anything, then implement, test, deploy, and verify requested
changes end to end.

Repository:
C:\Users\ibra_\Downloads\juchess-platform

GitHub:
https://github.com/Ibra0hh/juchess-platform

Required first file:
C:\Users\ibra_\Downloads\juchess-platform\docs\NEXT_CHAT_HANDOFF.md

Primary public website:
https://juchess.page/

Primary admin website:
https://juchess.page/admin/

Legacy GitHub Pages URLs:
https://ibra0hh.github.io/juchess-platform/web/
https://ibra0hh.github.io/juchess-platform/admin/

Shared backend:
Appwrite Cloud endpoint https://cloud.appwrite.io/v1
Project ID juchess-platform
Database ID juchess

Start by running:
1. cd C:\Users\ibra_\Downloads\juchess-platform
2. git status --short --branch
3. git fetch origin
4. git log -8 --oneline --decorate
5. read docs/NEXT_CHAT_HANDOFF.md completely
6. inspect the specific source files for the user's newest request

Non-negotiable rules:
- The prototype UI and the user's screenshots are the design source of truth.
- Do not redesign the product or invent a generic dashboard.
- Use real Appwrite data for live product behavior. Do not hide broken data
  flow behind mock data.
- Preserve unrelated user changes and untracked folders.
- Never expose or commit an Appwrite API key. Use environment variables or the
  authenticated Appwrite CLI. Do not repeat any key from an old chat.
- Never expose the Resend SMTP/API credential. It is stored in Appwrite, not in
  this repository.
- Admin-only writes go through server Functions.
- Tournament results, clocks, pairings, standings, and brackets must agree on
  web, admin, and mobile. A UI-only approximation is not complete.
- For visual work, inspect the real rendered page/app and take screenshots.
- For mobile work, install and verify on a connected phone/emulator when one is
  available. If adb has no device, say so instead of claiming installation.
- Do not claim completion after only a build. Run the relevant tests, deploy
  the relevant backend/frontend, and verify the user flow.

Read the rest of this handoff before doing any work. It contains current
architecture, tournament rules, hosted online-game state, deployments, known
gaps, and test commands.
```

## 1. Product Mission

JuChess is the University of Jordan Chess Club platform. It has three real
clients sharing one Appwrite backend:

1. A public member website.
2. An admin control center for tournament organizers.
3. A Flutter mobile/tablet app.

The product covers club accounts, tournaments, participant registration,
pairings, brackets, physical tournament procedure, online tournament play,
live boards, standings, announcements, completed-event media, game review,
analysis, puzzles, and member history.

The user is actively testing the product with real accounts and friends. Data
consistency and tournament logic matter more than demo appearance.

## 2. Source Of Truth And Design Contract

The existing prototypes and user-provided screenshots are the visual source of
truth:

- `docs/prototypes/web`
- `docs/prototypes/mobile`
- `docs/prototypes/admin`

Do not create a different visual language. Preserve the JuChess identity:

- Black replaces the old navy color.
- Burgundy/wine is the primary accent.
- Cream/off-white is the main surface color.
- Gold is a restrained secondary accent.
- Use the transparent JuChess crest/logo assets already in the apps.
- The chessboard uses the burgundy/cream/gold piece style already implemented.
- Cards should stay compact and operational, not marketing-style.
- Do not add decorative gradients, orbs, huge hero cards, or emoji format icons.
- Do not put visible implementation explanations inside the product UI.

When a screenshot and current code disagree, inspect the screenshot and the
latest user wording. Fix the real screen instead of rationalizing the mismatch.

## 3. Repository And Git State

- Local repo: `C:\Users\ibra_\Downloads\juchess-platform`
- Remote: `https://github.com/Ibra0hh/juchess-platform.git`
- Primary branch: `main`
- Current deployed application baseline commit: `6d864fa`
- The handoff is maintained on `main`; always confirm the remote has not moved
  before starting new work.

Recent important commits:

- `6d864fa` Fix phone desktop-mode layout
- `298e040` Build Pages for authenticated player actions
- `cfee654` Authenticate player Function requests
- `753cbbe` Separate private player profile data
- `d8cc704` Place recruitment action below team
- `cc082f2` Add member recruitment workflow
- `31179d1` Require email verification before web sign-in
- `a4c6f46` Deploy admin player profile media
- `af326b1` Show player profile media in admin
- `7bbc970` Add branded authentication email templates
- `d6977ea` Hide unfinished public sections
- `a24972c` Serve JuChess home at domain root
- `2a8e87a` Align Google profile completion flow
- `d160a21` Polish signup and signin forms
- `c20c8c3` Fix board orientation and add pregame countdown
- `9364c91` Auto-refresh tournament data without page reloads
- `6e9cff8` Keep players on their current live board
- `433dc5e` Make online game turns server authoritative
- `abd7675` Fix online tournament turn handoff
- `903c27c` Preserve cached site bundles during deploy
- `5ea2f9c` Start online tournaments immediately
- `96199d5` Deploy tournament standings fix
- `27c26a5` Use cloud standings on tournament pages
- `96188b2` Add online Swiss showcase seeder

The worktree currently contains unrelated untracked `.claude/` and `graphify-out/`
files. Do not delete, revert, stage, or commit them unless the user explicitly
asks. Always run `git status --short` before editing and before committing.

At this handoff baseline there are no tracked local modifications. Do not infer
that this remains true; check the worktree again in the new chat.

## 4. Repository Map

### Public web

- Root: `apps/web`
- Stack: React, TypeScript, Vite, React Router, Appwrite Web SDK, `chess.js`.
- Entry/routes: `apps/web/src/App.tsx`
- Appwrite/data adapter: `apps/web/src/lib/juchess.ts`
- Auth: `apps/web/src/lib/auth.ts`, `apps/web/src/context`
- Tournament detail: `apps/web/src/screens/TournamentDetailPage.tsx`
- Hosted online games: `apps/web/src/screens/OnlineGamesPage.tsx`
- Game review/analysis: `apps/web/src/screens/GamesPage.tsx`
- Shared board: `apps/web/src/components/JuChessBoard.tsx`
- Stockfish review engine: `apps/web/src/lib/gameReview.ts`
- External imports: `apps/web/src/lib/externalGames.ts`
- Hosted-game API: `apps/web/src/lib/onlineTournament.ts`
- Tournament play lock: `apps/web/src/context/TournamentPlayProvider.tsx`

Public routes:

- `/home`
- `/tournaments`
- `/tournament/:id`
- `/attendance-confirm`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/verify-email`
- `/auth/callback`
- `/complete-profile`
- `/games` for hosted tournament play/free board
- `/tools` for game review and analysis entry
- `/leaderboard`
- `/profile`

### Admin web

- Root: `apps/admin`
- Stack: React, TypeScript, Vite, Appwrite Web SDK, `chess.js`.
- Main UI is currently a large single file: `apps/admin/src/App.tsx`.
- Backend adapter: `apps/admin/src/lib/adminData.ts`.
- Shared admin board: `apps/admin/src/components/JuChessBoard.tsx`.
- Tournament wizard state: `apps/admin/src/lib/tournamentWizard.ts`.

Admin top-level screens in current code:

- Dashboard
- Tournaments
- Players
- News
- Announcements
- Admin Access

`App Windows` was removed and must not be reintroduced.

### Flutter mobile/tablet

- Root: `apps/mobile`
- Stack: Flutter/Dart, Appwrite Flutter SDK, Dart `chess` package.
- Main implementation is currently monolithic:
  `apps/mobile/lib/main.dart`.
- Game review helpers/tests live under `apps/mobile/lib` and
  `apps/mobile/test`.
- Android package: `edu.ju.chess.juchess_mobile`.

Phone orientation is portrait-locked; tablet layouts may rotate. Preserve the
existing prototype structure when splitting the monolith in the future.

### Backend and infrastructure

- Appwrite config: `appwrite/functions.json`, `appwrite/schema.json`
- Admin/tournament engine: `appwrite/functions/admin-actions`
- Player registration writes: `appwrite/functions/player-actions`
- Attendance email-link responses: `appwrite/functions/attendance-actions`
- Identity/IP access check: `appwrite/functions/access-guards`
- Schema migrations: `scripts/migrate-*.ps1`
- Demo/seeding: `scripts/seed-appwrite-demo-data.mjs` and
  `scripts/seed-online-swiss-showcase.ps1`
- GitHub Pages build: `scripts/build-pages.mjs`
- Generated deployed web/admin: `docs/web`, `docs/admin`

`graphify-out/graph.json` exists and can be queried for architecture, but it may
lag recent commits. Source code and this handoff override stale graph output.

## 5. Deployment URLs And Live Appwrite State

Public URLs:

- Primary public web: `https://juchess.page/`
- Primary admin: `https://juchess.page/admin/`
- Verification callback: `https://juchess.page/verify-email`
- Password recovery callback: `https://juchess.page/forgot-password`
- Legacy public web: `https://ibra0hh.github.io/juchess-platform/web/`
- Legacy admin: `https://ibra0hh.github.io/juchess-platform/admin/`

Domain and hosting:

- Domain registrar: Name.com
- Domain: `juchess.page`
- Static hosting: GitHub Pages from the repository `docs` directory
- `scripts/build-pages.mjs` builds both the custom-domain root client and the
  legacy `/web/` client, plus `/admin/`.
- Do not add a client-side redirect from `juchess.page` to the legacy GitHub
  URL. The root domain now serves the real web app directly.

Appwrite:

- Endpoint: `https://cloud.appwrite.io/v1`
- Project ID: `juchess-platform`
- Database ID: `juchess`
- Storage buckets: `avatars`, `tournament-assets`
- Teams: `admin_super_admins`, `admin_staff`, plus legacy
  `admins`, `organizers`, `members`

Live Function IDs and latest ready deployments at handoff time:

- `admin-actions`: deployment `6a590cc75b48c61da74b`, ready and active
- `player-actions`: deployment `6a5804c43a59bae2fb6d`, ready and active
- `attendance-actions`: deployment `6a53cd75ade72590f33d`, ready and active
- `access-guards`: deployment `6a57ee981310b683f32f`, ready and active

`admin-actions` is scheduled every minute for attendance processing and also
serves the tournament engine and hosted online-game endpoints.

Never place an Appwrite API key in source, Markdown, chat output, client env, or
Git. Use the authenticated Appwrite CLI or an `APPWRITE_API_KEY` environment
variable only. A key was pasted in an older conversation; do not repeat it and
rotate it if it has not already been rotated.

## 6. Appwrite Auth And Security Boundary

Player identity and admin identity are deliberately separate.

Player web/mobile:

- Appwrite Account handles sessions.
- Public member fields live in `profiles`; account ID, email, University ID,
  and phone live in owner-readable `profile_private` rows with the same row ID.
- Owner profile reads and writes go through `player-actions` using a short-lived
  Account JWT in the `juchess-player-jwt` execution header.
- Sign-up/sign-in checks call `access-guards`.
- Blocked email, University ID, phone, user, profile, or IP must be rejected.

### Web email/password flow

The web email/password flow is live in commit `31179d1`:

1. Sign-up creates the Appwrite Account because Appwrite requires an account
   and authenticated session before it can send a verification message.
2. JuChess creates the supplied player profile data.
3. JuChess calls `account.createEmailVerification()` with
   `https://juchess.page/verify-email` as the production callback.
4. The temporary sign-up session is immediately deleted.
5. `/verify-email` reads Appwrite's `userId` and `secret`, calls
   `account.updateEmailVerification()`, and then asks the player to sign in.
6. JuChess does not automatically create a post-verification session.
7. `getCurrentSession()` deletes and rejects any unverified email/password
   session before loading private app state.
8. Signing in before verification attempts to send a fresh verification link,
   deletes the temporary session, and shows a verification-required message.
9. If a verification link is invalid, expired, or already used, the callback
   page offers a real `Resend verification email` form. Appwrite requires a
   signed-in account to create a verification token, so JuChess asks for the
   registered email and password, creates a short-lived session, sends the new
   seven-day link, and deletes that session immediately. Already-verified
   accounts are detected from Appwrite's explicit already-verified response or
   the matching signed-in account state, receive a short thank-you confirmation,
   and can return directly to Home instead of seeing the resend form. The
   profile-completion guard deliberately allows `/verify-email` so it cannot
   redirect an authenticated player before this state check finishes.

Important semantic point: the Appwrite account technically exists before email
verification, but it cannot obtain JuChess app access. Do not promise that no
account row exists until verification; that is not how this provider flow works.

Relevant files:

- `apps/web/src/lib/auth.ts`
- `apps/web/src/context/AuthContext.tsx`
- `apps/web/src/screens/AuthPage.tsx`
- `apps/web/src/screens/VerifyEmailPage.tsx`
- `apps/web/src/screens/ForgotPasswordPage.tsx`
- `apps/web/src/screens/OAuthCallbackPage.tsx`

### Transactional email delivery

Appwrite initiates verification and recovery emails. Resend is only the SMTP
delivery transport configured inside Appwrite Auth settings.

Current non-secret configuration:

- Resend domain `juchess.page` is verified.
- SMTP sender name: `JuChess`
- SMTP sender email: `no-reply@juchess.page`
- Reply-to name: `JuChess Club`
- Reply-to email: `Juchess180@gmail.com`
- SMTP host: `smtp.resend.com`
- SMTP port: `587`
- SMTP username: `resend`
- Encryption: TLS
- Appwrite Auth session alerts are disabled project-wide. Normal email/password
  sign-ins on web, admin, and mobile must not send a new-session email. This
  does not disable verification, recovery, or admin-composed player email.
- SMTP/API credential: stored in Appwrite only; never print, copy into source,
  or include in a handoff.

Branded Appwrite templates are saved for English:

- Verification subject: `Verify your JuChess email`
- Recovery subject: `Reset your JuChess password`
- Source templates:
  `appwrite/email-templates/account-verification.html` and
  `appwrite/email-templates/password-recovery.html`
- Public email logo:
  `https://juchess.page/email/juchess-email-logo.png`
- Validation command: `npm run check:email-templates`
- Both live authentication templates were made phone-responsive on July 16,
  2026. They use compact inline fallback spacing plus a Gmail-supported
  `max-width:480px` media query: 24px mobile headings, 14px body copy, full-width
  action buttons, and stacked footer links. Local renders passed at 320x568,
  390x844, and desktop width with no horizontal overflow or console errors;
  Appwrite's saved `verification` and `recovery` HTML matched source exactly.

At this handoff, SMTP configuration and both templates were accepted by
Appwrite, but no real end-to-end verification email was sent because the user
had not yet confirmed the recipient address at the final send step. The next AI
must not claim inbox delivery until a real account/email test succeeds.

### OAuth

- The visible social option is Google only. Apple was removed from the UI
  because it is not configured; do not show it until Apple credentials exist.
- Google OAuth is configured through Appwrite and Google Cloud.
- The Google authorized redirect URI must be the exact callback URI shown by
  Appwrite, not `juchess.page` directly.
- Appwrite returns to `/auth/callback`; JuChess creates the session and routes
  incomplete profiles to `/complete-profile`.
- A July 16 production failure was caused by `/profile` being called without a
  player JWT after Appwrite created the Google session. Commit `cfee654` adds
  the JWT to web/mobile profile, registration, recruitment, and hosted-game
  Function calls. The live callback now reaches `/complete-profile` and the
  matching production `GET /profile` execution returns HTTP 200.
- Google supplies basic account identity but not JuChess-required university,
  University ID, and phone data. The completion screen collects those fields.
- The profile-completion requirement is provider-agnostic: any signed-in player
  missing full name, university, University ID, or phone is routed to
  `/complete-profile`. The screen now reads the provider on the current
  Appwrite session, rather than treating a linked Google identity as the active
  sign-in method. Email/password sessions therefore show email-specific copy
  and an email icon; only an active Google session shows Google wording. A
  failure to load provider metadata falls back to neutral JuChess-account copy
  and never invalidates an otherwise healthy session.

Admin:

- Admin access lives in private `admin_profiles`.
- Admin authorization requires membership in `admin_super_admins` or
  `admin_staff` and an active admin profile.
- Do not authorize the admin app from `profiles.role`.
- Admin mutations go through `admin-actions` using the short account JWT header
  implemented in `apps/admin/src/lib/adminData.ts`.
- Super admins can create/suspend admin access.
- Admin actions are written to `admin_audit` where implemented.

Client apps may use public/member Appwrite reads and owner-scoped writes where
the schema permits. They must never contain server API keys.

## 7. Core Data Model

Machine-readable contract: `appwrite/schema.json`.

Important tables:

- `admin_profiles`: private admin identities and role/status.
- `profiles`: public member display data, rating, avatar, and external usernames.
- `profile_private`: owner/admin-only account, email, University ID, and phone.
- `tournaments`: status, format, rounds, mode/platform, dates, bracket snapshot,
  procedure settings, hosted-game policy.
- `registrations`: one player/tournament registration, status, seed.
- `attendance_confirmations`: one-hour Yes/No attendance responses.
- `games`: canonical pairing, colors, result, PGN, online clock and procedure.
- `game_messages`: private game chat.
- `fair_play_events`: player-side tournament telemetry.
- `fair_play_reviews`: organizer review summaries/decisions.
- `standings`: canonical tournament ranking snapshot.
- `announcements`: club broadcasts.
- `crew_applications`, `crew_application_reviews`: player recruitment workflow
  and private admin review notes.
- `admin_audit`: operational audit log.
- `identity_blocks`, `ip_blocks`: access controls.
- `check_ins`: legacy table; the current flow uses attendance confirmation.

Important `tournaments` fields:

- `status`: `draft`, `upcoming`, `active`, `completed`, `archived`
- `format`
- `timeControl`
- `roundsTotal`, `currentRound`
- `startsAt`, `registrationDeadline`
- `playMode`: `inPerson` or `online`
- `onlinePlatform`: `chessCom`, `lichess`, `juchess`
- `bracketSnapshot`: canonical published knockout JSON
- `physicalBoards`
- `firstMoveGraceSeconds`, `disconnectGraceSeconds`
- `chatPolicy`, `fairPlayMode`

Important `games` fields:

- pairing: tournament, round, board, White profile, Black profile
- state: `scheduled`, `live`, `completed`, `forfeit`
- result: `1-0`, `0-1`, `1/2-1/2`, `*`
- `pgn`, `moveVersion`, `lastMoveAt`
- `whiteTimeMs`, `blackTimeMs`, `turnStartedAt`
- `scheduledStartAt`, `firstMoveDeadlineAt`, `clockDeadlineAt`
- `terminationReason`, `forfeitedProfileId`
- procedure: wave, physical board, queue position, start/finish timestamps

The `games` row is the canonical source for live moves and clocks. Clients must
not decide authoritative turns or outcomes locally.

## 8. Tournament Lifecycle

The admin tournament status navbar is exactly:

1. Draft
2. Upcoming
3. Active
4. Completed
5. Archived

Lifecycle behavior:

- Create Tournament is available only in Draft.
- New tournaments are created as Draft.
- Draft can be deleted.
- Archived can be deleted.
- Upcoming is the pairing preparation/publish stage.
- Active is the tournament operation stage.
- Completed can move back one step to Active.
- Active can move back one step to Upcoming.
- Do not jump Completed directly to Upcoming; rollback is one step at a time.
- Completed and Archived do not show a registration queue.
- Registration queue belongs only to Upcoming.
- Players cannot register for Active or Completed tournaments.
- Duplicate registration is rejected server-side and the UI must show a
  pending/loading state after one tap.

Pairings/brackets are not public until the organizer publishes them. Do not
show text blaming or mentioning the admin; simply say rounds/bracket are not
published yet.

## 9. Tournament Creation Contract

The create/edit tournament modal uses the admin prototype and has two logical
steps, not Preview or Review:

1. Basic information.
2. Tournament format.

Basic information includes:

- Tournament name
- Description
- Player capacity
- Typed location/platform information where applicable
- Start date and start time
- Registration deadline date and time
- In-person or online selection
- Tournament image placeholder/upload surface where present in the prototype

Do not restore these removed controls:

- End date in the create form
- Visibility
- Access
- Delay
- Games per match
- Chess.com/Lichess/Main Campus chips
- Emoji icons above formats
- Preview/Review wizard steps

Date and time:

- Date uses the date picker.
- Start and deadline have a separate analog-style 12-hour clock picker beside
  the date picker, with hour/minute and AM/PM controls.
- The wizard Next button must always visit Tournament Format; it must not skip
  the format step.

Online tournament platforms are exactly:

- Chess.com (`chessCom`)
- Lichess (`lichess`)
- JuChess (`juchess`), meaning played inside this platform

## 10. Supported Tournament Formats And Current Engine Behavior

Admin format order:

1. Swiss
2. Round robin
3. Double round robin
4. Single elimination
5. Double elimination
6. Multi-stage
7. Team
8. Arena

### Swiss

- `roundsTotal` is explicitly chosen between 1 and 50.
- Only round 1 is created/published before play.
- Later rounds are generated after the current round completes.
- Pairings group players by score, avoid rematches where possible, and rotate a
  full-point bye so a player does not receive a second bye while another has
  none.
- Current user rule for colors: every pairing uses an independent random White
  and Black draw. Do not force alternation. A player may receive Black twice in
  a row. Ranking must not receive color priority.
- Public rounds are displayed newest first, so the latest round is visible at
  the top.

### Round robin

- Full schedule is predetermined.
- All rounds are generated from the participant set.
- Color allocation is balanced across the schedule.
- Procedure can plan the full tournament.

### Double round robin

- Each pair meets twice.
- The return game reverses White and Black.
- Full schedule is predetermined.

### Single elimination

- Bracket size is based on actual confirmed participants and the next power of
  two, with byes where required.
- Round order is logical: Round of 32, Round of 16, Quarterfinal, Semifinal,
  Final as required by field size.
- Winners feed the exact next match.
- Draws cannot resolve knockout advancement; an organizer tiebreak decision is
  required.
- No standings tab is intended for a pure knockout tournament.

### Double elimination

- Uses Winners, Losers, and Final views.
- The lower bracket is generated from the server bracket structure, not from a
  manually invented set of labels.
- Losers drop from the correct winners match into the correct lower match.
- Grand final/reset logic exists in the backend structure.
- No standings tab is intended for a pure knockout tournament.
- The canonical post-publish source is `bracketSnapshot` plus real game rows.

### Multi-stage

- Phase One is Swiss.
- Phase Two is a single-elimination final bracket.
- The admin management nav uses Phase One and Phase Two.
- Public/mobile rounds include Stage One and Stage Two inner navigation where
  applicable.
- Current server cutover seeds the top eight when enough qualifiers exist.

### Arena

- Current implementation uses rolling Swiss-style re-pairing.
- It does not auto-complete; the organizer completes the event.
- This is not yet a full Lichess-style continuous Arena engine with streak and
  berserk logic. Treat that as a known limitation.

### Team

- The UI format exists.
- The server currently supports only a generic single round because there is
  no complete team/roster/match-point data model yet.
- Do not claim Team is fully implemented until the team model exists.

## 11. Tournament Tab Contracts

There is historical inconsistency here. Preserve the latest product intent and
fix clients deliberately rather than guessing.

Current intended public/mobile behavior:

- Knockout: Registration, Players, Bracket. No Standings.
- Non-knockout: Registration, Players, Rounds, Standings.
- Completed adds Photos after the final tournament-data tab.
- Multi-stage Rounds contains Stage One and Stage Two navigation.
- Do not create a redundant Games tab when the same games already live inside
  Bracket or Rounds.

Actual current implementation at handoff time:

- Mobile follows the compact contract above.
- Web still renders a separate Games tab for both knockout and non-knockout
  tournament details. This is a known cross-platform consistency gap.
- Web knockout currently orders Registration, Players, Games, Bracket.
- Web non-knockout currently orders Registration, Players, Rounds, Games,
  Standings.

Do not silently describe web and mobile as identical until this gap is fixed
and visually verified.

Admin management tabs are different because they are operational:

- Knockout: Participants, Bracket, optional Procedure or Fair Play.
- Non-knockout: Participants, Rounds, optional Procedure or Fair Play,
  Standings.
- Multi-stage: Participants, Phase One, Phase Two, optional Procedure or Fair
  Play, Standings.
- Procedure exists only for in-person Active or Completed tournaments.
- JuChess-hosted online tournaments have no Procedure; they use Fair Play.

## 12. Publish, Unpublish, Shuffle, And Real Data

- Shuffle and Publish live inside Upcoming tournament management, not as row
  actions on every status.
- Before Publish, the organizer may shuffle participants/pairings/colors.
- Publish persists exact game rows and a bracket snapshot where applicable.
- Public web and mobile must render those same persisted names, colors, rounds,
  and bracket positions.
- After Publish, shuffle is locked.
- Unpublish removes public rounds/brackets and returns the event to editable
  pairing preparation.
- Unpublishing must remove the public view on both web and mobile.
- Activation must preserve the exact published pairings; it must not regenerate
  a different bracket.
- Participants and player counts are derived from real registration rows.
- Duplicate profile registrations must be deduplicated in reads as well as
  prevented in writes.

Do not use random display names or mock brackets to fill a live tournament.
Fake test users are acceptable only when they are real Appwrite rows created by
an explicit seed script.

## 13. In-Person Procedure

Procedure is the organizer's physical-board scheduler.

The organizer enters the number of physical boards. The backend assigns every
match:

- Tournament round
- Match/board number
- Procedure wave
- Physical board
- Queue position
- Scheduled/live/completed state

Example: eight Round-of-16 games and three physical boards create three waves.
The first three games use boards 1-3, then the next queued games take a board
after it becomes free.

Rules:

- Procedure is available only for in-person Active and Completed tournaments.
- Upcoming may publish pairings but does not run games.
- Only a started live match can accept a normal result.
- A physical board cannot host two live games.
- A later queue item cannot jump an unresolved earlier lane item.
- Result entry does not require PGN.
- The organizer may save a result first, then later add/correct PGN without
  advancing the tournament a second time.
- Completed Procedure remains editable for game/PGN correction.
- Procedure UI should resemble Rounds, but grouped clearly by physical board
  and wave.
- Active procedure matches are clickable and open the digital board.

Important backend routes:

- `POST /tournaments/:id/procedure/configure`
- `POST /games/:id/start`
- `POST /games/:id/result`
- `POST /games/:id/pgn`
- `POST /tournaments/:id/rounds/next`

## 14. JuChess-Hosted Online Tournaments

`playMode=online` and `onlinePlatform=juchess` means players play inside the
platform. Chess.com and Lichess options currently identify external platforms;
they do not provide the same internal authoritative board flow.

Hosted online tournament flow:

1. Organizer creates and publishes a tournament/pairings.
2. Tournament becomes Active.
3. Each assigned player is routed to only their current unfinished game.
4. The same public game row is available to spectators.
5. Both players receive a 20-second pre-game ready window.
6. After `scheduledStartAt`, White's server-owned clock starts.
7. White submits a legal move with expected `moveVersion`.
8. Server validates identity, side to move, legality, revision, and time.
9. Server saves canonical PGN/version/clocks and starts Black's clock.
10. Black can then move; the process repeats.
11. Checkmate/draw/resignation/timeout saves the result, recalculates standings,
    and advances the tournament when appropriate.

The server is authoritative. Clients must never let two browsers independently
decide whose clock is running.

Important hosted routes in `admin-actions`:

- `POST /player/active-game`
- `POST /player/games/:id/sync`
- `POST /player/games/:id/move`
- `POST /player/games/:id/resign`
- `POST /player/games/:id/messages/list`
- `POST /player/games/:id/messages/send`
- `POST /player/games/:id/fair-play`
- Admin report: `POST /fair-play/report`

Current clock behavior:

- Server stores remaining White/Black milliseconds.
- Only the side to move loses time.
- Increment is applied after a legal move.
- A 20-second pre-game countdown is separate from first-move grace.
- During pre-game, status remains scheduled and clients disable board input.
- At start, White's clock begins.
- Undo/save behavior for organizer-entered games publishes canonical PGN.

Current client synchronization:

- Web uses Realtime when available plus a one-second polling fallback.
- Tournament data/standings auto-refresh without a full browser refresh.
- Admin tournament state auto-refreshes without reloading the whole page.
- The player-game lock keeps a player on their own current game even if another
  tournament match starts.
- A player assigned Black automatically sees the board rotated 180 degrees.

Do not reintroduce the removed text `Live moves update automatically` above the
tournament board.

## 15. Chessboard Contract Across All Platforms

Web/admin use `JuChessBoard` with `chess.js`. Mobile uses `PrototypeChessBoard`
with the Dart `chess` package.

Required board behavior:

- Legal chess movement including castling, en passant, promotion, check,
  checkmate, stalemate, and draws as supported by the chess library.
- Pieces centered in their squares with no movement animation that shifts them
  outside the square.
- Stable responsive 1:1 sizing; the whole board must remain visible.
- Player name and clock on the side corresponding to their color.
- Captured pieces under the relevant player strip.
- Coordinates shown correctly.
- Board flip is a true 180-degree rotation: both ranks and files reverse, pieces
  and arrows rotate with it, and square colors remain chess-correct.
- Normal orientation corners: top-left `a8`, bottom-left `a1`.
- Flipped orientation corners: top-left `h1`, bottom-left `h8`.
- `a1` is a dark square.
- Analysis boards may support right-click arrows and red square marking.
- Tournament online play disables analysis/evaluation assistance.
- Evaluation bar belongs to Tools/analysis/review, not competitive online play.
- Move navigation controls: start, previous, play/next, end wherever a reviewed
  or recorded board is shown.

Latest board fix is in commit `c20c8c3` and was visually verified on the
published web page with no console warnings/errors.

## 16. Public Website State

Primary visible navigation:

- Home
- Tournaments
- Tools
- Profile

`/games` and `/leaderboard` routes still exist internally, but their public
navigation entries are intentionally hidden until those surfaces are ready.

Home should follow the provided real prototype and include News. Tournament
cards must use live Appwrite tournaments and clearly indicate online events.

Tournament detail:

- Registration is auth-aware.
- Registration is allowed only while Upcoming and before the deadline.
- Players and participant count come from real registrations.
- Rounds/bracket appear only after publish.
- Standings use the `standings` table, not local guessed scores.
- Completed events expose Photos and videos with a full viewer/lightbox,
  previous/next/swipe, and download.

Games (`/games`):

- Free legal board when not assigned to a tournament.
- Hosted tournament board for players and spectators.
- Assigned-game lock disables review/analysis navigation during a live online
  tournament game.
- No evaluation bar in competitive online play.

Tools (`/tools`) and review workspace:

- Game review
- Analysis board
- Additional current tool cards exist, but the user's mobile intent is more
  focused. Do not assume the web Tools card set is final.

## 17. Mobile App State

Mobile bottom-level product split currently includes tournament browsing,
Tools, and Games surfaces.

Latest requested mobile organization:

- Tools: Chess Clock, Game Review, Engine Analysis.
- Games: Online Tournaments, Puzzles.
- Do not show tournament cards directly on Games; show them inside Online
  Tournaments.
- Online tournament cards need an obvious Online indicator.

Mobile hosted play:

- Finds games assigned to the signed-in profile.
- Opens the tournament game detail board.
- Rotates automatically for Black.
- Polls canonical state.
- Shows live clocks and disables input outside the player's turn.
- Shows the 20-second pre-game countdown.
- Includes board history navigation.

Mobile completed-event media:

- Gallery can view images/videos.
- Viewer supports navigation/swipe.
- Download must save through the app/device flow, not send the user to a web
  download page.

At the handoff moment `adb devices -l` showed no connected device, so commit
`c20c8c3` was not installed on a phone. The code passed Flutter analyze/tests,
but the next mobile change should be installed and visually checked when a
device/emulator is available.

## 18. Registration And Attendance

Registration:

- Player taps Register once.
- UI immediately shows loading/progress to prevent repeat taps.
- `player-actions` creates at most one registration per player/tournament.
- Admin sees the registration queue only in Upcoming.
- Admin can accept, waitlist, cancel/reject according to current controls.
- Admin can also Add Participant from the management screen.
- Player management supports real deletion through the server, with safety
  checks for historical tournament/admin data.

Attendance confirmation:

- Accepted registrations receive a one-hour pre-event Yes/No attendance
  request.
- In-app response is supported.
- Secure email links use `attendance-actions`.
- Raw attendance tokens are never stored.
- Email/push delivery depends on configured Appwrite providers and secrets.
- Do not describe provider-dependent push/email as guaranteed when providers
  are not configured.

## 19. Completed Tournament Media

Storage bucket: `tournament-assets`.

Admin Completed tournament media supports:

- Upload photos/videos
- View files
- Delete individual files
- Select multiple/all
- Sort/filter by name/date/type where implemented
- Tags and tag updates

Public web/mobile Completed tournament adds Photos after tournament data tabs:

- View full media
- Navigate/swipe through gallery
- Download original file

The UI and storage row/file cleanup must stay synchronized so deleting media
actually releases storage.

## 20. Announcements, Broadcasts, News, And Admin Access

Admin navigation includes Admin Access after Announcements.

Admin Access:

- Separate admin profiles and teams.
- Super-admin-only create/suspend controls.

Announcements/broadcast intent:

- Audience selection should be All Users or participants in an Upcoming/Active
  tournament.
- Club Members and Specific Players audience choices were explicitly removed.
- Channel selection should allow any combination of App, Email, and SMS.
- A tournament audience button may expand to let the organizer select the
  tournament.

Check the actual implementation before claiming every broadcast channel is
fully delivered; provider integrations may still be incomplete.

Player Management email is implemented in source and in the active
`admin-actions` deployment:

- An organizer can open the branded email composer from one player's row or
  profile.
- Multiple selected players can be emailed from the selection toolbar.
- Subject and message content are validated server-side and escaped into the
  JuChess burgundy, cream, black, and gold HTML email template.
- Recipient account IDs are resolved only from `profile_private`; email
  addresses and provider credentials are never sent back as delivery data.
- Appwrite Messaging receives one private email message targeted by user ID,
  and the action is recorded in `admin_audit` without storing the message body.
- After the first Gmail test showed a delayed crest, the shared email-only logo
  was reduced from 45,141 bytes at 220x220 to 16,950 bytes at 120x120. Player
  emails still render it at 72x72. A temporary burgundy `JU` fallback was tried,
  then removed at the user's request so the original transparent crest style,
  spacing, and `JuChess` alt text are restored while retaining the smaller file.
- Production now has the enabled Appwrite Messaging provider `JuChess Resend`.
  Its active Resend credential is send-only and restricted to `juchess.page`;
  Appwrite stores it server-side. A superseded setup key was revoked during
  configuration, and no provider secret is stored in the repository.
- Four user-confirmed production test emails were sent through Appwrite
  Messaging on July 16, 2026; all four reported `status: sent` and
  `deliveredTotal: 1`. The recipient address is intentionally not stored in
  this handoff. The user confirmed the first Gmail render, requested the
  crest-loading optimization, then requested the original transparent style
  again. The restored-style follow-up awaits Gmail feedback; reply-to behavior
  also remains unconfirmed.
- A live bulk verification resend was triggered on July 16, 2026 for all seven
  accounts that Appwrite reported as `emailVerification: false`. Each resend
  used a newly created short-lived user session so Appwrite could issue its
  canonical seven-day verification link, and all seven temporary sessions were
  deleted immediately afterward. Appwrite subsequently reported all seven
  accounts as verified and zero remaining unverified accounts; individual inbox
  delivery was not independently confirmed.

## 21. Game Review And Analysis

Web implementation:

- `GamesPage.tsx` hosts review and analysis modes.
- Stockfish 18 lite runs in the browser.
- Engine strengths: Quick, Balanced, Deep, Maximum.
- PGN and FEN parsing use `chess.js`.
- Review is scoped to the exact selected game identity.
- Switching games cancels/disposes the previous engine session.
- Move classifications include Brilliant, Great, Book, Best, Excellent, Good,
  Inaccuracy, Mistake, Miss, Blunder, and Forced.
- Accuracy, evaluation graph, critical move points, game rating, and
  Opening/Middlegame/Endgame summaries exist.
- Critical graph points should jump to the corresponding move.
- Review markers/colors must match the screenshot-driven icon system.

Mobile has corresponding review/import/analysis flows and tests.

Important honesty boundary:

- Game Rating is JuChess's heuristic estimate, not an official Chess.com rating
  or a FIDE performance rating.
- Move classification is Stockfish-based but depends on selected depth,
  position cache, device speed, and heuristic thresholds.
- Review can be slow, especially Deep/Maximum and on mobile.
- Evaluation must always be normalized to White's perspective before rendering
  the evaluation bar.

Known import limitation:

- Chess.com currently loads recent archives until 20 games.
- Lichess currently calls `max=20`.
- The user's request for all history/pagination is not implemented yet.
- Implement pagination/lazy loading rather than attempting an unbounded import
  that freezes the client or violates provider limits.

Profile usernames:

- `profiles` includes `chessComUsername` and `lichessUsername`.
- Successful provider username use should remain linked to the signed-in
  profile.
- Profile tournament history should use real internal game rows.

## 22. Backend Function Routes

### `admin-actions`

Major route groups:

- Admin session/admin management
- Blocks and unblock actions
- Tournament create/update/delete/lifecycle
- Publish/unpublish pairings
- Add participants and registration status
- Attendance reads
- Procedure configure/start/PGN/result
- Round advancement
- Player profile role/status/delete
- Announcements
- Hosted online-game active game, sync, move, resign, chat, fair-play

Read route handling near the bottom of
`appwrite/functions/admin-actions/src/main.js` before changing contracts.

### `player-actions`

- Health
- Owner profile load/update
- Register for tournament
- Cancel registration
- Attendance response entry
- Recruitment application load/submit/withdraw

### `attendance-actions`

- Health
- Resolve secure attendance token
- Respond through secure attendance token

### `access-guards`

- Health
- `POST /check` for identity/IP admission

When adding a field, update all of these where relevant:

1. `appwrite/schema.json`
2. additive migration script
3. Function validation/write
4. web/admin TypeScript types and mappers
5. Flutter model/mapping
6. tests
7. deploy Function and verify schema/deployment readiness

## 23. Local Commands

From repo root:

```powershell
npm install
npm run dev:web
npm run dev:admin
npm run build:web
npm run build:admin
npm run build:pages
npm run check:email-templates
npm run check:functions
npm run test:functions
npm run test:engine
npm run check:web
npm run check:admin
npm run mobile:analyze
npm run mobile:test
```

Full check command:

```powershell
npm run check:all
```

On this Windows machine, a July 13 `check:all` run reached `mobile:test` and
then hung without returning output. It was terminated. Prefer the individual
commands above if the aggregate runner hangs; do not leave child Flutter/Node
processes running.

Run web locally on a phone-visible address when needed:

```powershell
npm --workspace apps/web run dev -- --host 0.0.0.0 --port 8062
```

Flutter with Appwrite:

```powershell
cd apps/mobile
flutter run -d <DEVICE_ID> `
  --dart-define=APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 `
  --dart-define=APPWRITE_PROJECT_ID=juchess-platform `
  --dart-define=APPWRITE_DATABASE_ID=juchess `
  --dart-define=APPWRITE_ACCESS_GUARD_FUNCTION_ID=access-guards
```

Wi-Fi Android workflow:

```powershell
adb devices -l
adb pair <PHONE_IP>:<PAIR_PORT>
adb connect <PHONE_IP>:<ADB_PORT>
flutter devices
flutter run -d <DEVICE_ID> ...
```

Do not assume old device ID `RZCW30XCC4Z` is connected. Discover the device
each time.

## 24. Deployment Commands

Build and publish GitHub Pages:

```powershell
npm run build:pages
git status --short
git add <only the source and generated files for this change>
git commit -m "<specific message>"
git push origin main
```

`scripts/build-pages.mjs` intentionally retains prior hashed assets so cached
clients do not receive 404s while GitHub Pages updates. Do not casually delete
old bundles.

Redeploy admin/tournament backend:

```powershell
appwrite functions create-deployment `
  --function-id admin-actions `
  --code appwrite/functions/admin-actions `
  --activate true `
  --entrypoint src/main.js `
  --commands "npm install"
```

Equivalent commands apply to `player-actions`, `attendance-actions`, and
`access-guards` with their own source folders.

After deployment, poll/get the deployment until `status=ready`. Do not report a
waiting/building deployment as complete.

Available migrations:

- `npm run migrate:procedure`
- `npm run migrate:online-tournaments`
- `npm run migrate:registration-integrity`
- `npm run migrate:attendance`
- `npm run migrate:game-query-indexes`
- `npm run migrate:tournament-live`
- `npm run migrate:profile-usernames`
- `npm run migrate:registration-deadline`
- `npm run migrate:recruitment`
- `npm run migrate:profile-privacy`

`migrate:profile-privacy` is a two-stage migration. Production finalization ran
successfully on July 16, 2026; reruns must remain idempotent and must never
recreate private columns on `profiles`.

Migrations are additive and should be repeatable. Read the script before
running it against production.

## 25. Latest Verified Behavior

At commit `84c6d0f`, profile completion now safely releases a phone number
reserved by a private profile only when Appwrite confirms that the former
account no longer exists. Active accounts still retain exclusive ownership.
The release and the completing player's public/private updates are staged in
one Appwrite transaction. `player-actions` now has the minimum additional
`users.read` runtime scope needed for that account-existence check.

- Function syntax checks and all 21 Function tests passed.
- `player-actions` deployment `6a593e77c824110fdeb3` is ready, active, and
  live with execution permission `users` and runtime scope `users.read`.
- The production completion form reproduced the prior duplicate error before
  deployment. After deployment, the same signed-in submission returned HTTP
  200, persisted the completed private profile, cleared the orphaned phone
  reservation, and `/complete-profile` redirected to the rendered `/profile`
  page after a fresh load with no alert.

At commit `298e040`, the July 16 OAuth/privacy release passed and was verified
in production:

- `check:web`: lint/build plus 34 tests
- `check:admin`: lint/build, 3 wizard tests, and 62 backend/engine tests
- `check:functions` and 16 Function tests
- Flutter analyze and all 23 Flutter tests
- Release APK built at
  `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (244.1 MB)
- GitHub Pages deployment for `298e040` completed successfully; live web/admin
  HTML references the expected release bundles
- `admin-actions` deployment `6a5804c4e80f7913e518` and `player-actions`
  deployment `6a5804c43a59bae2fb6d` are ready and active
- A real Google OAuth retry reached `/complete-profile`; the new production
  `player-actions GET /profile` execution returned HTTP 200 instead of the
  previous HTTP 401
- The privacy migration moved 14 identity rows to `profile_private`, removed
  the four private columns and three related indexes from `profiles`, and left
  all public rows read-only
- Anonymous production reads returned 13 safe public rows and zero private
  rows; the authenticated completion screen still loaded after finalization

No Android/iOS device was connected, so the APK was not installed or visually
verified on a physical device.

The July 16 Player Management email implementation passed before commit:

- Admin lint and production build
- Three tournament-wizard tests and 65 admin Function/engine tests, including
  three email validation/template/private-recipient tests
- Function syntax checks and 16 player/attendance/access Function tests
- Desktop rendered composer interaction with no console warnings/errors
- A 390x844 phone render showing the stacked, scrollable composer
- Optimized player-email crest rendered at 72x72 from the 120x120 source,
  survived reload, and produced no browser warnings/errors
- GitHub Pages run `29508455594` succeeded and the production crest matched the
  16,950-byte source asset exactly
- Restored original transparent crest markup rendered with no forced background
  or rounding, survived reload, and produced no browser warnings/errors
- `admin-actions` deployment `6a590cc75b48c61da74b` reached ready and active

The Appwrite Messaging provider `JuChess Resend` was subsequently created and
verified enabled through Appwrite. The first user-confirmed branded production
test reached `status: sent` with one delivery; the recipient confirmed Gmail
rendering and reported only the crest's initial loading delay. After the asset
optimization, two more user-confirmed emails also reached `status: sent` with
one delivery each. The original transparent crest markup was then restored at
the user's request, and a fourth restored-style test also reached `status: sent`
with one delivery. Its Gmail rendering and reply-to behavior await confirmation.

At commit `31179d1`, the latest authentication work passed:

- Web lint and production TypeScript/Vite build
- All 33 current web review/import/board/helper tests
- Both branded email templates passed local validation
- GitHub Pages production bundle built successfully
- `https://juchess.page/verify-email` loaded the deployed JuChess verification
  screen with the expected email and sign-in return action
- Appwrite accepted the Resend SMTP configuration
- Appwrite saved both branded English verification and recovery templates

The real-email send, inbox rendering, verification click, verified sign-in,
recovery send, and password reset remain to be tested with a user-confirmed
recipient. Do not convert the configuration checks above into a false
end-to-end claim.

The invalid/expired verification-link recovery screen was added on July 16,
2026. Local web lint, production build, and all 40 current web tests passed.
Rendered desktop and 390x844 checks confirmed the error copy, credential-backed
resend form, native required-field validation, full-width mobile action, no
horizontal overflow, and no browser console warnings/errors. A real resend was
not triggered during UI QA because that requires the affected player's actual
credentials and sends an external email.

At commit `c20c8c3`, the tournament/board checks below had passed:

- Function JavaScript syntax checks
- 56 tournament engine/workflow tests
- Web lint/build and 17 review/import/stored-move tests
- Admin lint/build, 3 wizard tests, and engine tests
- Flutter analyze
- 23 Flutter tests
- Appwrite `admin-actions` deployment reached ready
- Published web page loaded with meaningful content and no console warnings or
  errors
- Flip Board changed orientation from `a8...h1` to `h1...a8` correctly
- The tournament-board auto-update label was removed

Earlier live production tests also verified:

- Two-player online move sequence and alternating server clocks
- Current-game lock when another match starts
- Public standings auto-update without full page reload
- Admin tournament counts/state auto-update without full page reload

Re-run the relevant flow after any related code change. Old evidence is not a
substitute for new verification.

## 26. Known Gaps And Risks

These are real limitations, not optional wording issues:

1. Web tournament tabs still include a redundant Games tab, unlike mobile and
   the latest compact tournament-tab intent.
2. Team format does not yet have a full team/roster/board/match-point engine.
3. Arena is rolling Swiss-like, not a complete continuous Arena implementation.
4. Chess.com/Lichess import is limited to 20 recent games; full history needs
   pagination/lazy loading.
5. Stockfish review performance can be slow on Deep/Maximum and mobile.
6. Game Rating is heuristic, not an official external-provider rating.
7. Fair-play telemetry is not a complete anti-cheat system and must not be
   presented as proof of cheating.
8. External Chess.com/Lichess tournament options do not provide JuChess-hosted
   board/clock authority.
9. Admin `App.tsx` and mobile `main.dart` are very large; refactoring is useful
   only if behavior and prototype fidelity remain unchanged.
10. Some docs such as `docs/PROJECT_STATUS.md` and parts of
    `docs/appwrite-schema.md` are older than the live implementation. Use
    `appwrite/schema.json`, source code, deployment status, and this handoff.
11. The latest mobile board/pre-game change has not been visually installed on
    a phone because no adb device was connected at handoff time.
12. Player Management email delivery code is deployed and the send-only,
    `juchess.page`-restricted `JuChess Resend` provider is enabled. One
    user-confirmed production test reached Appwrite `sent` status with one
    delivery, but Gmail inbox rendering and reply-to remain unconfirmed.
    Email/SMS/Push announcement broadcast delivery also remains incomplete.
13. The verification/recovery provider is configured, but a real inbox flow has
    not yet been completed. This is the highest-priority auth verification gap.
14. Email verification is currently implemented on the web client. Audit the
    Flutter sign-up/sign-in flow before assuming mobile enforces the identical
    verification gate and branded callback experience.

## 27. Recommended Next Work

Do not start this list blindly; the user's newest request always wins. If the
new chat asks for general continuation, use this order:

1. Obtain the recipient's confirmation of the Player Management test email's
   Gmail rendering and reply-to behavior. Then, with explicit confirmation,
   run one real web sign-up verification and password-recovery flow, confirming
   branding, links, verified sign-in, expired/used-link behavior, and the
   unverified-account gate. Do not expose credentials while testing.
2. Bring mobile auth to the same verification contract and test on a connected
   device.
3. Reconcile public web tournament tabs with the mobile/product contract and
   verify all formats.
4. Install the current Flutter app on a connected device and verify board flip,
   Black orientation, clocks, and 20-second pre-game countdown with two real
   player accounts.
5. Run a complete six-player JuChess-hosted Swiss tournament end to end:
   registration, publish, activation, four rounds, live play, standings,
   completion, photos.
6. Add provider-history pagination/lazy loading for Chess.com and Lichess.
7. Profile and optimize Stockfish review without reducing default accuracy.
8. Implement a real Team data model/engine only after agreeing on team rules.
9. Upgrade Arena only after specifying scoring, streaks, re-pair interval,
   withdrawals, late join, and finish conditions.
10. Split large admin/mobile files incrementally with tests, not as an unrelated
   rewrite.

## 28. Working Style For The Next AI

For every task:

1. Read the newest user message twice.
2. Inspect `git status` and current source.
3. Identify whether the change affects web, admin, mobile, backend, schema, or
   more than one surface.
4. Trace the canonical data flow before editing UI.
5. State a short implementation update.
6. Make focused edits; preserve unrelated work.
7. Add/adjust tests proportional to risk.
8. Run relevant checks.
9. Deploy the backend if server behavior changed.
10. Build/push Pages if web/admin changed.
11. Install mobile if mobile changed and a device exists.
12. Verify the real rendered behavior, including mobile viewport where relevant.
13. Report exactly what passed, what was deployed, and what remains unverified.

Do not respond to an implementation request with only a plan. Do not solve a
backend consistency bug with mock UI. Do not call something real-time when it
updates only after a full refresh. Do not regenerate published pairings on a
client. Keep working until the requested behavior is genuinely handled or a
specific external blocker remains.
