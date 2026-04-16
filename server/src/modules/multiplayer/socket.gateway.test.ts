import assert from 'node:assert/strict';
import type {IncomingMessage} from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import WebSocket, {type RawData} from 'ws';

import {config} from '../../config.js';
import {createApp} from '../../app.js';
import {resetDbForTests} from '../../db/client.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-socket-test.sqlite');
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

test.afterEach(async () => {
  await resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('websocket connect requires authentication', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${config.multiplayerWebSocketPath}`);
    ws.once('unexpected-response', (_request: IncomingMessage, response: IncomingMessage) => {
      assert.equal(response.statusCode, 401);
      response.resume();
      resolve();
    });
  });

  await app.close();
});

test('websocket connect accepts a valid websocket ticket without cookies', { concurrency: false }, async () => {
  const app = await createApp({appOrigin: 'https://avoid-poop.example'});
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_ticket_user', { origin: 'https://avoid-poop.example' });

  const ticketResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/ws-ticket',
    headers: {
      origin: 'https://avoid-poop.example',
    },
    cookies: {
      avoid_poop_session: cookie,
    },
  });

  try {
    assert.equal(ticketResponse.statusCode, 200);
    const { socket, connected } = await connectSocketAndWaitForConnected(port, undefined, undefined, {
      Origin: 'https://avoid-poop.example',
    }, ticketResponse.json().token);
    assert.equal(connected.user.username, 'socket_ticket_user');
    socket.close();
  } finally {
    await app.close();
  }
});

test('websocket connect rejects unexpected origins when APP_ORIGIN is configured', { concurrency: false }, async () => {
  const app = await createApp({appOrigin: 'https://avoid-poop.example'});
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_origin_user', { origin: 'https://avoid-poop.example' });

  try {
    const statusCode = await connectSocketExpectStatus(port, {
      cookie,
      origin: 'https://evil.example',
    });
    assert.equal(statusCode, 403);
  } finally {
    await app.close();
  }
});

test('websocket connect rejects missing origins when APP_ORIGIN is configured', { concurrency: false }, async () => {
  const app = await createApp({appOrigin: 'https://avoid-poop.example'});
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_missing_origin', { origin: 'https://avoid-poop.example' });

  try {
    const statusCode = await connectSocketExpectStatus(port, {
      cookie,
    });
    assert.equal(statusCode, 403);
  } finally {
    await app.close();
  }
});

test('websocket upgrades are rate limited when the handshake bucket is exhausted', { concurrency: false }, async () => {
  const app = await createApp({
    rateLimits: { websocket: { max: 1, windowMs: 60_000 } } as never,
  });
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_rate_limit_user');

  try {
    const {socket} = await connectSocketAndWaitForConnected(port, cookie);
    const statusCode = await connectSocketExpectStatus(port, {cookie});
    assert.equal(statusCode, 429);
    socket.close();
  } finally {
    await app.close();
  }
});

test('websocket rate limiting only honors forwarded IPs when trust proxy is enabled', { concurrency: false }, async () => {
  const app = await createApp({
    trustProxy: true,
    rateLimits: { websocket: { max: 1, windowMs: 60_000 } } as never,
  });
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_proxy_user');

  try {
    const {socket} = await connectSocketAndWaitForConnected(port, cookie, undefined, {'X-Forwarded-For': '1.1.1.1'});
    const {socket: secondSocket} = await connectSocketAndWaitForConnected(port, cookie, undefined, {'X-Forwarded-For': '2.2.2.2'});
    socket.close();
    secondSocket.close();
  } finally {
    await app.close();
  }
});

test('websocket rate limiting ignores spoofed forwarded IPs when trust proxy is disabled', { concurrency: false }, async () => {
  const app = await createApp({
    trustProxy: false,
    rateLimits: { websocket: { max: 1, windowMs: 60_000 } } as never,
  });
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_proxy_off');

  try {
    const {socket} = await connectSocketAndWaitForConnected(port, cookie, undefined, {'X-Forwarded-For': '1.1.1.1'});
    const statusCode = await connectSocketExpectStatus(port, {
      cookie,
      extraHeaders: {'X-Forwarded-For': '2.2.2.2'},
    });
    assert.equal(statusCode, 429);
    socket.close();
  } finally {
    await app.close();
  }
});

test('subscribing to a room broadcasts room snapshots to room members', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);

  const hostCookie = await signup(app, 'socket_host');
  const guestCookie = await signup(app, 'socket_guest');

  const created = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {avoid_poop_session: hostCookie}
  });
  const roomCode = created.json().roomCode as string;

  await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: {avoid_poop_session: guestCookie},
    payload: {roomCode}
  });

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);

  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));

  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot'));
  await waitFor(() => guestEvents.some((event) => event.type === 'room_snapshot'));

  const hostSnapshot = hostEvents.find((event) => event.type === 'room_snapshot');
  const guestSnapshot = guestEvents.find((event) => event.type === 'room_snapshot');
  assert.equal(hostSnapshot.room.roomCode, roomCode);
  assert.equal(hostSnapshot.room.playerCount, 2);
  assert.equal(guestSnapshot.room.playerCount, 2);

  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('closing a waiting-room socket removes the player so ghost rooms do not linger', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);

  const hostCookie = await signup(app, 'ghost_room_host');

  const created = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: hostCookie }
  });
  const roomCode = created.json().roomCode as string;

  const { socket: hostSocket } = await connectSocketAndWaitForConnected(port, hostCookie);
  const hostEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));

  await waitFor(() =>
    hostEvents.some((event) => event.type === 'room_snapshot' && event.room.roomCode === roomCode)
  );

  await waitFor(async () => {
    const rooms = await app.inject({
      method: 'GET',
      url: '/api/multiplayer/rooms',
      cookies: { avoid_poop_session: hostCookie }
    });
    const list = rooms.json() as Array<{ roomId: string }>;
    return list.length === 1;
  });

  await new Promise<void>((resolve) => {
    hostSocket.once('close', () => resolve());
    hostSocket.close();
  });

  const viewerCookie = await signup(app, `ghost${Date.now().toString().slice(-6)}`);

  await waitFor(async () => {
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/multiplayer/rooms',
      cookies: { avoid_poop_session: viewerCookie }
    });
    const list = listResponse.json() as Array<unknown>;
    return list.length === 0;
  });

  await app.close();
});

test('pre-ready start is rejected before room start', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'ready_host');
  const guestCookie = await signup(app, 'ready_guest');

  const created = await app.inject({ method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie} });
  const roomCode = created.json().roomCode as string;
  await app.inject({ method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode} });

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const hostEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'start_game'}));

  await waitFor(() => hostEvents.some((event) => event.type === 'error'));
  const actualError = hostEvents.find((event) => event.type === 'error');
  assert.equal(actualError.error, 'All players must be ready before starting.');
  hostSocket.close();
  await app.close();
});

test('host can start a game and clients receive game snapshots', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);

  const hostCookie = await signup(app, 'start_host');
  const guestCookie = await signup(app, 'start_guest');

  const created = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {avoid_poop_session: hostCookie}
  });
  const roomCode = created.json().roomCode as string;

  await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: {avoid_poop_session: guestCookie},
    payload: {roomCode}
  });

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);

  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  guestSocket.send(JSON.stringify({type: 'set_ready', ready: true}));

  await waitFor(() =>
    hostEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready))
  );
  await waitFor(() =>
    guestEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready))
  );

  hostSocket.send(JSON.stringify({type: 'start_game'}));

  await waitFor(() => hostEvents.some((event) => event.type === 'game_snapshot'));
  await waitFor(() => guestEvents.some((event) => event.type === 'game_snapshot'));

  const gameSnapshot = hostEvents.find((event) => event.type === 'game_snapshot');
  assert.equal(gameSnapshot.game.roomCode, roomCode);
  assert.equal(gameSnapshot.game.phase, 'wave');
  assert.equal(gameSnapshot.game.players.length, 2);

  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('reconnect token can be reused within grace period', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'socket_reconnect');

  const {socket: firstSocket, connected: firstConnected} = await connectSocketAndWaitForConnected(port, cookie);
  assert.equal(firstConnected.reconnected, false);
  const reconnectToken = firstConnected.reconnectToken as string;

  firstSocket.close();
  await waitFor(() => firstSocket.readyState === WebSocket.CLOSED);

  const {socket: secondSocket, connected: secondConnected} = await connectSocketAndWaitForConnected(port, cookie, reconnectToken);
  assert.equal(secondConnected.reconnectToken, reconnectToken);
  assert.equal(secondConnected.reconnected, true);

  secondSocket.close();
  await app.close();
});

test('reconnecting to an active game restores the player from disconnected state', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);

  const hostCookie = await signup(app, 'reconnect_host');
  const guestCookie = await signup(app, 'reconnect_guest');

  const created = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {avoid_poop_session: hostCookie}
  });
  const roomCode = created.json().roomCode as string;

  await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: {avoid_poop_session: guestCookie},
    payload: {roomCode}
  });

  const {socket: hostSocket, connected: hostConnected} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const reconnectToken = hostConnected.reconnectToken as string;

  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  guestSocket.send(JSON.stringify({type: 'set_ready', ready: true}));

  await waitFor(() =>
    hostEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready))
  );
  await waitFor(() =>
    guestEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready))
  );

  hostSocket.send(JSON.stringify({type: 'start_game'}));

  await waitFor(() => guestEvents.some((event) => event.type === 'game_snapshot'));

  hostSocket.close();
  await waitFor(() =>
    guestEvents.some(
      (event) =>
        event.type === 'game_snapshot' &&
        event.game.players.some((player: {userId: number; status: string}) => player.userId === 1 && player.status === 'disconnected')
    )
  );

  const {socket: reconnectedSocket, connected: reconnectedEvent} = await connectSocketAndWaitForConnected(port, hostCookie, reconnectToken);
  assert.equal(reconnectedEvent.reconnected, true);
  const reconnectedEvents: Array<any> = [];
  reconnectedSocket.on('message', (payload: RawData) => reconnectedEvents.push(JSON.parse(payload.toString())));
  reconnectedSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));

  await waitFor(() =>
    reconnectedEvents.some(
      (event) =>
        event.type === 'game_snapshot' &&
        event.game.players.some(
          (player: {userId: number; status: string; disconnectDeadlineAt: number | null}) =>
            player.userId === 1 && player.status === 'alive' && player.disconnectDeadlineAt === null
        )
    )
  );

  const restoredSnapshot = [...reconnectedEvents].reverse().find((event: any) => event.type === 'game_snapshot');
  const restoredHost = restoredSnapshot.game.players.find((player: {userId: number}) => player.userId === 1);
  assert.equal(restoredHost.status, 'alive');
  assert.equal(restoredHost.disconnectDeadlineAt, null);

  reconnectedSocket.close();
  guestSocket.close();
  await app.close();
});

async function signup(app: Awaited<ReturnType<typeof createApp>>, username: string, headers?: Record<string, string>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers,
    payload: {
      username,
      password: 'secret123'
    }
  });

  assert.equal(response.statusCode, 200);
  return response.cookies[0]!.value;
}

async function connectSocketAndWaitForConnected(
  port: number,
  cookie?: string,
  reconnectToken?: string,
  extraHeaders?: Record<string, string>,
  wsToken?: string,
) {
  return await new Promise<{socket: WebSocket; connected: any}>((resolve, reject) => {
    const params = new URLSearchParams();
    if (reconnectToken) {
      params.set('reconnectToken', reconnectToken);
    }
    if (wsToken) {
      params.set('wsToken', wsToken);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const ws = new WebSocket(`ws://127.0.0.1:${port}${config.multiplayerWebSocketPath}${suffix}`, {
      headers: {
        ...(cookie ? { Cookie: `${config.sessionCookieName}=${cookie}` } : {}),
        ...(extraHeaders ?? {})
      }
    });

    let opened = false;
    let connectedEvent: any = null;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for websocket connection')); 
    }, 3000);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('open', handleOpen);
      ws.off('message', handleMessage);
      ws.off('error', handleError);
    };

    const finishIfReady = () => {
      if (!opened || !connectedEvent) {
        return;
      }
      cleanup();
      resolve({socket: ws, connected: connectedEvent});
    };

    const handleOpen = () => {
      opened = true;
      finishIfReady();
    };

    const handleMessage = (payload: RawData) => {
      const event = JSON.parse(payload.toString());
      if (event.type !== 'connected') {
        return;
      }
      connectedEvent = event;
      finishIfReady();
    };

    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };

    ws.on('open', handleOpen);
    ws.on('message', handleMessage);
    ws.on('error', handleError);
  });
}

