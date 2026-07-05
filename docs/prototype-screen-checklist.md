# JuChess Prototype Screen Checklist

This checklist freezes the prototype reference for implementation. A screen is
not complete until its real app version keeps the prototype layout, colors,
labels, density, navigation, and visible behavior.

## Web App

| Screen | Prototype | Data needed | User actions | Required states |
| --- | --- | --- | --- | --- |
| Home | `docs/prototypes/web/Home.dc.html` | featured tournament, upcoming tournaments, leaderboard preview, auth state | join club, sign in, open tournament, open sections | loading, signed out, signed in, no featured tournament |
| Tournaments | `docs/prototypes/web/Tournaments.dc.html` | tournaments list, status, format, location, participants | search, filter, list/grid toggle, open detail | loading, empty search, offline/fallback |
| Tournament Detail | `docs/prototypes/web/Tournament.dc.html` | tournament, rounds, games, standings, bracket when needed | switch tabs, register/check in, open game | loading, not found, no games, no standings |
| Games | `docs/prototypes/web/Games.dc.html` | current game, PGN moves, engine/quality labels, saved games | upload PGN, switch review/analysis, move navigation | loading, invalid PGN, no game selected |
| Leaderboard | `docs/prototypes/web/Leaderboard.dc.html` | ranked profiles, rating, points, streaks | filter/sort, open profile | loading, empty leaderboard |
| Profile | `docs/prototypes/web/Profile.dc.html` | profile, registrations, game history, rating summary | edit profile, sign out, open events | loading, guest, signed out, profile missing |
| Tools | `docs/prototypes/web/Tools.dc.html` | tool catalog, puzzle/analyzer metadata | open tool, use analyzer tools | loading, empty tools |
| Sign In | `docs/prototypes/web/Sign In.dc.html` | auth session state | sign in, forgot password, go sign up | invalid credentials, loading, signed in redirect |
| Sign Up | `docs/prototypes/web/Sign Up.dc.html` | auth/session, profile form | create account, go sign in | validation errors, pending approval |
| Forgot Password | `docs/prototypes/web/Forgot Password.dc.html` | auth endpoint | request reset email | invalid email, sent, rate limited |

## Admin App

| Screen | Prototype | Data needed | User actions | Required states |
| --- | --- | --- | --- | --- |
| Dashboard | `docs/prototypes/admin/ChessJU Admin.dc.html` | counts, pending queues, active tournaments | open admin modules | loading, unauthorized, empty dashboard |
| Tournaments | `docs/prototypes/admin/ChessJU Admin.dc.html` | tournaments, registrations, rounds | create/update/delete, publish, archive | validation errors, function failure |
| Players | `docs/prototypes/admin/ChessJU Admin.dc.html` | profiles, roles, status, registrations | approve, suspend, change role | pending, no players, permission denied |
| Games | `docs/prototypes/admin/ChessJU Admin.dc.html` | pairings, PGNs, results | submit result, publish pairings, edit PGN | no pairings, invalid result, function failure |
| Announcements | `docs/prototypes/admin/ChessJU Admin.dc.html` | announcements, audiences | publish/update/remove | draft, published, empty |

## Mobile And Tablet App

| Screen | Prototype | Data needed | User actions | Required states |
| --- | --- | --- | --- | --- |
| Home | `docs/prototypes/mobile/JuChess.mobile.dc.html` | featured tournament, quick actions, leaderboard preview | guest mode, open tabs, open tournament | loading, guest, signed in |
| Tournaments | `docs/prototypes/mobile/JuChess.mobile.dc.html` | active/upcoming/completed tournaments | tab filters, open tournament | loading, empty category |
| Games | `docs/prototypes/mobile/JuChess.mobile.dc.html` | current games, PGN review state | open board, upload/review PGN | invalid PGN, no games |
| Tools | `docs/prototypes/mobile/JuChess.mobile.dc.html` | tools list | open tool | loading, empty tools |
| Profile | `docs/prototypes/mobile/JuChess.mobile.dc.html` | profile, auth state, registrations | sign in/out, edit profile | guest, signed out, loading |

## Acceptance Rule

For every completed screen:

- desktop/mobile/tablet screenshots must be compared against the matching prototype;
- visible copy must match unless the product owner explicitly changes it;
- controls must have loading, empty, and error handling;
- Appwrite reads may fall back to local demo data, but admin writes must use the `admin-actions` Function.
