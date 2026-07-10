# Handoff to Codex — 9 Jul 2026

Written by Claude. We are both working on this repo, so this describes exactly
what changed, what is now load-bearing, and what I deliberately left for you.

**Read the "Do not break these" section before touching registrations, check-in,
or the tournament engine.** Two of those invariants are security properties, not
style preferences.

Commits: `08d7c10` (this work), `5827342`, `fd93df5`.

---

## 1. Security: registration and check-in are now server-owned

This was the most serious problem in the project and it is fixed. Please do not
undo it by reintroducing client-side writes.

**What was wrong.** The `registrations` table had table-level `read("any")` and
`create("users")`. Verified anonymously, with no API key and no login:

```
read registrations -> 200 ALLOWED, 161 rows
  profileId=seed_profile_01 | status=confirmed | checkInCode=KO01
```

Every player's check-in code was public, and codes were sequential. Worse, any
signed-in user could POST a registration row with another player's `profileId`
and `status: "confirmed"`. The "pending until an organizer approves" rule — the
core product requirement — was enforced only by client code that anyone could
bypass with curl.

**What it is now.**

| Concern | Before | Now |
| --- | --- | --- |
| Create a registration | client `createRow` | `player-actions` function only |
| Who sets `profileId` | client | server, from the session JWT |
| Who sets `status` | client | server, always `pending` |
| Where the code lives | `registrations.checkInCode` (public) | `check_ins` table (no public read) |
| Who can read a code | anyone | the owning account, and staff via `admin-actions` |

- **New function `appwrite/functions/player-actions/`** (`execute: ["users"]`).
  Routes: `POST /registrations`, `POST /registrations/:id/cancel`. It resolves
  the caller's profile from the JWT, refuses cancellation of rows the caller
  does not own, and deletes the check-in row on cancel.
- **New table `check_ins`**: `rowSecurity: true`, table permissions `[]`. Each
  row carries `read("user:<accountId>")`. Columns: `tournamentId`, `profileId`,
  `registrationId`, `code`, `checkedIn`, `checkedInAt`.
- `admin-actions` issues the code on confirm (`issueCheckInCode`) and deletes it
  on any non-confirmed status (`revokeCheckInCode`). It never writes
  `registrations.checkInCode` again — that column is now always `null`.
- New route `GET /tournaments/:id/check-ins` so staff can see codes.
- **Migration already run against production**: all 161 exposed codes were
  rotated into `check_ins` and the public column nulled.

Verified anonymously after the change:

```
read registrations -> checkInCode: null
read check_ins     -> 0 rows
forge a confirmed registration -> 401 DENIED
```

### Do not break these

1. **Never call `tablesDB.createRow`/`updateRow` on `registrations` from a
   client.** It will 401. Use `player-actions`. Web: `apps/web/src/lib/registrations.ts`.
   Mobile: `_runPlayerAction` in `main.dart`.
2. **Never write a check-in code into `registrations`.** The table is world-readable.
3. **Do not add `read("any")` to `check_ins`.**
4. `registrations` keeps `read("any")` on purpose — the public Players tab and
   participant counts depend on it. That is fine now that no secret lives there.

### Known gap (yours if you want it)

`registrations.checkInCode` still exists as a column, always null. Dropping it is
safe once you have confirmed nothing reads it. I left it rather than run a
destructive schema change.

---

## 2. The tournament engine is the single source of truth

All round progression lives server-side in `appwrite/functions/admin-actions/src/main.js`,
in `advanceTournamentIfReady`. It runs automatically after every completed game
result and manually via `POST /tournaments/:id/rounds/next` ("Advance round").

Per format: Swiss score-group pairing with rematch avoidance, colour balancing
and rotating full-point byes; round robin round gating; single and double
elimination derived structurally from a frozen entrant list (byes, losers
bracket, grand final, bracket reset); multi-stage cutover seeding the top 8 from
real standings; arena rolling re-pairing.

Proven live against production: a 20-player Swiss and a 16-player double
elimination were played end to end. Rounds paired themselves, standings updated,
and the public site matched the admin.

**The snapshot is authoritative.** `advanceKnockout` regenerates
`tournament.bracketSnapshot` from real results on every advancement, with
`version: 2` and correct play-order labels
(`Quarterfinal Qualifier → Quarterfinal → … → Final`).

This is where a real bug came from, so it matters: the web app used to prefer a
**client-side bracket generator** over the snapshot. It fabricated a Grand Final
between Ibrahim Ahmad and "Khaled Mansour" while the backend recorded the true
result (Ibrahim vs Omar Saleh). Fixed in `TournamentDetailPage.tsx`:

```ts
// snapshot first — the generator only guesses
const bracketConfig = savedBracketConfig ?? gameBracketConfig
```

and both web and mobile now **trust `version >= 2` snapshot labels** instead of
re-deriving them.

### The refactor I did not do — please take it

**Bracket and pairing logic is implemented four times**: server, admin, web, and
mobile. 57 occurrences of the same primitives (`bracketRoundCode`,
`isPlayableMatch`, `buildRoundRobinSchedule`, lower-bracket labelling) across
four files. Four engines, four opinions — that is what produced the phantom
finalist above.

Now that the server maintains the snapshot live, **the three client generators
are redundant and actively dangerous**. Deleting them removes a whole class of
divergence bug. I did not do it because you are editing `main.dart` and
`TournamentDetailPage.tsx` right now and it would have been a merge disaster.
It is the highest-value refactor left.

---

## 3. Tests and CI

**The only test in the repo was failing, and nothing noticed**, because
`flutter analyze` is green while `flutter test` is red, and there was no CI.
I was guilty of this too: I reported "analyze: no issues" all session without
running the tests.

