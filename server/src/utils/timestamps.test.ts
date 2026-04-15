import test from 'node:test';
import assert from 'node:assert/strict';

import { toIsoTimestamp } from './timestamps.js';

test('toIsoTimestamp preserves strings and serializes Date values', () => {
  const iso = '2026-04-15T04:33:21.000Z';
  assert.equal(toIsoTimestamp(iso), iso);

  const date = new Date('2026-04-15T04:33:21.000Z');
  assert.equal(toIsoTimestamp(date), iso);
});
