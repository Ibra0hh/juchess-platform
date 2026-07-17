export function createAdminJwtCache(
  issue: () => Promise<{ jwt: string }>,
  now: () => number = Date.now,
  lifetimeMs = 15 * 60_000,
  refreshEarlyMs = 60_000,
) {
  let cached: { jwt: string; refreshAt: number } | null = null
  let inFlight: Promise<string> | null = null
  let generation = 0

  return {
    get() {
      if (cached && now() < cached.refreshAt) return Promise.resolve(cached.jwt)
      if (inFlight) return inFlight

      const requestGeneration = generation
      const issuedAt = now()
      const request = issue().then((token) => {
        if (!token.jwt) throw new Error('Appwrite returned an empty admin JWT.')
        if (requestGeneration !== generation) {
          throw new Error('The admin session changed while authorizing the request. Please try again.')
        }
        cached = {
          jwt: token.jwt,
          refreshAt: issuedAt + Math.max(0, lifetimeMs - refreshEarlyMs),
        }
        return token.jwt
      })
      const tracked = request.finally(() => {
        if (inFlight === tracked) inFlight = null
      })
      inFlight = tracked
      return tracked
    },
    clear() {
      generation += 1
      cached = null
      inFlight = null
    },
  }
}
