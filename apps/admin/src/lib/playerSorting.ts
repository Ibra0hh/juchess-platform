export const playerSortOptions = [
  ['rating', 'Highest rating'],
  ['name', 'Name (A–Z)'],
  ['joined', 'Newest players'],
  ['recent', 'Most recent visit'],
  ['frequent', 'Most visit days (last 30 days)'],
  ['tournaments', 'Most tournaments played'],
] as const

export type PlayerSort = typeof playerSortOptions[number][0]

type SortablePlayer = {
  id: string
  name: string
  rating: number
  joinedAt?: string
  lastVisitedAt?: string
  visitDays?: number
  tournaments: number
}

function timestamp(value?: string) {
  return Date.parse(value ?? '') || 0
}

export function sortPlayers<T extends SortablePlayer>(players: T[], order: PlayerSort) {
  const name = (a: T, b: T) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  const recent = (a: T, b: T) => timestamp(b.lastVisitedAt) - timestamp(a.lastVisitedAt)
  return players.toSorted((a, b) => {
    switch (order) {
      case 'rating': return b.rating - a.rating || name(a, b)
      case 'name': return name(a, b)
      case 'joined': return timestamp(b.joinedAt) - timestamp(a.joinedAt) || name(a, b)
      case 'recent': return recent(a, b) || name(a, b)
      case 'frequent': return (b.visitDays ?? 0) - (a.visitDays ?? 0) || recent(a, b) || name(a, b)
      case 'tournaments': return b.tournaments - a.tournaments || name(a, b)
    }
  })
}
