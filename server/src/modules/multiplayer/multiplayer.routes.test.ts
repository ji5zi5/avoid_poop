import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {createApp} from '../../app.js';
import {resetDbForTests} from '../../db/client.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-multiplayer-test.sqlite');
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

test.afterEach(async () => {
  await resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('multiplayer endpoints require authentication', async () => {
  const app = await createApp();

  const requests = [
    {method: 'POST', url: '/api/multiplayer/rooms', payload: {}},
    {method: 'POST', url: '/api/multiplayer/join', payload: {roomCode: 'ABC123'}},
    {method: 'POST', url: '/api/multiplayer/quick-join', payload: {}},
    {method: 'GET', url: '/api/multiplayer/rooms'},
    {method: 'GET', url: '/api/multiplayer/rooms/ABC123'}
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401);
  }

  await app.close();
});

test('creating a room returns the room code and host assignment', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'host_user');

  const response = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {
      avoid_poop_session: host.cookie
    },
    payload: {
      options: {
        difficulty: 'hard',
        visibility: 'private',
        bodyBlock: true,
        debuffTier: 3
      },
      maxPlayers: 4,
      privatePassword: 'secret-pass'
    }
  });

  assert.equal(response.statusCode, 201);
  const room = response.json();
  assert.match(room.roomCode, /^[A-Z0-9]{6}$/);
  assert.equal(room.hostUserId, host.user.id);
  assert.equal(room.status, 'waiting');
  assert.equal(room.maxPlayers, 4);
  assert.equal(room.playerCount, 1);
  assert.deepEqual(room.options, {difficulty: 'hard', visibility: 'private', bodyBlock: true, debuffTier: 3});
  assert.deepEqual(room.players, [
    {
      userId: host.user.id,
      username: host.user.username,
      isHost: true,
      ready: false
    }
  ]);
  assert.deepEqual(room.chatMessages, []);

  const getRoom = await app.inject({
    method: 'GET',
    url: `/api/multiplayer/rooms/${room.roomCode}`,
    cookies: {
      avoid_poop_session: host.cookie
    }
  });

  assert.equal(getRoom.statusCode, 200);
  assert.deepEqual(getRoom.json(), room);
  await app.close();
});

test('room-specific max players caps joins before the global ceiling', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'cap_host');
  const guestOne = await signupAndGetCookie(app, 'cap_guest_one');
  const guestTwo = await signupAndGetCookie(app, 'cap_guest_two');

  const createRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: host.cookie },
    payload: { maxPlayers: 2 },
  });
  const room = createRoom.json();

  const firstJoin = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: { avoid_poop_session: guestOne.cookie },
    payload: { roomCode: room.roomCode },
  });
  assert.equal(firstJoin.statusCode, 200);
  assert.equal(firstJoin.json().playerCount, 2);

  const secondJoin = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: { avoid_poop_session: guestTwo.cookie },
    payload: { roomCode: room.roomCode },
  });
  assert.equal(secondJoin.statusCode, 409);
  assert.equal(secondJoin.json().error, 'Room is full.');

  await app.close();
});

test('joining by room code adds the authenticated player to the room', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'join_host');
  const guest = await signupAndGetCookie(app, 'join_guest');

  const createRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {
      avoid_poop_session: host.cookie
    },
    payload: {}
  });
  const createdRoom = createRoom.json();

  const joinRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: {
      avoid_poop_session: guest.cookie
    },
    payload: {
      roomCode: createdRoom.roomCode.toLowerCase()
    }
  });

  assert.equal(joinRoom.statusCode, 200);
  const joinedRoom = joinRoom.json();
  assert.equal(joinedRoom.roomCode, createdRoom.roomCode);
  assert.equal(joinedRoom.playerCount, 2);
  assert.deepEqual(joinedRoom.players, [
    {
      userId: host.user.id,
      username: host.user.username,
      isHost: true,
      ready: false
    },
    {
      userId: guest.user.id,
      username: guest.user.username,
      isHost: false,
      ready: false
    }
  ]);

  const hostView = await app.inject({
    method: 'GET',
    url: `/api/multiplayer/rooms/${createdRoom.roomCode}`,
    cookies: {
      avoid_poop_session: host.cookie
    }
  });

  assert.equal(hostView.statusCode, 200);
  assert.equal(hostView.json().playerCount, 2);
  await app.close();
});

test('joining a listed private room requires the matching password', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'private_join_host');
  const guest = await signupAndGetCookie(app, 'private_join_guest');

  const createRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: host.cookie },
    payload: {
      options: { visibility: 'private' },
      privatePassword: 'secret-pass'
    }
  });
  const privateRoom = createRoom.json();

  const wrongPassword = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: { avoid_poop_session: guest.cookie },
    payload: {
      roomCode: privateRoom.roomCode,
      privatePassword: 'wrong-pass'
    }
  });

  assert.equal(wrongPassword.statusCode, 403);
  assert.equal(wrongPassword.json().error, 'Private room password is incorrect.');

  const joinRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/join',
    cookies: { avoid_poop_session: guest.cookie },
    payload: {
      roomCode: privateRoom.roomCode,
      privatePassword: 'secret-pass'
    }
  });

  assert.equal(joinRoom.statusCode, 200);
  assert.equal(joinRoom.json().playerCount, 2);
  await app.close();
});

