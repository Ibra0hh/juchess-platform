import { ExecutionMethod, type Models } from 'appwrite'
import { appwriteConfig, appwriteReady, createPlayerFunctionHeaders, functions } from './appwrite'

export const recruitmentInterestOptions = [
  { value: 'design', label: 'Design' },
  { value: 'software', label: 'Software' },
  { value: 'events', label: 'Events' },
  { value: 'media', label: 'Media & content' },
  { value: 'hr', label: 'People & HR' },
  { value: 'partnerships', label: 'Partnerships' },
  { value: 'finance', label: 'Finance' },
  { value: 'management', label: 'Management' },
] as const

export type RecruitmentInterest = typeof recruitmentInterestOptions[number]['value']
export type RecruitmentStatus = 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'accepted' | 'rejected' | 'withdrawn'

export type RecruitmentApplication = Models.Row & {
  profileId: string
  accountId: string
  interests: RecruitmentInterest[]
  skills: string
  contribution: string
  developmentGoals?: string
  availability: string
  portfolioUrl?: string
  status: RecruitmentStatus
  submittedAt: string
  updatedAt: string
}

export type RecruitmentApplicationInput = {
  interests: RecruitmentInterest[]
  skills: string
  contribution: string
  developmentGoals: string
  availability: string
  portfolioUrl: string
}

export const recruitmentStatusLabels: Record<RecruitmentStatus, string> = {
  submitted: 'Submitted',
  reviewing: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
}

export async function loadMyRecruitmentApplication() {
  const payload = await runRecruitmentAction<{ row: RecruitmentApplication | null }>(
    ExecutionMethod.GET,
    '/recruitment/application',
  )
  return payload.row
}

export async function submitRecruitmentApplication(input: RecruitmentApplicationInput) {
  const payload = await runRecruitmentAction<{ row: RecruitmentApplication }>(
    ExecutionMethod.POST,
    '/recruitment/application',
    input,
  )
  return payload.row
}

export async function withdrawRecruitmentApplication() {
  const payload = await runRecruitmentAction<{ row: RecruitmentApplication }>(
    ExecutionMethod.POST,
    '/recruitment/application/withdraw',
  )
  return payload.row
}

async function runRecruitmentAction<T>(
  method: ExecutionMethod,
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  if (!appwriteReady) throw new Error('Club recruitment is not configured for this app.')
  const headers = await createPlayerFunctionHeaders()

  const execution = await functions.createExecution({
    functionId: appwriteConfig.playerFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method,
    headers,
  })

  let payload: { ok?: boolean; error?: string } & Record<string, unknown>
  try {
    payload = JSON.parse(execution.responseBody)
  } catch {
    throw new Error('The club server returned an unreadable response.')
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || 'Could not update your crew application.')
  }
  return payload as T
}
