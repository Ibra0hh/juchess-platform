export const createTournamentSteps = ['Basic information', 'Format & time control'] as const
export const initialTournamentFormat = ''

export function tournamentWizardSubmitIntent(step: number) {
  return step < createTournamentSteps.length - 1 ? 'advance' : 'save'
}
