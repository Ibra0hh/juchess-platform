import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREW_INTERESTS,
  crewApplicationRowId,
  validateCrewApplication,
} from '../src/main.js';

test('crew application row IDs are deterministic and Appwrite-safe', () => {
  const first = crewApplicationRowId('profile-123');
  assert.equal(first, crewApplicationRowId('profile-123'));
  assert.match(first, /^crew_[a-f0-9]{32}$/);
  assert.notEqual(first, crewApplicationRowId('profile-456'));
});

test('crew application validation normalizes interests and content', () => {
  const value = validateCrewApplication({
    interests: ['Software', 'design', 'software', 'not-real'],
    skills: '  I build accessible React applications and APIs.  ',
    contribution: ' I can improve the club website and tournament tools. ',
    developmentGoals: ' Learn product leadership. ',
    availability: '4-6 hours per week',
    portfolioUrl: 'https://example.com/work',
  });

  assert.deepEqual(value.interests, ['software', 'design']);
  assert.equal(value.skills, 'I build accessible React applications and APIs.');
  assert.equal(value.portfolioUrl, 'https://example.com/work');
  assert.equal(value.track, 'member');
  assert.ok(CREW_INTERESTS.includes(value.interests[0]));
});

test('crew applications persist the selected track and reject unknown types', () => {
  const application = {
    interests: ['events'],
    skills: 'I have organized and led a university event team.',
    contribution: 'I would coordinate volunteers and set goals for each event.',
    availability: '3-5 hours per week',
  };
  assert.equal(validateCrewApplication({ ...application, track: 'leader' }).track, 'leader');
  assert.equal(validateCrewApplication({ ...application, track: 'member' }).track, 'member');
  assert.throws(() => validateCrewApplication({ ...application, track: 'admin' }), /Team Member or Team Leader/);
});

test('crew application validation rejects unsafe links and empty detail', () => {
  assert.throws(() => validateCrewApplication({
    interests: ['design'],
    skills: 'too short',
    contribution: 'also too short',
    availability: 'weekends',
  }), /skills/i);

  assert.throws(() => validateCrewApplication({
    interests: ['design'],
    skills: 'I create visual systems for student organizations.',
    contribution: 'I can design event campaigns and reusable templates.',
    availability: 'weekends',
    portfolioUrl: 'javascript:alert(1)',
  }), /http/i);
});
