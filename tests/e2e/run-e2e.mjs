import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";

process.env.DB_PATH = path.join(process.cwd(), "server", "data", "avoid-poop-e2e.sqlite");

const {createApp} = await import("../../server/src/app.ts");
const {config} = await import("../../server/src/config.ts");
const {resetDbForTests} = await import("../../server/src/db/client.ts");

async function main() {
  const app = await createApp();
  await app.listen({port: 0, host: "127.0.0.1"});
  const port = Number(app.server.address().port);

  try {
    const username = `player_${Date.now()}`;
    const guestUsername = `guest_${Date.now()}`;

    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: {
        username,
        password: "secret123"
      }
    });
    assert.equal(signup.statusCode, 200);

    const cookie = signup.cookies[0];
    assert.ok(cookie?.value, "expected session cookie");

    const guestSignup = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: {
        username: guestUsername,
        password: "secret123"
      }
    });
    assert.equal(guestSignup.statusCode, 200);
    const guestCookie = guestSignup.cookies[0];
    assert.ok(guestCookie?.value, "expected guest session cookie");
    const guestUser = guestSignup.json().user;

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: {
        [config.sessionCookieName]: cookie.value
      }
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.username, username);
    assert.equal(me.json().authenticated, true);

    const normalSave = await app.inject({
      method: "POST",
      url: "/api/records",
      cookies: {
        [config.sessionCookieName]: cookie.value
      },
      payload: {
        mode: "normal",
        score: 111,
        reachedRound: 3,
        survivalTime: 17.4,
        clear: false
      }
    });
    assert.equal(normalSave.statusCode, 201);

    const hardSave = await app.inject({
      method: "POST",
      url: "/api/records",
      cookies: {
        [config.sessionCookieName]: cookie.value
      },
      payload: {
        mode: "hard",
        score: 222,
        reachedRound: 5,
        survivalTime: 24.8,
        clear: false
      }
    });
    assert.equal(hardSave.statusCode, 201);

    const records = await app.inject({
      method: "GET",
      url: "/api/records",
      cookies: {
        [config.sessionCookieName]: cookie.value
      }
    });
    assert.equal(records.statusCode, 200);
    const recordsBody = records.json();
    assert.equal(recordsBody.best.normal.score, 111);
    assert.equal(recordsBody.best.hard.score, 222);
    assert.equal(recordsBody.recent.length, 2);

    const roomCreate = await app.inject({
      method: "POST",
      url: "/api/multiplayer/rooms",
      cookies: {
        [config.sessionCookieName]: cookie.value
      },
      payload: {}
    });
    assert.equal(roomCreate.statusCode, 201);
    const createdRoom = roomCreate.json();

    const roomJoin = await app.inject({
      method: "POST",
      url: "/api/multiplayer/join",
      cookies: {
        [config.sessionCookieName]: guestCookie.value
      },
      payload: {
        roomCode: createdRoom.roomCode
      }
    });
    assert.equal(roomJoin.statusCode, 200);

    const {socket: hostSocket, connected: hostConnected} = await connectSocketAndWaitForConnected(port, cookie.value);
    const {socket: guestSocket, connected: guestConnected} = await connectSocketAndWaitForConnected(port, guestCookie.value);
    const hostEvents = [];
    const guestEvents = [];
    collectEvents(hostSocket, hostEvents);
    collectEvents(guestSocket, guestEvents);

    hostSocket.send(JSON.stringify({type: "subscribe_room", roomCode: createdRoom.roomCode}));
    guestSocket.send(JSON.stringify({type: "subscribe_room", roomCode: createdRoom.roomCode}));

    const initialHostRoomSnapshot = await waitForEvent(
      hostEvents,
      (event) => event.type === "room_snapshot" && event.room.playerCount === 2,
    );
    const initialGuestRoomSnapshot = await waitForEvent(
      guestEvents,
      (event) => event.type === "room_snapshot" && event.room.playerCount === 2,
    );
    assert.equal(initialHostRoomSnapshot.room.roomCode, createdRoom.roomCode);
    assert.equal(initialGuestRoomSnapshot.room.roomCode, createdRoom.roomCode);
    assert.equal(hostConnected.reconnected, false);
    assert.equal(guestConnected.reconnected, false);

    const hostPreReadyIndex = hostEvents.length;
    hostSocket.send(JSON.stringify({type: "start_game"}));
    const preReadyError = await waitForEvent(
      hostEvents,
      (event) => event.type === "error",
      {afterIndex: hostPreReadyIndex},
    );
    assert.equal(preReadyError.error, "All players must be ready before starting.");

    hostSocket.send(JSON.stringify({type: "set_ready", ready: true}));
    guestSocket.send(JSON.stringify({type: "set_ready", ready: true}));
    const readySnapshot = await waitForEvent(
      hostEvents,
      (event) => event.type === "room_snapshot" && event.room.players.every((player) => player.ready),
    );
    assert.equal(readySnapshot.room.players.every((player) => player.ready), true);

    const hostStartIndex = hostEvents.length;
    const guestStartIndex = guestEvents.length;
    hostSocket.send(JSON.stringify({type: "start_game"}));
    const hostGameSnapshot = await waitForEvent(
      hostEvents,
      (event) => event.type === "game_snapshot" && event.game.players.length === 2,
      {afterIndex: hostStartIndex},
    );
    const guestGameSnapshot = await waitForEvent(
      guestEvents,
      (event) => event.type === "game_snapshot" && event.game.players.length === 2,
      {afterIndex: guestStartIndex},
    );
    assert.equal(hostGameSnapshot.game.phase, "wave");
    assert.equal(guestGameSnapshot.game.phase, "wave");

    const hostDisconnectIndex = hostEvents.length;
    guestSocket.close();
    await waitFor(() => guestSocket.readyState === WebSocket.CLOSED);
    const disconnectedSnapshot = await waitForEvent(
      hostEvents,
      (event) =>
        event.type === "game_snapshot" &&
        event.game.players.some((player) => player.userId === guestUser.id && player.status === "disconnected"),
      {afterIndex: hostDisconnectIndex},
    );
    const disconnectedPlayer = disconnectedSnapshot.game.players.find((player) => player.userId === guestUser.id);
    assert.equal(disconnectedPlayer?.status, "disconnected");
    assert.ok(disconnectedPlayer?.disconnectDeadlineAt, "expected reconnect deadline while disconnected");

    const {socket: reconnectedGuestSocket, connected: reconnectedGuestConnected} =
      await connectSocketAndWaitForConnected(port, guestCookie.value, guestConnected.reconnectToken);
    assert.equal(reconnectedGuestConnected.reconnected, true);
    assert.equal(reconnectedGuestConnected.reconnectToken, guestConnected.reconnectToken);
    const reconnectedGuestEvents = [];
    collectEvents(reconnectedGuestSocket, reconnectedGuestEvents);

    const hostReconnectIndex = hostEvents.length;
    const guestReconnectIndex = reconnectedGuestEvents.length;
    reconnectedGuestSocket.send(JSON.stringify({type: "subscribe_room", roomCode: createdRoom.roomCode}));
    const reconnectedHostSnapshot = await waitForEvent(
      hostEvents,
      (event) =>
        event.type === "game_snapshot" &&
        event.game.players.some((player) => player.userId === guestUser.id && player.status === "alive"),
      {afterIndex: hostReconnectIndex},
    );
    const reconnectedGuestSnapshot = await waitForEvent(
      reconnectedGuestEvents,
      (event) =>
        event.type === "game_snapshot" &&
        event.game.players.some((player) => player.userId === guestUser.id && player.status === "alive"),
      {afterIndex: guestReconnectIndex},
    );
    assert.equal(
      reconnectedHostSnapshot.game.players.find((player) => player.userId === guestUser.id)?.status,
      "alive",
    );
    assert.equal(
      reconnectedGuestSnapshot.game.players.find((player) => player.userId === guestUser.id)?.status,
      "alive",
    );

    hostSocket.close();
    reconnectedGuestSocket.close();

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: {
        [config.sessionCookieName]: cookie.value
      }
    });
    assert.equal(logout.statusCode, 200);

    const meAfterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: {
        [config.sessionCookieName]: cookie.value
      }
    });
    assert.equal(meAfterLogout.statusCode, 401);

    console.log("e2e flow passed");
  } finally {
    await app.close();
    resetDbForTests();
    if (fs.existsSync(process.env.DB_PATH)) {
      fs.unlinkSync(process.env.DB_PATH);
    }
  }
}

