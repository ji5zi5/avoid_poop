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

test.afterEach(() => {
  resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('websocket connect requires authentication', async () => {
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

test('subscribing to a room broadcasts room snapshots to room members', async () => {
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

test('pre-ready start is rejected before room start', async () => {
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

test('host can start a game and clients receive game snapshots', async () => {
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

test('reconnect token can be reused within grace period', async () => {
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

test('reconnecting to an active game restores the player from disconnected state', async () => {
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

async function signup(app: Awaited<ReturnType<typeof createApp>>, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      username,
      password: 'secret123'
    }
  });

  assert.equal(response.statusCode, 200);
  return response.cookies[0]!.value;
}

async function connectSocketAndWaitForConnected(port: number, cookie: string, reconnectToken?: string) {
  return await new Promise<{socket: WebSocket; connected: any}>((resolve, reject) => {
    const suffix = reconnectToken ? `?reconnectToken=${reconnectToken}` : '';
    const ws = new WebSocket(`ws://127.0.0.1:${port}${config.multiplayerWebSocketPath}${suffix}`, {
      headers: {
        Cookie: `${config.sessionCookieName}=${cookie}`
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

async function waitFor(predicate: () => boolean) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > 3000) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}


test('duplicate start after game begins is rejected', async () => {
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

test('rest leave updates active room and game snapshots', async () => {
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


test('socket leave_room uses the same cleanup path as REST leave', async () => {
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
