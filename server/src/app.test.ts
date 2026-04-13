import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {createApp} from './app.js';
import {resetDbForTests} from './db/client.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-test.sqlite');
process.env.DB_PATH = dbPath;

test.afterEach(() => {
  resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('signup creates a session and me returns the authenticated user', async () => {
  const app = await createApp();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      username: 'player_one',
      password: 'secret123'
    }
  });

  assert.equal(signup.statusCode, 200);
  const cookie = signup.cookies[0];
  assert.equal(cookie.name, 'avoid_poop_session');

  const me = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    cookies: {
      avoid_poop_session: cookie.value
    }
  });

  assert.equal(me.statusCode, 200);
  assert.equal(me.json().user.username, 'player_one');
  assert.equal(me.json().authenticated, true);
  await app.close();
});

test('records endpoints require auth and return best plus recent runs', async () => {
  const app = await createApp();

  const unauth = await app.inject({
    method: 'GET',
    url: '/api/records'
  });

  assert.equal(unauth.statusCode, 401);

  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      username: 'record_user',
      password: 'secret123'
    }
  });

  const cookie = signup.cookies[0];

  const saveNormal = await app.inject({
    method: 'POST',
    url: '/api/records',
    cookies: {
      avoid_poop_session: cookie.value
    },
    payload: {
      mode: 'normal',
      score: 120,
      reachedRound: 3,
      survivalTime: 22.4,
      clear: false
    }
  });

  assert.equal(saveNormal.statusCode, 201);

  const saveHard = await app.inject({
    method: 'POST',
    url: '/api/records',
    cookies: {
      avoid_poop_session: cookie.value
    },
    payload: {
      mode: 'hard',
      score: 180,
      reachedRound: 4,
      survivalTime: 30.5,
      clear: false
    }
  });

  assert.equal(saveHard.statusCode, 201);

  const records = await app.inject({
    method: 'GET',
    url: '/api/records',
    cookies: {
      avoid_poop_session: cookie.value
    }
  });

  assert.equal(records.statusCode, 200);
  const body = records.json();
  assert.equal(body.profile.totalRuns, 2);
  assert.equal(body.profile.totalClears, 0);
  assert.equal(body.best.normal.score, 120);
  assert.equal(body.best.hard.score, 180);
  assert.equal(body.recent.length, 2);
  assert.equal(body.multiplayer.stats.matchesPlayed, 0);
  assert.equal(body.multiplayer.recent.length, 0);
  assert.equal(body.leaderboard.normal[0].username, 'record_user');
  assert.equal(body.leaderboard.hard[0].username, 'record_user');
  await app.close();
});
