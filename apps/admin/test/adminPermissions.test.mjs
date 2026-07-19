import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adminScreensForRole,
  canAccessAdminScreen,
  resolveAdminScreen,
} from '../src/lib/adminPermissions.ts'

test('organizers see only tournament and player management', () => {
  assert.deepEqual(adminScreensForRole('organizer'), ['tournaments', 'players'])
  assert.equal(canAccessAdminScreen('organizer', 'dashboard'), false)
  assert.equal(canAccessAdminScreen('organizer', 'recruitment'), false)
  assert.equal(canAccessAdminScreen('organizer', 'announcements'), false)
  assert.equal(canAccessAdminScreen('organizer', 'adminAccess'), false)
})

test('admins see operational sections but never admin access', () => {
  assert.deepEqual(adminScreensForRole('admin'), [
    'dashboard',
    'tournaments',
    'players',
    'recruitment',
    'news',
    'announcements',
  ])
  assert.equal(canAccessAdminScreen('admin', 'adminAccess'), false)
})

test('super admins can reach every admin section', () => {
  assert.equal(adminScreensForRole('superAdmin').length, 7)
  assert.equal(canAccessAdminScreen('superAdmin', 'adminAccess'), true)
})

test('a forbidden or stale screen falls back to the first role-safe screen', () => {
  assert.equal(resolveAdminScreen('organizer', 'dashboard'), 'tournaments')
  assert.equal(resolveAdminScreen('organizer', 'announcements'), 'tournaments')
  assert.equal(resolveAdminScreen('admin', 'adminAccess'), 'dashboard')
  assert.equal(resolveAdminScreen('superAdmin', 'adminAccess'), 'adminAccess')
})
