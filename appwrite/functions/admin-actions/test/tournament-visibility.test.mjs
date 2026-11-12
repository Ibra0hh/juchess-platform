import assert from 'node:assert/strict';
import test from 'node:test';
import { tournamentRowPermissions } from '../src/main.js';

test('only public tournament lifecycle states grant anonymous read', () => {
  for (const status of ['upcoming', 'active', 'completed']) {
    assert.deepEqual(tournamentRowPermissions(status), ['read("any")']);
  }
  for (const status of ['draft', 'archived', 'unknown', undefined]) {
    assert.deepEqual(tournamentRowPermissions(status), []);
  }
});
