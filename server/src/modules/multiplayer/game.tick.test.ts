import assert from 'node:assert/strict';
import test from 'node:test';

import {MultiplayerGameService} from './game.service.js';

const service = new MultiplayerGameService();

function createRoomSummary(bodyBlock = false, debuffTier: 2 | 3 = 2) {
  return {
    roomCode: 'ROOM42',
    hostUserId: 1,
    status: 'waiting' as const,
    maxPlayers: 8 as const,
    playerCount: 3,
    players: [
      {userId: 1, username: 'alpha', isHost: true, ready: true},
      {userId: 2, username: 'beta', isHost: false, ready: true},
      {userId: 3, username: 'gamma', isHost: false, ready: true}
    ],
    options: {
      bodyBlock,
      debuffTier
    }
  };
}

test('creates shared map state for multiple players', () => {
  const game = service.createGame(createRoomSummary());

  assert.equal(game.players.length, 3);
  assert.equal(game.players[0]?.status, 'alive');
  assert.equal(game.players[1]?.status, 'alive');
  assert.notEqual(game.players[0]?.x, game.players[1]?.x);
  assert.equal(game.players[0]?.y, game.players[1]?.y);
});

test('last alive player wins', () => {
  const game = service.createGame(createRoomSummary());

  service.applyPlayerHit(game, 2, 3);
  service.applyPlayerHit(game, 3, 3);

  assert.equal(game.phase, 'complete');
  assert.equal(game.winnerUserId, 1);
});

test('dead players become spectators', () => {
  const game = service.createGame(createRoomSummary());

  service.applyPlayerHit(game, 2, 3);

  const player = game.players.find((entry) => entry.userId === 2);
  assert.equal(player?.status, 'spectator');
  assert.equal(player?.lives, 0);
});

test('reconnect within grace period preserves the player slot', () => {
  const game = service.createGame(createRoomSummary(), 1_000);
  const before = game.players.find((entry) => entry.userId === 2);
  const originalX = before?.x;

  assert.equal(service.disconnectPlayer(game, 2, 5_000), true);
  assert.equal(service.reconnectPlayer(game, 2, 10_000), true);

  const after = game.players.find((entry) => entry.userId === 2);
  assert.equal(after?.status, 'alive');
  assert.equal(after?.x, originalX);
});

test('disconnect grace prevents premature winner resolution', () => {
  const game = service.createGame(createRoomSummary(), 1_000);
  service.applyPlayerHit(game, 3, 3);

  assert.equal(service.disconnectPlayer(game, 2, 5_000), true);

  service.tick(game, 0.1, 5_100);

  assert.equal(game.phase, 'wave');
  assert.equal(game.winnerUserId, null);
  assert.equal(game.players.find((entry) => entry.userId === 2)?.status, 'disconnected');
});

test('wave phase transitions into boss phase on boss rounds', () => {
  const game = service.createGame(createRoomSummary());
  game.round = 2;
  game.elapsedInPhase = 8.9;

  service.tick(game, 0.2, 2_000);

  assert.equal(game.round, 3);
  assert.equal(game.phase, 'boss');
});

test('body block option separates overlapping alive players', () => {
  const game = service.createGame(createRoomSummary(true));
  game.players[0]!.x = 120;
  game.players[1]!.x = 130;

  service.tick(game, 0, 1_000);

  const first = game.players[0]!;
  const second = game.players[1]!;
  assert.ok(first.x + first.width <= second.x || second.x + second.width <= first.x);
});

test('debuff item spawn and collect targets a random alive opponent', () => {
  const game = service.createGame(createRoomSummary(false, 2));
  service.applyPlayerHit(game, 3, 3);
  const item = service.spawnDebuffItem(game, 160, 200);

  const result = service.collectItem(game, 1, item.id, 10_000, 0);

  assert.equal(game.items.length, 0);
  assert.equal(result?.targetUserId, 2);
  assert.equal(result?.debuffType, 'slow');
  const target = game.players.find((entry) => entry.userId === 2)!;
  assert.deepEqual(target.activeDebuffs.map((entry) => entry.type), ['slow']);
});
