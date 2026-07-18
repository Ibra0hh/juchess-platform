export function normalizeTournamentLocationUrl(value?: string | null) {
  const candidate = String(value ?? '').trim()
  if (!candidate) return ''

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('Enter a valid location link starting with https:// or http://.')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Enter a valid location link starting with https:// or http://.')
  }

  return url.toString()
}
