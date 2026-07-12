import { Account, Client, Functions, Storage, TablesDB } from 'appwrite'

// These client identifiers are public. Defaults keep the static admin build
// connected when local environment files are intentionally excluded from Git.
const defaultAppwriteConfig = {
  endpoint: 'https://cloud.appwrite.io/v1',
  projectId: 'juchess-platform',
  databaseId: 'juchess',
}

export const appwriteConfig = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || defaultAppwriteConfig.endpoint,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || defaultAppwriteConfig.projectId,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || defaultAppwriteConfig.databaseId,
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