- `apps/mobile/test/widget_test.dart` asserted on `EmptyTournamentCard` — dead
  code, orphaned when the home screen moved to `HomeTournamentCarousel` — and on
  guest-banner copy that had drifted. Fixed, plus new coverage for
  `buildHomeTournamentSlots`. **5/5 pass.**
- `appwrite/functions/admin-actions/test/engine.test.mjs` — **11 tests**, the
  first real coverage of the tournament engine. It loads `src/main.js` with the
  Appwrite SDK stubbed out and exercises the pure logic: seeding, byes,
  single/double elimination structure and play order, losers labels, Swiss
  pairing, bye rotation, rematch avoidance.

```
npm run test:engine       # 11 pass
npm run mobile:test       # 5 pass
npm run check:functions   # syntax-check all three functions
```

### You need to add the CI workflow

`.github/workflows/ci.yml` **exists in the working tree but is not committed** —
GitHub rejected the push because my token lacks the `workflow` OAuth scope:

```
! [remote rejected] refusing to allow an OAuth App to create or update
  workflow .github/workflows/ci.yml without `workflow` scope
```

Please commit it (your token may have the scope, or add it via the GitHub web
UI). It runs lint, both builds, function syntax checks, engine tests, and
`flutter analyze` **and** `flutter test`. The last one is the point: analyze
alone hid a red test for weeks.

---

## 4. Fabricated data: some removed, plenty left

Removed from the admin:

- Dashboard "248 players" (hardcoded in three places) → real profile count (25).
- "+12 this month" → gone; it was invented.
- Pending registrations `7` → real count (0).
- The "Recent activity" feed (`Swiss - Round 3 pairings generated · By Amina
  Osei · 12m ago`) → derived from real tournament rows.
- The "Disputed results" panel — Rahimi, Carter, Tan, Nair, Rossi, Bianchi are
  not club members and no dispute feature exists → replaced with the real
  pending-registration queue.
- Player Management showed **6 demo players ("6 of 248")** → now lists the **25
  real profiles**, with the `system_bye` sentinel filtered out.

Still fabricated, if you want it (counts are `grep` hits):

| File | Hits |
| --- | --- |
| `apps/mobile/lib/main.dart` | 39 |
| `apps/web/src/screens/TournamentDetailPage.tsx` | 15 |
| `apps/web/src/lib/juchess.ts` | 9 |

Notably the **web leaderboard renders a hardcoded `members` array**, not real
profiles. If you wire it up, **filter out `system_bye`** (constant exported as
`SYSTEM_BYE_PROFILE_ID` from `apps/admin/src/lib/adminData.ts`).

### About `system_bye`

Swiss needs a stand-in opponent because `games.blackProfileId` is `required`.
`ensureSystemByeProfile` used to run on *every* activation, so it created a
"Bye" profile (rating 0, publicly readable) even for even-numbered fields that
never need one. It is now created lazily, only when a bye is actually written.
I deleted the stray row after confirming zero games referenced it.

---

## 5. Things you should know about how I work in this repo

- **I once committed your uncommitted work by accident.** Commit `fd93df5`
  contains `HomeTournamentCarousel`, which I did not write — I ran
  `git add apps/mobile` and swept up your working tree. I am sorry; it also
  means that commit's message does not describe everything in it.
- **This time I staged file-by-file.** Your four in-progress CSS files
  (`SiteHeader.css`, `ClubScreens.css`, `TournamentDetailPage.css`,
  `TournamentsPage.css` — you are scoping global selectors under
  `.tournaments-screen`) were **stashed, excluded from the build, and restored**
  so the shipped `docs/` bundle contains only committed source. They are
  untouched in your working tree.
- **`docs/` is the deployed GitHub Pages bundle.** After your CSS lands, run
  `npm run build:pages` and commit `docs/` or the live site will not show it.
- **Deploying functions**: the Appwrite CLI hangs on an interactive prompt in
  this environment even with `--force`. Use the REST API
  (`POST /functions/:id/deployments`, multipart, `activate=true`). Both
  `admin-actions` and `player-actions` are deployed and READY.

---

## 6. Backend state right now

| Tournament | Status |
| --- | --- |
| DT (double elimination, 16p) | completed, 11/11 — a real played-out bracket |
| Swiss (20p) | active, round 3/7 |
| Single elimination | upcoming, but `currentRound: 1` (stale, pre-existing) |
| 6 others | upcoming, untouched |

The Swiss and DT hold results from my live engine tests. `npm run seed:appwrite-demo`
resets the eight `seed_tour_*` tournaments and leaves DT alone. **The seed script
was broken** — a temporal-dead-zone crash, `Cannot access 'Permission' before
initialization`, because the row arrays call `Permission.read()` while the module
body evaluates but the SDK was destructured 240 lines later. Fixed in `5827342`;
always `--dry-run` first.

---

## 7. Suggested order for you

1. **Commit `.github/workflows/ci.yml`** (I cannot).
2. **Delete the three client bracket generators**; render only from the
   server snapshot. Highest-value refactor; removes a bug class.
3. Finish the CSS scoping, then `npm run build:pages` and commit `docs/`.
4. Kill the remaining fabricated data, starting with the web leaderboard.
5. Split `main.dart` (**10,122 lines**, ~30% of all source) and `App.tsx`
   (4,985). Not urgent, but every session pays for these.
6. Real notifications (FCM / Appwrite Messaging). The product spec calls for
   "you're accepted" and "rounds are published" pushes; today those states are
   only surfaced in-app.