async function connectSocketExpectStatus(
  port: number,
  options: {cookie?: string; origin?: string; reconnectToken?: string; extraHeaders?: Record<string, string>},
) {
  return await new Promise<number>((resolve, reject) => {
    const suffix = options.reconnectToken ? `?reconnectToken=${options.reconnectToken}` : '';
    const ws = new WebSocket(`ws://127.0.0.1:${port}${config.multiplayerWebSocketPath}${suffix}`, {
      headers: {
        ...(options.cookie ? {Cookie: `${config.sessionCookieName}=${options.cookie}`} : {}),
        ...(options.origin ? {Origin: options.origin} : {}),
        ...(options.extraHeaders ?? {}),
      }
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for websocket rejection'));
    }, 3000);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.removeAllListeners();
    };

    ws.once('unexpected-response', (_request: IncomingMessage, response: IncomingMessage) => {
      const statusCode = response.statusCode ?? 0;
      response.resume();
      cleanup();
      resolve(statusCode);
    });
    ws.once('error', (error) => {
      cleanup();
      reject(error);
    });
    ws.once('open', () => {
      cleanup();
      ws.close();
      reject(new Error('Expected websocket upgrade to be rejected.'));
    });
  });
}

async function waitFor(predicate: () => boolean | Promise<boolean>) {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > 3000) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}