test('room listing returns both public and private waiting rooms with public rooms first', async () => {
  const app = await createApp();
  const publicHost = await signupAndGetCookie(app, 'public_list_host');
  const privateHost = await signupAndGetCookie(app, 'private_list_host');

  await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: publicHost.cookie },
    payload: { options: { visibility: 'public', difficulty: 'hard' } }
  });
  await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: privateHost.cookie },
    payload: { options: { visibility: 'private' }, privatePassword: 'hidden-pass' }
  });

  const listRooms = await app.inject({
    method: 'GET',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: publicHost.cookie }
  });

  assert.equal(listRooms.statusCode, 200);
  const rooms = listRooms.json();
  assert.equal(Array.isArray(rooms), true);
  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].options.visibility, 'public');
  assert.equal(rooms[1].options.visibility, 'private');
  assert.equal(rooms[0].hostUsername, 'public_list_host');
  assert.match(rooms[0].roomId, /^[0-9a-f-]{36}$/);
  assert.equal('players' in rooms[0], false);
  assert.equal('roomCode' in rooms[0], false);
  assert.equal('chatMessages' in rooms[1], false);
  await app.close();
});

test('creating a private room without a password is rejected', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'private_needs_password');

  const response = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: host.cookie },
    payload: { options: { visibility: 'private' } }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'Private rooms require a password.');
  await app.close();
});

test('room lookup rejects authenticated users who have not joined the room', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'lookup_host');
  const outsider = await signupAndGetCookie(app, 'lookup_outsider');

  const createRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: {
      avoid_poop_session: host.cookie
    },
    payload: {}
  });
  const createdRoom = createRoom.json();

  const lookup = await app.inject({
    method: 'GET',
    url: `/api/multiplayer/rooms/${createdRoom.roomCode}`,
    cookies: {
      avoid_poop_session: outsider.cookie
    }
  });

  assert.equal(lookup.statusCode, 403);
  assert.equal(lookup.json().error, 'You are not a member of this room.');
  await app.close();
});

test('quick join reuses a waiting room and creates one when none exist', async () => {
  const app = await createApp();
  const firstPlayer = await signupAndGetCookie(app, 'quick_one');
  const secondPlayer = await signupAndGetCookie(app, 'quick_two');

  const firstJoin = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/quick-join',
    cookies: {
      avoid_poop_session: firstPlayer.cookie
    },
    payload: {}
  });

  assert.equal(firstJoin.statusCode, 200);
  const createdRoom = firstJoin.json();
  assert.match(createdRoom.roomCode, /^[A-Z0-9]{6}$/);
  assert.equal(createdRoom.playerCount, 1);
  assert.equal(createdRoom.hostUserId, firstPlayer.user.id);

  const secondJoin = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/quick-join',
    cookies: {
      avoid_poop_session: secondPlayer.cookie
    },
    payload: {}
  });

  assert.equal(secondJoin.statusCode, 200);
  const matchedRoom = secondJoin.json();
  assert.equal(matchedRoom.roomCode, createdRoom.roomCode);
  assert.equal(matchedRoom.playerCount, 2);
  assert.deepEqual(matchedRoom.options, {difficulty: 'normal', visibility: 'public', bodyBlock: false, debuffTier: 2});
  assert.deepEqual(matchedRoom.players, [
    {
      userId: firstPlayer.user.id,
      username: firstPlayer.user.username,
      isHost: true,
      ready: false
    },
    {
      userId: secondPlayer.user.id,
      username: secondPlayer.user.username,
      isHost: false,
      ready: false
    }
  ]);

  await app.close();
});

async function signupAndGetCookie(app: Awaited<ReturnType<typeof createApp>>, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      username,
      password: 'secret123'
    }
  });

  assert.equal(response.statusCode, 200);

  return {
    cookie: response.cookies[0]!.value,
    user: response.json().user as {
      id: number;
      username: string;
    }
  };
}


test('leave endpoint removes the user from the room', async () => {
  const app = await createApp();
  const host = await signupAndGetCookie(app, 'leave_host');
  const guest = await signupAndGetCookie(app, 'leave_guest');

  const createRoom = await app.inject({ method: 'POST', url: '/api/multiplayer/rooms', cookies: { avoid_poop_session: host.cookie }, payload: {} });
  const createdRoom = createRoom.json();

  await app.inject({ method: 'POST', url: '/api/multiplayer/join', cookies: { avoid_poop_session: guest.cookie }, payload: { roomCode: createdRoom.roomCode } });

  const leave = await app.inject({ method: 'POST', url: '/api/multiplayer/leave', cookies: { avoid_poop_session: guest.cookie } });
  assert.equal(leave.statusCode, 200);

  const hostView = await app.inject({ method: 'GET', url: `/api/multiplayer/rooms/${createdRoom.roomCode}`, cookies: { avoid_poop_session: host.cookie } });
  assert.equal(hostView.json().playerCount, 1);
  await app.close();
});


test('private rooms are skipped by quick join', async () => {
  const app = await createApp();
  const privateHost = await signupAndGetCookie(app, 'private_host');
  const quickUser = await signupAndGetCookie(app, 'quick_public');

  const privateRoom = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/rooms',
    cookies: { avoid_poop_session: privateHost.cookie },
    payload: { options: { visibility: 'private' }, privatePassword: 'hidden-pass' }
  });
  assert.equal(privateRoom.statusCode, 201);

  const quickJoin = await app.inject({
    method: 'POST',
    url: '/api/multiplayer/quick-join',
    cookies: { avoid_poop_session: quickUser.cookie },
    payload: {}
  });

  assert.equal(quickJoin.statusCode, 200);
  assert.notEqual(quickJoin.json().roomCode, privateRoom.json().roomCode);
  assert.equal(quickJoin.json().options.visibility, 'public');
  await app.close();
});
