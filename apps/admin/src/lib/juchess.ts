export type TournamentStatus = 'active' | 'upcoming' | 'completed'

export type Tournament = {
  id: string
  name: string
  status: TournamentStatus
  players: number
  capacity: number
  round: string
}

export const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
} as const

export const tournaments: Tournament[] = [
  {
    id: 'ju-rapid-2026',
    name: 'University of Jordan Rapid Championship',
    status: 'active',
    players: 12,
    capacity: 16,
    round: 'Round 4 of 7',
  },
  {
    id: 'ju-blitz-cup',
    name: 'JU Blitz Knockout Cup',
    status: 'active',
    players: 16,
    capacity: 16,
    round: 'Semifinal',
  },
  {
    id: 'masters-six',
    name: 'Masters Six Invitational',
    status: 'upcoming',
    players: 6,
    capacity: 6,
    round: 'Starts Jul 12',
  },
]

export const adminQueues = {
  pendingMembers: 4,
  pendingRegistrations: 7,
  pairingsToPublish: 2,
}
