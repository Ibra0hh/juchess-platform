import { Account, Client, Functions, Storage, TablesDB } from 'appwrite'

export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT ?? '',
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID ?? '',
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID ?? '',
  accessGuardFunctionId: import.meta.env.VITE_APPWRITE_ACCESS_GUARD_FUNCTION_ID ?? 'access-guards',
  playerFunctionId: import.meta.env.VITE_APPWRITE_PLAYER_FUNCTION_ID ?? 'player-actions',
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
