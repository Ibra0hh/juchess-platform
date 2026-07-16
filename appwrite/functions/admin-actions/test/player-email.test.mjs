import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPlayerEmailHtml,
  normalizePlayerEmailInput,
  resolvePlayerEmailRecipients,
} from '../src/main.js';

test('player email input deduplicates recipients and enforces content limits', () => {
  const input = normalizePlayerEmailInput({
    profileIds: [' player-1 ', 'player-1', 'player-2'],
    subject: '  Tournament   update  ',
    message: '  Round one starts at 5:00 PM.\r\nPlease arrive early.  ',
  });

  assert.deepEqual(input, {
    profileIds: ['player-1', 'player-2'],
    subject: 'Tournament update',
    message: 'Round one starts at 5:00 PM.\nPlease arrive early.',
  });
  assert.throws(() => normalizePlayerEmailInput({ profileIds: [], subject: 'Hello', message: 'Body' }), /select at least one/i);
  assert.throws(() => normalizePlayerEmailInput({ profileIds: ['p1'], subject: '', message: 'Body' }), /subject/i);
  assert.throws(() => normalizePlayerEmailInput({ profileIds: ['p1'], subject: 'Hello', message: '' }), /message/i);
  assert.throws(() => normalizePlayerEmailInput({ profileIds: ['p1'], subject: 'x'.repeat(121), message: 'Body' }), /120 characters/i);
  assert.throws(() => normalizePlayerEmailInput({ profileIds: ['p1'], subject: 'Hello', message: 'x'.repeat(5001) }), /5000 characters/i);
});

test('player email template keeps the JuChess theme and escapes admin content', () => {
  const html = buildPlayerEmailHtml({
    subject: 'Pairings <Final>',
    message: 'Hello & welcome\n<script>alert("no")</script>',
  });

  assert.match(html, /juchess-email-logo\.png/);
  assert.match(html, /alt="JU"/);
  assert.match(html, /border-radius:50%;background:#7d2434/);
  assert.match(html, /University of Jordan Chess Club/);
  assert.match(html, /#7d2434/);
  assert.match(html, /Pairings &lt;Final&gt;/);
  assert.match(html, /Hello &amp; welcome<br>&lt;script&gt;alert\(&quot;no&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('player email recipients are resolved only from private account identities', async () => {
  const rowsByTable = {
    profiles: [
      { $id: 'player-1', displayName: 'Amina Member', email: 'legacy-public@example.com' },
      { $id: 'player-2', displayName: 'No Email Member' },
    ],
    profile_private: [
      { $id: 'player-1', accountId: 'account-1', email: 'private@example.com' },
      { $id: 'player-2', accountId: 'account-2', email: '' },
    ],
  };
  const tablesDB = {
    async listRows({ tableId }) {
      return { rows: rowsByTable[tableId] ?? [] };
    },
  };

  const result = await resolvePlayerEmailRecipients(tablesDB, 'juchess', ['player-1', 'player-2', 'missing']);

  assert.deepEqual(result.recipients, [{ profileId: 'player-1', name: 'Amina Member', accountId: 'account-1' }]);
  assert.deepEqual(result.skipped, [
    { profileId: 'player-2', name: 'No Email Member', reason: 'No registered email address.' },
    { profileId: 'missing', name: 'missing', reason: 'Player profile was not found.' },
  ]);
  assert.equal(JSON.stringify(result).includes('private@example.com'), false);
  assert.equal(JSON.stringify(result).includes('legacy-public@example.com'), false);
});
