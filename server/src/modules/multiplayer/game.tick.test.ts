import assert from 'node:assert/strict';
import test from 'node:test';

import {MultiplayerGameService} from './game.service.js';

const service = new MultiplayerGameService();

function createRoomSummary(difficulty: 'normal' | 'hard' | 'nightmare' = 'normal', bodyBlock = false, debuffTier: 2 | 3 = 2) {
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
      difficulty,
      visibility: 'public' as const,
      bodyBlock,
      debuffTier
    },
    chatMessages: []
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
  assert.ok(['pressure_intro', 'lane_intro', 'corridor_intro'].includes(game.bossThemeId ?? ''));
  assert.ok(game.bossPatternQueue.length > 0);
  assert.ok(game.bossPatternQueue.every((pattern) => [
    'half_stomp_alternating',
    'closing_doors',
    'center_crush',
    'double_side_stomp',
    'door_jam',
    'zigzag_corridor',
    'edge_tunnel',
    'staircase_corridor',
    'switch_press',
    'crossfall_mix',
    'center_swing',
    'shifting_corridor',
    'center_break',
    'last_hit_followup',
  ].includes(pattern)));
});

test('body block option separates overlapping alive players', () => {
  const game = service.createGame(createRoomSummary('normal', true));
  game.players[0]!.x = 120;
  game.players[1]!.x = 130;

  service.tick(game, 0, 1_000);

  const first = game.players[0]!;
  const second = game.players[1]!;
  assert.ok(first.x + first.width <= second.x || second.x + second.width <= first.x);
});

test('jump skips body-block separation while airborne', () => {
  const game = service.createGame(createRoomSummary('normal', true));
  game.players[0]!.x = 120;
  game.players[1]!.x = 130;

  assert.equal(service.jumpPlayer(game, 1, 1_000), true);
  service.tick(game, 0, 1_100);

  const first = game.players[0]!;
  const second = game.players[1]!;
  assert.ok(first.x + first.width > second.x);
  assert.ok(first.airborneUntil && first.airborneUntil > 1_100);
});

test('hard rooms spawn hazards sooner than normal rooms', () => {
  const normalGame = service.createGame(createRoomSummary('normal'));
  const hardGame = service.createGame(createRoomSummary('hard'));

  service.tick(normalGame, 0.85, 1_000);
  service.tick(hardGame, 0.85, 1_000);

  assert.equal(normalGame.hazards.length, 0);
  assert.ok(hardGame.hazards.length >= 1);
  assert.equal(typeof hardGame.hazards[0]?.variant, 'string');
  assert.equal(hardGame.hazards[0]?.owner, 'wave');
});

test('nightmare rooms spawn hazards sooner than hard rooms', () => {
  const hardGame = service.createGame(createRoomSummary('hard'));
  const nightmareGame = service.createGame(createRoomSummary('nightmare'));

  service.tick(hardGame, 0.78, 1_000);
  service.tick(nightmareGame, 0.78, 1_000);

  assert.equal(hardGame.hazards.length, 0);
  assert.ok(nightmareGame.hazards.length >= 1);
});

test('nightmare rooms enter a boss on every round after the first', () => {
  const game = service.createGame(createRoomSummary('nightmare'));
  game.elapsedInPhase = 7.4;

  service.tick(game, 0.2, 2_000);

  assert.equal(game.round, 2);
  assert.equal(game.phase, 'boss');
  assert.ok(game.bossPatternQueue.length > 0);
});

test('debuff item spawn and collect targets a random alive opponent', () => {
  const game = service.createGame(createRoomSummary('normal', false, 2));
  service.applyPlayerHit(game, 3, 3);
  const item = service.spawnDebuffItem(game, 160, 200);

  const result = service.collectItem(game, 1, item.id, 10_000, 0);

  assert.equal(game.items.length, 0);
  assert.equal(result?.targetUserId, 2);
  assert.equal(result?.debuffType, 'slow');
  const target = game.players.find((entry) => entry.userId === 2)!;
  assert.deepEqual(target.activeDebuffs.map((entry) => entry.type), ['slow']);
});

test('multiplayer tick evolves split hazards into multiple children', () => {
  const game = service.createGame(createRoomSummary('hard'));
  game.hazards.push({
    id: 1,
    owner: 'wave',
    x: 120,
    y: 140,
    width: 24,
    height: 24,
    speed: 180,
    variant: 'large',
    behavior: 'split',
    splitAtY: 150,
    splitChildCount: 3,
    splitChildSize: 14,
    splitChildSpeed: 170,
    splitChildSpread: 72,
  });
  game.nextHazardId = 2;

  service.tick(game, 0.1, 1_000);

  const childHazards = game.hazards.filter((hazard) => hazard.width === 14);
  assert.equal(childHazards.length, 3);
  assert.ok(childHazards.some((hazard) => (hazard.velocityX ?? 0) < 0));
  assert.ok(childHazards.some((hazard) => (hazard.velocityX ?? 0) > 0));
});

