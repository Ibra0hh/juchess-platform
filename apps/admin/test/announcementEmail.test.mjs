import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAnnouncementRecipientEmails } from '../src/lib/announcementEmail.ts'

test('specific announcement emails normalize, deduplicate, and accept common separators', () => {
  assert.deepEqual(
    parseAnnouncementRecipientEmails(' Player@One.Example,second@example.com\nPLAYER@one.example; third@example.com '),
    {
      emails: ['player@one.example', 'second@example.com', 'third@example.com'],
      invalid: [],
    },
  )
})

test('specific announcement emails expose malformed entries before submission', () => {
  assert.deepEqual(parseAnnouncementRecipientEmails('valid@example.com, missing-at, @example.com'), {
    emails: ['valid@example.com'],
    invalid: ['missing-at', '@example.com'],
  })
})
