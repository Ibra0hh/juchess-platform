import { ExecutionMethod } from 'appwrite'
import { appwriteConfig, appwriteReady, functions } from './appwrite'

type PasswordRecoveryResponse = {
  ok?: boolean
  accepted?: boolean
  reset?: boolean
  error?: string
}

export async function queuePasswordRecoveryEmail(email: string) {
  if (!appwriteReady) throw new Error('Cloud accounts are not configured for this app.')
  const execution = await functions.createExecution({
    functionId: appwriteConfig.verificationFunctionId,
    body: JSON.stringify({ email }),
    async: true,
    xpath: '/recovery/send',
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  })
  if (execution.status === 'failed') {
    throw new Error('JuChess could not queue the recovery email. Please try again.')
  }
}

export async function resetPasswordWithRecoveryLink(
  challengeId: string,
  token: string,
  password: string,
) {
  return await runPasswordRecoveryAction('/recovery/confirm-link', { challengeId, token, password })
}

export async function resetPasswordWithRecoveryCode(
  email: string,
  code: string,
  password: string,
) {
  return await runPasswordRecoveryAction('/recovery/confirm-code', { email, code, password })
}

async function runPasswordRecoveryAction(path: string, body: Record<string, unknown>) {
  if (!appwriteReady) throw new Error('Cloud accounts are not configured for this app.')
  const execution = await functions.createExecution({
    functionId: appwriteConfig.verificationFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  })
  if (execution.status === 'failed') {
    throw new Error(execution.errors || 'The password recovery service execution failed.')
  }

  let payload: PasswordRecoveryResponse
  try {
    payload = JSON.parse(execution.responseBody) as PasswordRecoveryResponse
  } catch {
    throw new Error('The password recovery service returned an unreadable response.')
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || 'Password recovery could not be completed right now.')
  }
  if (!payload.reset) throw new Error('The password recovery service returned an incomplete result.')
  return payload
}
