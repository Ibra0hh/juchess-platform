import { Channel, type RealtimeSubscription } from 'appwrite'
import { appwriteConfig, appwriteReady, realtime } from './appwrite'
import { tableIds } from './juchess'

export const adminTournamentRealtimeChannels = [
  Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.tournaments).row(),
  Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.registrations).row(),
  Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.games).row(),
  Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.standings).row(),
]

export async function subscribeToAdminTournamentChanges(
  onChange: () => void,
): Promise<RealtimeSubscription | null> {
  if (!appwriteReady) return null
  return realtime.subscribe(adminTournamentRealtimeChannels, onChange)
}
