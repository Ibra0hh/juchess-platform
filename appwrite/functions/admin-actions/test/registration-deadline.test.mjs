import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTournamentFormatLimits, validateTournamentRegistrationDeadline } from '../src/main.js';

test('a tournament deadline must precede the start, accounting for time zones', () => {
  const startsAt = '2026-07-12T13:00:00.000Z';
  assert.doesNotThrow(() => validateTournamentRegistrationDeadline(startsAt, null));
  assert.doesNotThrow(() => validateTournamentRegistrationDeadline(startsAt, '2026-07-12T15:59:00+03:00'));
  assert.throws(() => validateTournamentRegistrationDeadline(startsAt, '2026-07-12T16:00:00+03:00'), /before/);
  assert.throws(() => validateTournamentRegistrationDeadline(startsAt, '2026-07-12T17:00:00+03:00'), /before/);
  assert.throws(() => validateTournamentRegistrationDeadline(startsAt, 'bad'), /valid registration deadline/);
});

test('round robin field limits keep the full schedule within the atomic publish cap', () => {
  assert.doesNotThrow(() => validateTournamentFormatLimits('Round robin', 14));
  assert.throws(() => validateTournamentFormatLimits('Round robin', 15), /14 players/);
  assert.doesNotThrow(() => validateTournamentFormatLimits('Double round robin', 10));
  assert.throws(() => validateTournamentFormatLimits('Double round robin', 11), /10 players/);
  assert.doesNotThrow(() => validateTournamentFormatLimits('Arena', 20));
  assert.throws(() => validateTournamentFormatLimits('Arena', 20, { newFormat: true }), /not available/);
  assert.throws(() => validateTournamentFormatLimits('Team', 20, { newFormat: true }), /not available/);
});