test('duplicate start after game begins is rejected', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'dup_start_host');
  const guestCookie = await signup(app, 'dup_start_guest');
  const created = await app.inject({ method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie} });
  const roomCode = created.json().roomCode as string;
  await app.inject({ method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode} });
  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const hostEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', () => undefined);
  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  guestSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready)));
  hostSocket.send(JSON.stringify({type: 'start_game'}));
  await waitFor(() => hostEvents.some((event) => event.type === 'game_snapshot'));
  hostSocket.send(JSON.stringify({type: 'start_game'}));
  await waitFor(() => hostEvents.some((event) => event.type === 'error' && event.error === 'Game has already started.'));
  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('rest leave updates active room and game snapshots', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'leave_sync_host');
  const guestCookie = await signup(app, 'leave_sync_guest');
  const created = await app.inject({ method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie} });
  const roomCode = created.json().roomCode as string;
  await app.inject({ method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode} });
  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));
  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  guestSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready)));
  hostSocket.send(JSON.stringify({type: 'start_game'}));
  await waitFor(() => guestEvents.some((event) => event.type === 'game_snapshot'));
  await app.inject({ method: 'POST', url: '/api/multiplayer/leave', cookies: {avoid_poop_session: hostCookie} });
  await waitFor(() => guestEvents.some((event) => event.type === 'room_snapshot' && event.room.playerCount === 1));
  await waitFor(() => guestEvents.some((event) => event.type === 'game_snapshot' && event.game.players.some((player: {userId: number; status: string}) => player.userId === 1 && player.status === 'spectator')));
  hostSocket.close();
  guestSocket.close();
  await app.close();
});


