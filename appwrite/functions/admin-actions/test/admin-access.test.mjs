import assert from 'node:assert/strict';
import test from 'node:test';

import { assertAdminCanBeRemoved } from '../src/main.js';

test('admin removal never allows the current super admin to remove their own access', () => {
  const actor = { $id: 'admin-row-1', accountId: 'account-1', role: 'superAdmin', status: 'active' };
  assert.throws(
    () => assertAdminCanBeRemoved(actor, actor, [actor]),
    (error) => error.statusCode === 409 && /own admin access/i.test(error.message),
  );
});

test('admin removal protects the final active super admin', () => {
  const actor = { $id: 'admin-row-1', accountId: 'account-1', role: 'superAdmin', status: 'active' };
  const target = { $id: 'admin-row-2', accountId: 'account-2', role: 'superAdmin', status: 'active' };
  assert.throws(
    () => assertAdminCanBeRemoved(actor, target, [target, { ...actor, status: 'suspended' }]),
    (error) => error.statusCode === 409 && /final active super admin/i.test(error.message),
  );
});

test('admin removal permits a different organizer while preserving player identity elsewhere', () => {
  const actor = { $id: 'admin-row-1', accountId: 'account-1', role: 'superAdmin', status: 'active' };
  const target = { $id: 'admin-row-2', accountId: 'account-2', role: 'organizer', status: 'active' };
  assert.doesNotThrow(() => assertAdminCanBeRemoved(actor, target, [actor, target]));
});
