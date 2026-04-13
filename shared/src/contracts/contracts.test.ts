import test from 'node:test';
import assert from 'node:assert/strict';

import {authCredentialsSchema} from './auth.js';
import {recordsResponseSchema, runResultPayloadSchema} from './records.js';

test('credentials schema accepts simple valid credentials', () => {
  const parsed = authCredentialsSchema.parse({
    username: 'player_one',
    password: 'secret123'
  });

  assert.equal(parsed.username, 'player_one');
});

test('run result schema requires a positive round number', () => {
  assert.throws(() =>
    runResultPayloadSchema.parse({
      mode: 'normal',
      score: 100,
      reachedRound: 0,
      survivalTime: 12.5,
      clear: false
    })
  );
});

test('records response schema accepts nullable best entries', () => {
  const parsed = recordsResponseSchema.parse({
    best: {},
    recent: [],
    multiplayer: {
      stats: {
        matchesPlayed: 0,
        wins: 0,
        bestPlacement: null
      },
      recent: []
    }
  });

  assert.equal(parsed.recent.length, 0);
});
