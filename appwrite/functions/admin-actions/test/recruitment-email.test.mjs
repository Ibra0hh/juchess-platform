import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecruitmentEmail, recruitmentEmailAction } from '../src/main.js';

test('decision copy matches the recruitment status and track', () => {
  const input = { track: 'leader', name: 'QA Applicant' };
  const invite = buildRecruitmentEmail({ ...input, status: 'interview', interviewAt: '2030-11-24T12:00:00Z' });
  const rescheduled = buildRecruitmentEmail({ ...input, status: 'interview', interviewAt: '2030-11-25T12:00:00Z' });
  assert.match(invite.message, /Team Leader/);
  assert.match(invite.message, /24 November 2030.*3:00.*Amman time/);
  assert.notEqual(invite.message, rescheduled.message);
  assert.match(buildRecruitmentEmail({ ...input, status: 'accepted' }).message, /has been accepted/);
  assert.match(buildRecruitmentEmail({ ...input, status: 'rejected' }).message, /not be moving forward/);
  assert.throws(() => buildRecruitmentEmail({ ...input, status: 'interview' }), /choose an interview date/i);
});

function fixtures() {
  const application = { $id: 'application', profileId: 'profile', accountId: 'account', status: 'interview' };
  const savedAt = '2099-11-24T12:00:00Z';
  const sent = new Map();
  const context = {
    tablesDB: {
      async listRows({ tableId }) {
        return { rows: tableId === 'profiles'
          ? [{ $id: 'profile', displayName: '<QA>' }]
          : [{ $id: 'profile', accountId: 'account', email: 'qa@example.com' }] };
      },
      async getRow() { return { interviewAt: savedAt }; },
      async createRow() {},
    },
    databaseId: 'juchess',
    users: {
      async get() { return { $id: 'account', email: 'qa@example.com', emailVerification: true }; },
      async listTargets() { return { targets: [{ $id: 'verified-email', identifier: 'qa@example.com' }] }; },
    },
    messaging: {
      async listProviders() { return { providers: [{ name: 'mail' }] }; },
      async createEmail(email) {
        if (sent.has(email.messageId)) throw Object.assign(new Error('duplicate'), { code: 409 });
        sent.set(email.messageId, email);
        return { $id: email.messageId, status: 'processing' };
      },
    },
    application,
    actor: { $id: 'reviewer' },
  };
  return { context, savedAt, sent };
}

test('preview sends nothing and confirmation only queues the exact saved email once', async () => {
  const { context, savedAt, sent } = fixtures();
  const preview = await recruitmentEmailAction({
    ...context, body: { status: 'interview', interviewAt: savedAt },
  });
  assert.equal(preview.to, 'qa@example.com');
  assert.equal(sent.size, 0);
  await assert.rejects(recruitmentEmailAction({
    ...context, send: true, body: { status: 'accepted', previewId: preview.previewId },
  }), /save this decision/i);
  await assert.rejects(recruitmentEmailAction({
    ...context, send: true, body: { status: 'interview', previewId: 'stale' },
  }), /refresh the preview/i);
  assert.equal(sent.size, 0);
  const request = { ...context, send: true, body: { status: 'interview', previewId: preview.previewId } };
  const queued = await recruitmentEmailAction(request);
  const email = sent.get(queued.messageId);
  assert.equal(queued.deliveryStatus, 'processing');
  assert.deepEqual(email.targets, ['verified-email']);
  assert.equal(email.users, undefined);
  assert.equal(email.subject, preview.subject);
  assert.match(email.content, /&lt;QA&gt;/);
  assert.doesNotMatch(email.content, /<QA>/);
  await assert.rejects(recruitmentEmailAction(request), /already submitted/i);
  assert.equal(sent.size, 1);
});
