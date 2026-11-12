export function tournamentPath(slug: string) {
  return `/tournament/?event=${encodeURIComponent(slug)}`
}
