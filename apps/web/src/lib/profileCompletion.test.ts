import assert from 'node:assert/strict'
import test from 'node:test'
import { profileNeedsCompletion, shouldRedirectToProfileCompletion } from './profileCompletion.ts'

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
