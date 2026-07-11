import { ExecutionMethod } from 'appwrite'
import { appwriteConfig, appwriteReady, functions } from './appwrite'

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