test('multiplayer tick lets hard bounce hazards rebound multiple times', () => {
  const game = service.createGame(createRoomSummary('hard'));
  game.spawnTimer = -999;
  game.hazards.push({
    id: 1,
    owner: 'wave',
    x: 80,
    y: 460,
    width: 20,
    height: 20,
    speed: 190,
    variant: 'medium',
    behavior: 'bounce',
    bouncesRemaining: 3,
  });

  let bounceEvents = 0;
  let previousSpeed = game.hazards[0]?.speed ?? 0;
  for (let step = 0; step < 80 && game.hazards.length > 0; step += 1) {
    service.tick(game, 0.1, 2_000 + step * 100);
    const nextSpeed = game.hazards[0]?.speed ?? 0;
    if (previousSpeed > 0 && nextSpeed < 0) {
      bounceEvents += 1;
    }
    previousSpeed = nextSpeed;
  }

  assert.ok(bounceEvents >= 3);
  assert.equal(game.hazards.length, 0);
});

test('normal multiplayer bounce hazards keep the same lighter lateral rebound as single-player', () => {
  const game = service.createGame(createRoomSummary('normal'));
  game.spawnTimer = -999;
  game.hazards.push({
    id: 1,
    owner: 'wave',
    x: 80,
    y: 460,
    width: 18,
    height: 18,
    speed: 180,
    variant: 'small',
    behavior: 'bounce',
    bouncesRemaining: 1,
  });

  service.tick(game, 0.2, 3_000);
  assert.equal(game.hazards[0]?.velocityX, 74);
});

test('boss phase publishes telegraph text and boss-owned hazards from the approved subset', () => {
  const game = service.createGame(createRoomSummary('hard'));
  game.round = 2;
  game.elapsedInPhase = 7.9;

  service.tick(game, 0.2, 4_000);
  assert.equal(game.phase, 'boss');

  service.tick(game, 0.1, 4_100);
  assert.ok(game.bossTelegraphText.length > 0);

  for (let step = 0; step < 20 && game.hazards.filter((hazard) => hazard.owner === 'boss').length === 0; step += 1) {
    service.tick(game, 0.2, 4_200 + step * 200);
  }

  assert.ok(game.hazards.some((hazard) => hazard.owner === 'boss'));
});

test('boss completion keeps recent boss memory for the next encounter', () => {
  const game = service.createGame(createRoomSummary('hard'));
  game.phase = 'boss';
  game.elapsedInPhase = 12.9;
  game.bossRecentPatterns = ['door_jam'];
  game.bossRecentThemes = ['pressure_intro'];
  game.bossThemeId = 'pressure_intro';
  game.bossThemeLabel = '측면 압박';

  service.tick(game, 0.2, 9_000);

  assert.equal(game.phase, 'wave');
  assert.deepEqual(game.bossRecentPatterns, ['door_jam']);
  assert.deepEqual(game.bossRecentThemes, ['pressure_intro']);
});


test('input delay debuff queues movement until the delay window passes', () => {
  const game = service.createGame(createRoomSummary('normal', false, 2));
  service.applyPlayerHit(game, 3, 3);
  const item = service.spawnDebuffItem(game, game.players[0]!.x, game.players[0]!.y);
  const result = service.collectItem(game, 1, item.id, 10_000, 0.95);

  assert.equal(result?.debuffType, 'input_delay');

  const target = game.players.find((entry) => entry.userId === 2)!;
  const startX = target.x;
  service.setPlayerDirection(game, 2, 1, 10_100);
  service.tick(game, 0.1, 10_200);
  assert.equal(target.x, startX);

  service.tick(game, 0.1, 10_320);
  assert.ok(target.x > startX);
});

test('item lock debuff blocks the target from collecting new items', () => {
  const game = service.createGame(createRoomSummary('normal', false, 3));
  service.applyPlayerHit(game, 3, 3);
  const lockItem = service.spawnDebuffItem(game, game.players[0]!.x, game.players[0]!.y);
  const lockResult = service.collectItem(game, 1, lockItem.id, 20_000, 0.99);

  assert.equal(lockResult?.debuffType, 'item_lock');

  const target = game.players.find((entry) => entry.userId === 2)!;
  const followupItem = service.spawnDebuffItem(game, target.x, target.y);
  service.tick(game, 0, 20_050);

  assert.ok(game.items.some((entry) => entry.id === followupItem.id));
});
