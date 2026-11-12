import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { legacyTournamentRedirect, renderTournamentFallback } from './tournament-pages.mjs'
import { tournamentPath } from '../apps/web/src/lib/tournamentRoute.ts'

const origin = 'https://juchess.page'

function redirect(path) {
  let result
  const url = new URL(path, origin)
  const location = {
    pathname: url.pathname,
    origin: url.origin,
    search: url.search,
    hash: url.hash,
    replace(value) { result = value },
  }
  runInNewContext(legacyTournamentRedirect, { location, URL })
  return result
}

test('new tournament URLs preserve the slug at the static detail entry', () => {
  const url = new URL(tournamentPath('summer & blitz'), origin)
  assert.equal(url.pathname, '/tournament/')
  assert.equal(url.searchParams.get('event'), 'summer & blitz')
})

test('legacy tournament links recover without losing query parameters or fragments', () => {
  for (const prefix of ['', '/web']) {
    const url = new URL(redirect(`${prefix}/tournament/summer%20open/?ref=club#rounds`))
    assert.equal(url.origin, origin)
    assert.equal(url.pathname, '/tournament/')
    assert.equal(url.searchParams.get('event'), 'summer open')
    assert.equal(url.searchParams.get('ref'), 'club')
    assert.equal(url.hash, '#rounds')
  }
  assert.ok(renderTournamentFallback('<head></head>').includes(legacyTournamentRedirect))
})

test('unrelated and malformed URLs remain on the existing fallback', () => {
  for (const path of ['/missing', '/tournament/', '/tournament/%ZZ', '/tournament/one/two']) {
    assert.equal(redirect(path), undefined)
  }
})
