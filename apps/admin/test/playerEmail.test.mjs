import assert from 'node:assert/strict'
import test from 'node:test'
import { playerEmailLinkPreview } from '../src/lib/playerEmail.ts'

test('player email link preview accepts complete HTTP links and normalizes button text', () => {
  assert.deepEqual(
    playerEmailLinkPreview('  View   tournament  ', ' https://juchess.page/tournaments '),
    { text: 'View tournament', url: 'https://juchess.page/tournaments' },
  )
  assert.deepEqual(
    playerEmailLinkPreview('Open standings', 'http://example.com/standings'),
    { text: 'Open standings', url: 'http://example.com/standings' },
  )
})

test('player email link preview rejects incomplete or unsafe links', () => {
  assert.equal(playerEmailLinkPreview('', 'https://juchess.page'), null)
  assert.equal(playerEmailLinkPreview('Open', ''), null)
  assert.equal(playerEmailLinkPreview('Open', '/tournaments'), null)
  assert.equal(playerEmailLinkPreview('Open', 'javascript:alert(1)'), null)
  assert.equal(playerEmailLinkPreview('Open', 'https://user:secret@example.com'), null)
})
