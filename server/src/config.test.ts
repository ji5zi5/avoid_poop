import assert from 'node:assert/strict';
import test from 'node:test';

import {resolveConfig} from './config.js';

test('resolveConfig rejects production mode without a real cookie secret', () => {
  assert.throws(
    () => resolveConfig({NODE_ENV: 'production', APP_ORIGIN: 'https://avoid-poop.example'}),
    /COOKIE_SECRET must be set to a non-default value in production/,
  );
});

test('resolveConfig rejects production mode without APP_ORIGIN', () => {
  assert.throws(
    () => resolveConfig({NODE_ENV: 'production', COOKIE_SECRET: 'super-secret-value'}),
    /APP_ORIGIN must be set in production/,
  );
});

test('resolveConfig enables secure cookies and logging defaults in production', () => {
  const resolved = resolveConfig({
    NODE_ENV: 'production',
    COOKIE_SECRET: 'super-secret-value',
    APP_ORIGIN: 'https://avoid-poop.example',
  });

  assert.equal(resolved.cookieSecure, true);
  assert.equal(resolved.logEnabled, true);
  assert.equal(resolved.trustProxy, true);
});
