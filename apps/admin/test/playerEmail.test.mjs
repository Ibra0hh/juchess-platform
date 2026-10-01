import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizePlayerEmailLinkUrlInput,
  playerEmailLinkPreview,
  playerEmailLinkValidationMessage,
} from '../src/lib/playerEmail.ts'

test('player email link URLs accept pasted domains and preserve complete URLs', () => {
  assert.equal(normalizePlayerEmailLinkUrlInput(' juchess.page/tournaments '), 'https://juchess.page/tournaments')
  assert.equal(normalizePlayerEmailLinkUrlInput('http://example.com/path'), 'http://example.com/path')
  assert.equal(normalizePlayerEmailLinkUrlInput('not a link'), 'not a link')
})

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

test('player email link validation explains every incomplete state', () => {
  assert.match(playerEmailLinkValidationMessage('', ''), /button text and destination/i)
  assert.match(playerEmailLinkValidationMessage('', 'https://juchess.page'), /text/i)
  assert.match(playerEmailLinkValidationMessage('Open', ''), /page/i)
  assert.match(playerEmailLinkValidationMessage('Open', '/tournaments'), /complete/i)
  assert.equal(playerEmailLinkValidationMessage('Open', 'juchess.page/tournaments'), null)
})
