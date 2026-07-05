export type TournamentStatus = 'active' | 'upcoming' | 'completed'

export type Tournament = {
  id: string
  name: string
  status: TournamentStatus
  date: string
  location: string
  format: string
  timeControl: string
  players: number
  capacity: number
  round: string
  description: string
}

export type Member = {
  id: string
  name: string
  rating: number
  universityId: string
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
    date: 'Sat, Jul 4 · 4:00 PM',
    location: 'Main Campus · Hall B',
    format: 'Swiss · 7 rounds',
    timeControl: '15+10 Rapid',
    players: 12,
    capacity: 16,
    round: 'Round 4 of 7',
    description: 'The main club rapid championship with live pairings and standings.',
  },
  {
    id: 'ju-blitz-cup',
    name: 'JU Blitz Knockout Cup',
    status: 'active',
    date: 'Thu, Jul 2 · 6:00 PM',
    location: 'Student Union · Room 12',
    format: 'Single elimination',
    timeControl: '3+2 Blitz',
    players: 16,
    capacity: 16,
    round: 'Semifinal',
    description: 'A short knockout event for fast time controls.',
  },
  {
    id: 'masters-six',
    name: 'Masters Six Invitational',
    status: 'upcoming',
    date: 'Sun, Jul 12 · 10:00 AM',
    location: 'Main Campus · Hall A',
    format: 'Double round-robin',
    timeControl: '90+30 Classical',
    players: 6,
    capacity: 6,
    round: 'Starts Jul 12',
    description: 'Invitation-only classical event for top club players.',
  },
]

export const members: Member[] = [
  { id: 'ibrahim', name: 'Ibrahim Ahmad', rating: 1810, universityId: 'ibrahim_ju' },
  { id: 'omar', name: 'Omar Saleh', rating: 1740, universityId: 'omar_saleh' },
  { id: 'leen', name: 'Leen Haddad', rating: 1685, universityId: 'leenh' },
  { id: 'yazan', name: 'Yazan Khaled', rating: 1602, universityId: 'ykhaled' },
]

export const liveGames = [
  { id: 'g1', board: 1, white: 'Ibrahim Ahmad', black: 'Omar Saleh', result: 'live' },
  { id: 'g2', board: 2, white: 'Leen Haddad', black: 'Yazan Khaled', result: 'live' },
]
