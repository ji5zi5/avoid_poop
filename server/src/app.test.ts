import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {createApp} from './app.js';
import {resetDbForTests} from './db/client.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-test.sqlite');
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

test.afterEach(async () => {
  await resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('signup creates a session and me returns the authenticated user', { concurrency: false }, async () => {
  const app = await createApp();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      username: '플레이어1',
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
  assert.equal(me.json().user.username, '플레이어1');
  assert.equal(me.json().authenticated, true);
  await app.close();
});

test('health responses ship security headers', { concurrency: false }, async () => {
  const app = await createApp();
  const health = await app.inject({
    method: 'GET',
    url: '/api/health'
  });

  assert.equal(health.statusCode, 200);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-frame-options'], 'DENY');
  assert.equal(health.headers['referrer-policy'], 'no-referrer');
  assert.equal(health.headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(health.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  await app.close();
});

test('cross-origin API preflight succeeds for the configured frontend origin', { concurrency: false }, async () => {
  const app = await createApp({
    appOrigin: 'https://avoid-poop.vercel.app',
  });

  try {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: 'https://avoid-poop.vercel.app',
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'https://avoid-poop.vercel.app');
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
  } finally {
    await app.close();
  }
});

test('production-style auth cookies can be configured for split-host deployments', { concurrency: false }, async () => {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    APP_ORIGIN: process.env.APP_ORIGIN,
    COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE,
    COOKIE_SECRET: process.env.COOKIE_SECRET,
  };
  process.env.NODE_ENV = 'production';
  process.env.APP_ORIGIN = 'https://avoid-poop.vercel.app';
  process.env.COOKIE_SAME_SITE = 'none';
  process.env.COOKIE_SECRET = 'split-host-cookie-secret';
  const app = await createApp();

  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        origin: 'https://avoid-poop.vercel.app',
      },
      payload: {
        username: 'split_host_cookie_user',
        password: 'secret123'
      }
    });

    assert.equal(signup.statusCode, 200);
    const cookie = signup.cookies.find((entry) => entry.name === 'avoid_poop_session');
    assert.equal(cookie?.sameSite, 'None');
    assert.equal(cookie?.secure, true);
  } finally {
    await app.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  }
});

test('auth endpoints are rate limited when the auth bucket is exhausted', { concurrency: false }, async () => {
  const app = await createApp({
    rateLimits: {
      auth: { max: 1, windowMs: 60_000 },
    } as never,
  });

  try {
    const firstSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        username: 'limited_one',
        password: 'secret123'
      }
    });
    assert.equal(firstSignup.statusCode, 200);

    const secondSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup?next=1',
      payload: {
        username: 'limited_two',
        password: 'secret123'
      }
    });
    assert.equal(secondSignup.statusCode, 429);
    assert.equal(secondSignup.json().error, 'Too many requests. Try again later.');
    assert.ok(secondSignup.headers['retry-after']);
  } finally {
    await app.close();
  }
});

test('write-heavy endpoints are rate limited when the write bucket is exhausted', { concurrency: false }, async () => {
  const app = await createApp({
    rateLimits: {
      writes: { max: 1, windowMs: 60_000 },
    } as never,
  });

  try {
    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        username: 'write_limit_user',
        password: 'secret123'
      }
    });
    const cookie = signup.cookies[0];

    const firstSave = await app.inject({
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
    assert.equal(firstSave.statusCode, 201);

    const secondSave = await app.inject({
      method: 'POST',
      url: '/api/records?attempt=2',
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
    assert.equal(secondSave.statusCode, 429);
    assert.equal(secondSave.json().error, 'Too many requests. Try again later.');
    assert.ok(secondSave.headers['retry-after']);
  } finally {
    await app.close();
  }
});

test('auth rate limiting ignores spoofed forwarded IPs unless trust proxy is enabled', { concurrency: false }, async () => {
  const app = await createApp({
    trustProxy: false,
    rateLimits: {
      auth: { max: 1, windowMs: 60_000 },
    } as never,
  });

  try {
    const firstSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        'x-forwarded-for': '1.1.1.1'
      },
      payload: {
        username: 'spoofed_limit_one',
        password: 'secret123'
      }
    });
    assert.equal(firstSignup.statusCode, 200);

    const secondSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        'x-forwarded-for': '2.2.2.2'
      },
      payload: {
        username: 'spoofed_limit_two',
        password: 'secret123'
      }
    });
    assert.equal(secondSignup.statusCode, 429);
  } finally {
    await app.close();
  }
});

