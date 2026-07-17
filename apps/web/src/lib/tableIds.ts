// Appwrite table identifiers are public client configuration. Keep this small
// so authentication does not pull the full tournament/game repository and its
// route-only fixtures into the initial application bundle.
export const publicTableIds = {
  profiles: 'profiles',
} as const
