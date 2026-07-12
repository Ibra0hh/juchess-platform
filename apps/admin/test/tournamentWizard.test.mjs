import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTournamentSteps,
  initialTournamentFormat,
  tournamentWizardSubmitIntent,
} from '../src/lib/tournamentWizard.ts'

test('new tournaments do not silently default to Swiss', () => {
  assert.equal(initialTournamentFormat, '')
})

test('only the final wizard step can submit a tournament', () => {
  assert.equal(createTournamentSteps.length, 2)
  assert.equal(tournamentWizardSubmitIntent(0), 'advance')
  assert.equal(tournamentWizardSubmitIntent(1), 'save')
})
