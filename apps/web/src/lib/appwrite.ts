import { Account, Client, Functions, Realtime, Storage, TablesDB } from 'appwrite'
import { playerFunctionHeaders } from './functionAuth'

export { playerFunctionHeaders } from './functionAuth'

// Appwrite endpoint, project, and database IDs are public client configuration,
// not secrets. Keep production-safe defaults so static GitHub Pages builds do
// not silently lose cloud access when the ignored local .env file is absent.
const defaultAppwriteConfig = {
  endpoint: 'https://cloud.appwrite.io/v1',
  projectId: 'juchess-platform',
  databaseId: 'juchess',
}

export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || defaultAppwriteConfig.endpoint,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || defaultAppwriteConfig.projectId,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || defaultAppwriteConfig.databaseId,
  accessGuardFunctionId: import.meta.env.VITE_APPWRITE_ACCESS_GUARD_FUNCTION_ID ?? 'access-guards',
  adminFunctionId: import.meta.env.VITE_APPWRITE_ADMIN_FUNCTION_ID ?? 'admin-actions',
  playerFunctionId: import.meta.env.VITE_APPWRITE_PLAYER_FUNCTION_ID ?? 'player-actions',
  attendanceFunctionId: import.meta.env.VITE_APPWRITE_ATTENDANCE_FUNCTION_ID ?? 'attendance-actions',
  verificationFunctionId: import.meta.env.VITE_APPWRITE_VERIFICATION_FUNCTION_ID ?? 'verification-actions',
}

export const appwriteReady = Boolean(
  appwriteConfig.endpoint && appwriteConfig.projectId && appwriteConfig.databaseId,
)

export const client = new Client()

if (appwriteConfig.endpoint && appwriteConfig.projectId) {
  client.setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.projectId)
}

export const account = new Account(client)
export const tablesDB = new TablesDB(client)
export const storage = new Storage(client)
export const functions = new Functions(client)
export const realtime = new Realtime(client)

export async function createPlayerFunctionHeaders() {
  const token = await account.createJWT({ duration: 900 })
  return playerFunctionHeaders(token.jwt)
}

export async function createAccountFunctionHeaders() {
  const token = await account.createJWT({ duration: 900 })
  return {
    'content-type': 'application/json',
    'juchess-account-jwt': token.jwt,
  }
}
