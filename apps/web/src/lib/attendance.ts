import { ExecutionMethod } from 'appwrite'
import { appwriteConfig, appwriteReady, functions } from './appwrite'
import type { AttendanceStatus } from './registrations'

export type AttendanceInvitation = {
  status: AttendanceStatus
  expired: boolean
  canRespond: boolean
  respondedAt?: string | null
  tournament: {
    id: string
    slug: string
    name: string
    startsAt?: string | null
  } | null
}

async function runAttendanceLinkAction(
  path: '/resolve' | '/respond',
  body: Record<string, unknown>,
): Promise<AttendanceInvitation> {
  if (!appwriteReady) throw new Error('The attendance service is not configured.')

  const execution = await functions.createExecution({
    functionId: appwriteConfig.attendanceFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  })

  let payload: { ok?: boolean; error?: string; invitation?: AttendanceInvitation }
  try {
    payload = JSON.parse(execution.responseBody)
  } catch {
    throw new Error('The attendance service returned an unreadable response.')
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false || !payload.invitation) {
    throw new Error(payload.error || 'This attendance link could not be processed.')
  }
  return payload.invitation
}

export function resolveAttendanceInvitation(token: string) {
  return runAttendanceLinkAction('/resolve', { token })
}

export function respondToAttendanceInvitation(
  token: string,
  status: Exclude<AttendanceStatus, 'pending'>,
) {
  return runAttendanceLinkAction('/respond', { token, status })
}
