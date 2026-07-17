export function runHedgedRequest<T>(
  attempt: () => Promise<T>,
  hedgeDelayMs = 8_000,
): Promise<T> {
  if (!Number.isFinite(hedgeDelayMs) || hedgeDelayMs < 0) {
    throw new Error('Hedge delay must be a non-negative number.')
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let backupStarted = false
    let failures = 0
    let lastError: unknown
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined

    const succeed = (value: T) => {
      if (settled) return
      settled = true
      if (hedgeTimer !== undefined) clearTimeout(hedgeTimer)
      resolve(value)
    }

    const fail = (error: unknown) => {
      if (settled) return
      failures += 1
      lastError = error

      if (!backupStarted) {
        startBackup()
        return
      }

      if (failures >= 2) {
        settled = true
        if (hedgeTimer !== undefined) clearTimeout(hedgeTimer)
        reject(lastError)
      }
    }

    const launchAttempt = () => {
      void Promise.resolve().then(attempt).then(succeed, fail)
    }

    const startBackup = () => {
      if (settled || backupStarted) return
      backupStarted = true
      if (hedgeTimer !== undefined) clearTimeout(hedgeTimer)
      launchAttempt()
    }

    hedgeTimer = setTimeout(startBackup, hedgeDelayMs)
    launchAttempt()
  })
}
