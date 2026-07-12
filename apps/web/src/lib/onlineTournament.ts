import { Channel, ExecutionMethod, Query } from 'appwrite'
import { appwriteConfig, appwriteReady, functions, realtime } from './appwrite'

export type HostedMoveResponse = {
  requiresTiebreak?: boolean
  row: {
    $id: string
    moveVersion?: number
    pgn?: string
    result?: string
    status?: 'scheduled' | 'live' | 'completed' | 'forfeit'
  }
}

export type HostedGameRow = HostedMoveResponse['row'] & {
  blackProfileId?: string
  blackTimeMs?: number
  clockDeadlineAt?: string
  finishedAt?: string
  firstMoveDeadlineAt?: string
  forfeitedProfileId?: string
  lastMoveAt?: string
  round?: number
  scheduledStartAt?: string
  startedAt?: string
  terminationReason?: 'checkmate' | 'draw' | 'resignation' | 'timeout' | 'noShow' | 'forfeit' | 'cancelled'
  tournamentId?: string
  turnStartedAt?: string
  whiteProfileId?: string
  whiteTimeMs?: number
}

export type HostedTournamentRow = {
  $id: string
  chatPolicy?: 'full' | 'preset' | 'disabled'
  currentRound?: number
  fairPlayMode?: 'standard' | 'strict' | 'proctored'
  name?: string
  onlinePlatform?: 'chessCom' | 'lichess' | 'juchess'
  startsAt?: string
  status?: 'draft' | 'upcoming' | 'active' | 'completed' | 'archived'
  timeControl?: string
}

export type ActiveHostedGameResponse = {
  game: HostedGameRow | null
  tournament: HostedTournamentRow | null
}

export type HostedGameSyncResponse = {
  expired: boolean
  reason?: 'timeout' | 'noShow'
  row: HostedGameRow
  tournament: HostedTournamentRow
}

export type GameChatMessage = {
  $id: string
  body: string
  createdAt: string
  gameId: string
  kind: 'text' | 'preset' | 'system'
  senderProfileId: string
  status: 'active' | 'removed'
  tournamentId: string
}

export type FairPlayEventType =
  | 'heartbeat'
  | 'tabHidden'
  | 'tabVisible'
  | 'windowBlur'
  | 'windowFocus'
  | 'fullscreenExit'
  | 'disconnect'
  | 'reconnect'
  | 'analysisAttempt'

async function runHostedGameAction<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!appwriteReady) throw new Error('JuChess online play is not configured.')

  const execution = await functions.createExecution({
    functionId: appwriteConfig.adminFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  })

  let payload: ({ ok?: boolean; error?: string } & Record<string, unknown>)
  try {
    payload = JSON.parse(execution.responseBody)
  } catch {
    throw new Error('The JuChess game server returned an unreadable response.')
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || 'The game server rejected this action.')
  }
  return payload as T
}

export function submitHostedTournamentMove(gameId: string, san: string, expectedVersion: number) {
  return runHostedGameAction<HostedMoveResponse>(`/player/games/${gameId}/move`, { san, expectedVersion })
}

export function resignHostedTournamentGame(gameId: string) {
  return runHostedGameAction<HostedMoveResponse>(`/player/games/${gameId}/resign`)
}

export function loadActiveHostedTournamentGame() {
  return runHostedGameAction<ActiveHostedGameResponse>('/player/active-game')
}

export function syncHostedTournamentGame(gameId: string) {
  return runHostedGameAction<HostedGameSyncResponse>(`/player/games/${gameId}/sync`)
}

export async function loadHostedGameMessages(gameId: string) {
  const response = await runHostedGameAction<{ messages: GameChatMessage[] }>(
    `/player/games/${gameId}/messages/list`,
  )
  return response.messages
}

export async function sendHostedGameMessage(
  gameId: string,
  body: string,
  kind: 'text' | 'preset' = 'text',
) {
  const response = await runHostedGameAction<{ message: GameChatMessage }>(
    `/player/games/${gameId}/messages/send`,
    { body, kind },
  )
  return response.message
}

export function recordHostedFairPlayEvent(
  gameId: string,
  eventType: FairPlayEventType,
  sessionId: string,
  options: { durationMs?: number; metadata?: Record<string, unknown> } = {},
) {
  return runHostedGameAction<{ event: Record<string, unknown> }>(
    `/player/games/${gameId}/fair-play`,
    { eventType, sessionId, ...options },
  )
}

export async function subscribeToHostedGameMessages(gameId: string, onChange: () => void) {
  const subscription = await realtime.subscribe(
    Channel.tablesdb(appwriteConfig.databaseId).table('game_messages').row(),
    onChange,
    [Query.equal('gameId', gameId)],
  )
  return () => {
    void subscription.unsubscribe()
  }
}

export async function subscribeToPlayerTournamentGames(profileId: string, onChange: () => void) {
  const subscription = await realtime.subscribe(
    Channel.tablesdb(appwriteConfig.databaseId).table('games').row(),
    onChange,
    [
      Query.or([
        Query.equal('whiteProfileId', profileId),
        Query.equal('blackProfileId', profileId),
      ]),
      Query.equal('status', ['scheduled', 'live']),
    ],
  )
  return () => {
    void subscription.unsubscribe()
  }
}