test('auth rate limiting honors forwarded IPs when trust proxy is enabled', { concurrency: false }, async () => {
  const app = await createApp({
    trustProxy: true,
    rateLimits: {
      auth: { max: 1, windowMs: 60_000 },
    } as never,
  });

  try {
    const firstSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        'x-forwarded-for': '1.1.1.1'
      },
      payload: {
        username: 'trusted_proxy_one',
        password: 'secret123'
      }
    });
    assert.equal(firstSignup.statusCode, 200);

    const secondSignup = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        'x-forwarded-for': '2.2.2.2'
      },
      payload: {
        username: 'trusted_proxy_two',
        password: 'secret123'
      }
    });
    assert.equal(secondSignup.statusCode, 200);
  } finally {
    await app.close();
  }
});

test('state-changing requests reject unexpected origins when APP_ORIGIN is configured', { concurrency: false }, async () => {
  const app = await createApp({
    appOrigin: 'https://avoid-poop.example',
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        origin: 'https://evil.example',
      },
      payload: {
        username: 'blocked_origin_user',
        password: 'secret123'
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, 'Origin not allowed.');
  } finally {
    await app.close();
  }
});

test('state-changing requests reject missing origins when APP_ORIGIN is configured', { concurrency: false }, async () => {
  const app = await createApp({
    appOrigin: 'https://avoid-poop.example',
  });

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        username: 'missing_origin_user',
        password: 'secret123'
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, 'Origin not allowed.');
  } finally {
    await app.close();
  }
});

test('records endpoints require auth and return best plus recent runs', { concurrency: false }, async () => {
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
  const normalRunSession = await app.inject({
    method: 'POST',
    url: '/api/records/run-session',
    cookies: {
      avoid_poop_session: cookie.value
    },
    payload: { mode: 'normal' }
  });
  const hardRunSession = await app.inject({
    method: 'POST',
    url: '/api/records/run-session',
    cookies: {
      avoid_poop_session: cookie.value
    },
    payload: { mode: 'hard' }
  });

  const saveNormal = await app.inject({
    method: 'POST',
    url: '/api/records',
    cookies: {
      avoid_poop_session: cookie.value
    },
    payload: {
      runSessionId: normalRunSession.json().id,
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
      runSessionId: hardRunSession.json().id,
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


test('records endpoint exposes real cross-user leaderboards', { concurrency: false }, async () => {
  const app = await createApp();

  const firstSignup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { username: 'rank_one', password: 'secret123' }
  });
  const secondSignup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { username: 'rank_two', password: 'secret123' }
  });

  const firstCookie = firstSignup.cookies[0]!.value;
  const secondCookie = secondSignup.cookies[0]!.value;
  const firstRunSession = await app.inject({
    method: 'POST',
    url: '/api/records/run-session',
    cookies: { avoid_poop_session: firstCookie },
    payload: { mode: 'normal' }
  });
  const secondRunSession = await app.inject({
    method: 'POST',
    url: '/api/records/run-session',
    cookies: { avoid_poop_session: secondCookie },
    payload: { mode: 'normal' }
  });

  await app.inject({
    method: 'POST',
    url: '/api/records',
    cookies: { avoid_poop_session: firstCookie },
    payload: { runSessionId: firstRunSession.json().id, mode: 'normal', score: 320, reachedRound: 7, survivalTime: 41.2, clear: true }
  });
  await app.inject({
    method: 'POST',
    url: '/api/records',
    cookies: { avoid_poop_session: secondCookie },
    payload: { runSessionId: secondRunSession.json().id, mode: 'normal', score: 210, reachedRound: 5, survivalTime: 26.8, clear: false }
  });

  const hostRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: firstCookie },
    payload: {}
  });
  const roomCode = hostRoom.json().roomCode;
  await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: { avoid_poop_session: secondCookie },
    payload: { roomCode }
  });

  const recordsView = await app.inject({
    method: 'GET',
    url: '/api/records',
    cookies: { avoid_poop_session: firstCookie }
  });

  assert.equal(recordsView.statusCode, 200);
  const body = recordsView.json();
  assert.equal(body.leaderboard.normal[0].username, 'rank_one');
  assert.equal(body.leaderboard.normal[1].username, 'rank_two');
  assert.equal(body.profile.totalRuns, 1);
  await app.close();
});
