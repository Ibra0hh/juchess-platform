import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applicationPath,
  applicationReturn,
  profileCompletionAuthMethod,
  profileNeedsCompletion,
  postAuthenticationDestination,
  routeRequiresAuthenticatedSession,
  shouldRedirectToProfileCompletion,
  withApplicationReturn,
} from './profileCompletion.ts'

const completeProfile = {
  displayName: 'Student Knight',
  university: 'University of Jordan',
  universityId: '0201234',
  phone: '+962791234567',
}

test('a profile does not count as complete until every required field exists', () => {
  assert.equal(profileNeedsCompletion(null), true)
  assert.equal(profileNeedsCompletion(completeProfile), false)

  for (const field of Object.keys(completeProfile) as Array<keyof typeof completeProfile>) {
    assert.equal(profileNeedsCompletion({ ...completeProfile, [field]: '  ' }), true, field)
  }
})

test('the post-authentication tree distinguishes a JuChess member from a new Google identity', () => {
  assert.equal(postAuthenticationDestination(null), '/complete-profile')
  assert.equal(postAuthenticationDestination({
    ...completeProfile,
    phone: '',
  }), '/complete-profile')
  assert.equal(postAuthenticationDestination(completeProfile), '/profile')
})

test('application sign-in retains the destination until the profile is complete', () => {
  const completion = postAuthenticationDestination(null, applicationPath)
  assert.equal(new URL(completion, 'https://juchess.page').pathname, '/complete-profile')
  const next = new URL(completion, 'https://juchess.page').searchParams.get('next')
  assert.equal(postAuthenticationDestination(completeProfile, applicationReturn(next)), applicationPath)
  assert.equal(postAuthenticationDestination(completeProfile, applicationPath), applicationPath)
})

test('auth handoffs keep existing parameters and reject arbitrary redirects', () => {
  const failure = new URL(withApplicationReturn('/sign-in?oauth=failed&provider=google', applicationPath), 'https://juchess.page')
  assert.equal(failure.searchParams.get('oauth'), 'failed')
  assert.equal(failure.searchParams.get('next'), applicationPath)
  for (const value of ['https://example.com', '//example.com', '/profile', '/join-the-team?x=1', '/join-the-team/']) {
    assert.equal(applicationReturn(value), null)
    assert.equal(postAuthenticationDestination(completeProfile, applicationReturn(value)), '/profile')
  }
})

test('signed-in identities without a complete profile are restricted to completion routes', () => {
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/tournaments',
    profile: null,
    signedIn: true,
  }), true)
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/complete-profile',
    profile: null,
    signedIn: true,
  }), false)
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/auth/callback',
    profile: null,
    signedIn: true,
  }), false)
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/verify-email',
    profile: null,
    signedIn: true,
  }), false)
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/forgot-password/',
    profile: null,
    signedIn: true,
  }), false)
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/tournaments',
    profile: completeProfile,
    signedIn: true,
  }), false)
  assert.equal(shouldRedirectToProfileCompletion({
    loading: false,
    pathname: '/tournaments',
    profile: null,
    signedIn: false,
  }), false)
})

test('profile completion uses the current session provider instead of linked identities', () => {
  assert.equal(profileCompletionAuthMethod('email'), 'email')
  assert.equal(profileCompletionAuthMethod('google'), 'google')
  assert.equal(profileCompletionAuthMethod(''), 'account')
  assert.equal(profileCompletionAuthMethod('github'), 'account')
})

test('public and auth routes stay available while session bootstrap is unavailable', () => {
  assert.equal(routeRequiresAuthenticatedSession('/profile'), true)
  assert.equal(routeRequiresAuthenticatedSession('/profile/'), true)
  assert.equal(routeRequiresAuthenticatedSession('/complete-profile'), true)
  assert.equal(routeRequiresAuthenticatedSession('/join-the-team'), true)
  assert.equal(routeRequiresAuthenticatedSession('/home'), false)
  assert.equal(routeRequiresAuthenticatedSession('/tournaments'), false)
  assert.equal(routeRequiresAuthenticatedSession('/sign-in'), false)
  assert.equal(routeRequiresAuthenticatedSession('/forgot-password'), false)
})
