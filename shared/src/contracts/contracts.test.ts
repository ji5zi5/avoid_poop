import test from 'node:test';
import assert from 'node:assert/strict';

import {authCredentialsSchema, authWebSocketTicketSchema} from './auth.js';
import {recordsResponseSchema, runResultPayloadSchema, singlePlayerRunSessionSchema} from './records.js';

test('credentials schema accepts simple valid credentials', () => {
  const parsed = authCredentialsSchema.parse({
    username: 'player_one',
    password: 'secret123'
  });

  assert.equal(parsed.username, 'player_one');
});

test('credentials schema accepts Korean usernames', () => {
  const parsed = authCredentialsSchema.parse({
    username: '가나다_1',
    password: 'secret123'
  });

  assert.equal(parsed.username, '가나다_1');
});

test('websocket ticket schema accepts a token payload', () => {
  const parsed = authWebSocketTicketSchema.parse({
    token: 'signed-ticket',
  });

  assert.equal(parsed.token, 'signed-ticket');
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
    profile: {
      totalRuns: 0,
      totalClears: 0,
      totalScore: 0
    },
    best: {},
    recent: [],
    multiplayer: {
      stats: {
        matchesPlayed: 0,
        wins: 0,
        bestPlacement: null
      },
      recent: []
    },
    leaderboard: {
      normal: [],
      hard: [],
      multiplayer: []
    }
  });

  assert.equal(parsed.recent.length, 0);
});

test('single-player run session schema accepts issued seeds', () => {
  const parsed = singlePlayerRunSessionSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    mode: 'hard',
    waveSeed: 123,
    bossSeed: 456,
    startedAt: '2026-04-15T05:00:00.000Z',
  });

  assert.equal(parsed.mode, 'hard');
});
