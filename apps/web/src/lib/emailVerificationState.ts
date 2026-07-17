export type CurrentEmailVerificationState = 'verified' | 'unverified' | 'unknown'

type CurrentAccountVerification = {
  $id: string
  emailVerification: boolean
}

export function resolveCurrentEmailVerificationState(
  user: CurrentAccountVerification,
  expectedUserId: string,
): CurrentEmailVerificationState {
  if (user.emailVerification) return 'verified'
  if (expectedUserId && user.$id !== expectedUserId) return 'unknown'
  return 'unverified'
}
