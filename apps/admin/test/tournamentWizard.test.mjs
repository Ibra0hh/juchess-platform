import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTournamentSteps,
  initialTournamentFormat,
  nextTournamentWizardStep,
  tournamentWizardSubmitIntent,
} from '../src/lib/tournamentWizard.ts'

test('new tournaments do not silently default to Swiss', () => {
  assert.equal(initialTournamentFormat, '')
})

test('Next always lands on tournament format before save', () => {
  assert.equal(nextTournamentWizardStep(0), 1)
  assert.equal(createTournamentSteps[nextTournamentWizardStep(0)], 'Format & time control')
  assert.equal(nextTournamentWizardStep(1), 1)
})

test('only the final wizard step can submit a tournament', () => {
  assert.equal(createTournamentSteps.length, 2)
  assert.equal(tournamentWizardSubmitIntent(0), 'advance')
  assert.equal(tournamentWizardSubmitIntent(1), 'save')
})
