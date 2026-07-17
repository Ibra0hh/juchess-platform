type CloudError = {
  code?: unknown
  message?: unknown
  type?: unknown
}

const friendlyMessages: Record<string, string> = {
  general_rate_limit_exceeded: 'Too many attempts. Wait a moment, then try again.',
  user_already_exists: 'An account already exists with this email. Sign in or reset your password.',
  user_email_already_exists: 'An account already exists with this email. Sign in or reset your password.',
  user_blocked: 'This account is blocked. Contact the JuChess Club if you need help.',
  user_invalid_credentials: 'Email or password is incorrect.',
  user_invalid_code: 'This secure code is invalid or expired. Request a new one.',
  user_invalid_token: 'This secure link is invalid or expired. Request a new one.',
  user_password_mismatch: 'The current password is incorrect.',
  password_personal_data: 'Choose a password that does not contain your name, email, phone, or account details.',
  password_recently_used: 'Choose a password you have not used recently.',
  user_auth_method_unsupported: 'This sign-in method is not available right now. Use email and password instead.',
  user_oauth2_bad_request: 'Google could not complete this sign-in. Please start again.',
  user_oauth2_provider_error: 'Google could not complete this sign-in. Please start again.',
  user_oauth2_unauthorized: 'Google sign-in was cancelled or not authorized.',
  user_password_reset_required: 'Reset your password before signing in.',
  user_session_not_found: 'Your session has ended. Sign in again.',
  user_unauthorized: 'Your session has ended. Sign in again.',
  user_session_already_exists: 'An account is already signed in in this browser.',
}

export function formatAuthError(error: unknown) {
  const cloudError = asCloudError(error)
  const type = typeof cloudError?.type === 'string' ? cloudError.type : ''
  if (type && friendlyMessages[type]) return friendlyMessages[type]

  const message = typeof cloudError?.message === 'string' ? cloudError.message.trim() : ''
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(message)) {
    return 'JuChess could not reach the account service. Check your connection and try again.'
  }
  const code = Number(cloudError?.code)
  if (code === 429) return 'Too many attempts. Wait a moment, then try again.'
  if (code >= 500) return 'The account service is temporarily unavailable. Please try again.'
  if (type) return 'The account request could not be completed. Check your details and try again.'
  if (message) return message.replace(/appwrite/gi, 'cloud')
  return 'Something went wrong. Please try again.'
}

export function isUnknownAccountRecoveryError(error: unknown) {
  const cloudError = asCloudError(error)
  const type = typeof cloudError?.type === 'string' ? cloudError.type : ''
  const code = Number(cloudError?.code)
  return type === 'user_not_found'
    || type === 'user_email_not_found'
    || (code === 404 && /user|account|email/i.test(String(cloudError?.message ?? '')))
}

function asCloudError(error: unknown): CloudError | null {
  if (!error || typeof error !== 'object') return null
  return error as CloudError
}