function collectEvents(socket, events) {
  socket.on("message", (payload) => {
    events.push(JSON.parse(payload.toString()));
  });
}

async function connectSocketAndWaitForConnected(port, cookie, reconnectToken) {
  return await new Promise((resolve, reject) => {
    const suffix = reconnectToken ? `?reconnectToken=${reconnectToken}` : "";
    const ws = new WebSocket(`ws://127.0.0.1:${port}${config.multiplayerWebSocketPath}${suffix}`, {
      headers: {
        Cookie: `${config.sessionCookieName}=${cookie}`
      }
    });

    let opened = false;
    let connectedEvent = null;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket connection"));
    }, 3000);

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off("open", handleOpen);
      ws.off("message", handleMessage);
      ws.off("error", handleError);
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

    const handleMessage = (payload) => {
      const event = JSON.parse(payload.toString());
      if (event.type !== "connected") {
        return;
      }
      connectedEvent = event;
      finishIfReady();
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    ws.on("open", handleOpen);
    ws.on("message", handleMessage);
    ws.on("error", handleError);
  });
}

async function waitForEvent(events, predicate, {afterIndex = 0, timeoutMs = 3000} = {}) {
  await waitFor(() => events.slice(afterIndex).some(predicate), timeoutMs);
  return events.slice(afterIndex).find(predicate);
}

async function waitFor(predicate, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
