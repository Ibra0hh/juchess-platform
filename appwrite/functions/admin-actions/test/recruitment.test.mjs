import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CREW_APPLICATION_STATUSES,
  loadCrewApplications,
  normalizeCrewReviewInput,
} from '../src/main.js';

test('crew review input accepts the complete workflow', () => {
  for (const status of CREW_APPLICATION_STATUSES) {
    assert.equal(normalizeCrewReviewInput({ status }).status, status);
  }
});

test('crew review input trims notes and validates interview dates', () => {
  const value = normalizeCrewReviewInput({
    status: 'interview',
    internalNotes: '  Strong software portfolio.  ',
    assignedTo: ' HR Lead ',
    interviewAt: '2026-08-01T12:00:00.000Z',
  });
  assert.equal(value.internalNotes, 'Strong software portfolio.');
  assert.equal(value.assignedTo, 'HR Lead');
  assert.throws(() => normalizeCrewReviewInput({ interviewAt: 'not-a-date' }), /valid interview/i);
  assert.throws(() => normalizeCrewReviewInput({ status: 'approved-by-me' }), /valid application status/i);
});

test('crew application identities come from the private profile table', async () => {
  const rowsByTable = {
    crew_applications: [{
      $id: 'application-1',
      profileId: 'profile-1',
      status: 'submitted',
      updatedAt: '2026-07-15T20:00:00.000Z',
    }],
    crew_application_reviews: [],
    profiles: [{
      $id: 'profile-1',
      displayName: 'Visible Member',
      university: 'University of Jordan',
      rating: 1450,
      status: 'active',
    }],
    profile_private: [{
      $id: 'profile-1',
      profileId: 'profile-1',
      accountId: 'account-1',
      email: 'private@example.com',
      phone: '+962790000000',
      universityId: '20260001',
    }],
  };
  const tablesDB = {
    async listRows({ tableId }) {
      return { rows: rowsByTable[tableId] ?? [] };
    },
  };

  const applications = await loadCrewApplications(tablesDB, 'juchess');

  assert.equal(applications.length, 1);
  assert.deepEqual(applications[0].applicant, {
    id: 'profile-1',
    displayName: 'Visible Member',
    email: 'private@example.com',
    phone: '+962790000000',
    universityId: '20260001',
    rating: 1450,
    status: 'active',
    avatarFileId: '',
    coverFileId: '',
  });
});