test('socket leave_room uses the same cleanup path as REST leave', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'socket_leave_host');
  const guestCookie = await signup(app, 'socket_leave_guest');
  const created = await app.inject({ method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie} });
  const roomCode = created.json().roomCode as string;
  await app.inject({ method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode} });

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  guestSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready)));
  hostSocket.send(JSON.stringify({type: 'start_game'}));
  await waitFor(() => guestEvents.some((event) => event.type === 'game_snapshot'));

  guestSocket.send(JSON.stringify({type: 'leave_room'}));

  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot' && event.room.playerCount === 1));
  await waitFor(() => hostEvents.some((event) => event.type === 'game_snapshot' && event.game.players.some((player: {userId: number; status: string}) => player.userId === 2 && player.status === 'spectator')));

  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('chat messages broadcast into the lobby stream', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'chat_host');
  const guestCookie = await signup(app, 'chat_guest');
  const created = await app.inject({method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie}});
  const roomCode = created.json().roomCode as string;
  await app.inject({method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode}});

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const guestEvents: Array<any> = [];
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));

  await waitFor(() => guestEvents.some((event) => event.type === 'room_snapshot'));

  hostSocket.send(JSON.stringify({type: 'send_chat', message: '안녕'}));

  await waitFor(() => guestEvents.some((event) => event.type === 'chat_message' && event.chatMessage.message === '안녕'));
  await waitFor(() => guestEvents.some((event) => event.type === 'room_snapshot' && event.room.chatMessages.some((entry: {message: string}) => entry.message === '안녕')));

  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('host can transfer host ownership inside the lobby', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'transfer_host_owner');
  const guestCookie = await signup(app, 'transfer_host_guest');
  const created = await app.inject({method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie}});
  const roomCode = created.json().roomCode as string;
  await app.inject({method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode}});

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));

  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot'));
  hostSocket.send(JSON.stringify({type: 'transfer_host', targetUserId: 2}));

  await waitFor(() =>
    guestEvents.some((event) =>
      event.type === 'room_snapshot'
      && event.room.hostUserId === 2
      && event.room.players.some((player: {userId: number; isHost: boolean; ready: boolean}) => player.userId === 2 && player.isHost && player.ready)
    )
  );

  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('host can kick a player out of the lobby and the kicked client is detached', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'kick_host_owner');
  const guestCookie = await signup(app, 'kick_host_guest');
  const created = await app.inject({method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie}});
  const roomCode = created.json().roomCode as string;
  await app.inject({method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode}});

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const hostEvents: Array<any> = [];
  const guestEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));
  guestSocket.on('message', (payload: RawData) => guestEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));

  await waitFor(() => guestEvents.some((event) => event.type === 'room_snapshot'));
  hostSocket.send(JSON.stringify({type: 'kick_player', targetUserId: 2}));

  await waitFor(() => guestEvents.some((event) => event.type === 'room_departed' && event.reason === 'kicked'));
  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot' && event.room.playerCount === 1));

  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  await waitFor(() => guestEvents.some((event) => event.type === 'error' && event.error === 'You are not a member of this room.'));

  hostSocket.close();
  guestSocket.close();
  await app.close();
});

