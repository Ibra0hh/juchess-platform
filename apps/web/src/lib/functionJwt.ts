export type FunctionJwtIssuer = () => Promise<{ jwt: string }>

export type FunctionJwtCache = {
  get: () => Promise<string>
  clear: () => void
}

/**
 * Appwrite account JWTs are short lived, but creating one for every Function
 * request doubles network traffic and can exhaust the account endpoint's rate
 * limit during live play. Keep one token per browser session, deduplicate
 * concurrent creation, and refresh it before its fifteen-minute lifetime ends.
 */
export function createFunctionJwtCache(
  issue: FunctionJwtIssuer,
  now: () => number = Date.now,
  lifetimeMs = 15 * 60_000,
  refreshEarlyMs = 60_000,
): FunctionJwtCache {
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
        if (!token.jwt) throw new Error('Appwrite returned an empty account JWT.')
        if (requestGeneration !== generation) {
          throw new Error('The account session changed while authorizing the request. Please try again.')
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