test('malformed websocket payloads are rejected without crashing the socket', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const cookie = await signup(app, 'malformed_socket_user');
  const {socket} = await connectSocketAndWaitForConnected(port, cookie);
  const events: Array<any> = [];
  socket.on('message', (payload: RawData) => events.push(JSON.parse(payload.toString())));

  socket.send('{bad json');
  await waitFor(() => events.some((event) => event.type === 'error' && event.error === 'Invalid socket payload.'));

  socket.close();
  await app.close();
});

test('non-gameplay websocket messages are rate limited', { concurrency: false }, async () => {
  const app = await createApp({
    rateLimits: { writes: { max: 1, windowMs: 60_000 } } as never,
  });
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'message_limit_host');
  const created = await app.inject({ method: 'POST', url: '/api/multiplayer/rooms', cookies: {avoid_poop_session: hostCookie} });
  const roomCode = created.json().roomCode as string;
  const {socket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const events: Array<any> = [];
  socket.on('message', (payload: RawData) => events.push(JSON.parse(payload.toString())));

  try {
    socket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
    await waitFor(() => events.some((event) => event.type === 'room_snapshot'));
    socket.send(JSON.stringify({type: 'set_ready', ready: true}));
    socket.send(JSON.stringify({type: 'set_ready', ready: false}));
    await waitFor(() => events.some((event) => event.type === 'error' && event.error === 'Too many requests. Try again later.'));
  } finally {
    socket.close();
    await app.close();
  }
});

test('jump event marks the player airborne when body block is enabled', { concurrency: false }, async () => {
  const app = await createApp();
  await app.listen({port: 0, host: '127.0.0.1'});
  const port = Number((app.server.address() as {port: number}).port);
  const hostCookie = await signup(app, 'jump_host');
  const guestCookie = await signup(app, 'jump_guest');
  const created = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {avoid_poop_session: hostCookie},
    payload: {options: {difficulty: 'normal', bodyBlock: true, debuffTier: 2}}
  });
  const roomCode = created.json().roomCode as string;
  await app.inject({method: 'POST', url: '/api/multiplayer/join', cookies: {avoid_poop_session: guestCookie}, payload: {roomCode}});

  const {socket: hostSocket} = await connectSocketAndWaitForConnected(port, hostCookie);
  const {socket: guestSocket} = await connectSocketAndWaitForConnected(port, guestCookie);
  const hostEvents: Array<any> = [];
  hostSocket.on('message', (payload: RawData) => hostEvents.push(JSON.parse(payload.toString())));

  hostSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  guestSocket.send(JSON.stringify({type: 'subscribe_room', roomCode}));
  hostSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  guestSocket.send(JSON.stringify({type: 'set_ready', ready: true}));
  await waitFor(() => hostEvents.some((event) => event.type === 'room_snapshot' && event.room.players.every((player: {ready: boolean}) => player.ready)));
  hostSocket.send(JSON.stringify({type: 'start_game'}));
  await waitFor(() => hostEvents.some((event) => event.type === 'game_snapshot'));

  hostSocket.send(JSON.stringify({type: 'jump'}));

  await waitFor(() => hostEvents.some((event) => event.type === 'game_snapshot' && event.game.players.some((player: {userId: number; airborneUntil: number | null}) => player.userId === 1 && typeof player.airborneUntil === 'number')));

  hostSocket.close();
  guestSocket.close();
  await app.close();
});
