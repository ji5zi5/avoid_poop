import {config} from '../../config.js';

import type {RoomSummary} from './multiplayer.schemas.js';
import {MultiplayerDebuffService} from './debuff.service.js';
import type {
  MultiplayerDebuffType,
  MultiplayerGameState,
  MultiplayerHazardState,
  MultiplayerItemState,
  MultiplayerPlayerState
} from './game.types.js';

const GAME_WIDTH = 360;
const GAME_HEIGHT = 520;
const PLAYER_WIDTH = 36;
const PLAYER_HEIGHT = 24;
const PLAYER_SPEED = 210;
const PLAYER_LIVES = 3;
const DEBUFF_ITEM_SIZE = 18;
const DEBUFF_DURATION_MS = 4000;
const JUMP_DURATION_MS = 650;
const INPUT_DELAY_MS = 180;

export class MultiplayerGameService {
  constructor(private readonly debuffService = new MultiplayerDebuffService()) {}

  createGame(room: RoomSummary, startedAt = Date.now()): MultiplayerGameState {
    return {
      roomCode: room.roomCode,
      options: room.options,
      startedAt,
      phase: 'wave',
      round: 1,
      elapsedInPhase: 0,
      spawnTimer: 0,
      nextHazardId: 1,
      nextItemId: 1,
      itemSpawnTimer: 0,
      hazards: [],
      items: [],
      players: room.players.map((player, index, players) => createPlayerState(player.userId, player.username, index, players.length)),
      placementOrder: [],
      winnerUserId: null
    };
  }

  setPlayerDirection(game: MultiplayerGameState, userId: number, direction: -1 | 0 | 1, now = Date.now()) {
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player || player.status !== 'alive') {
      return;
    }
    if (hasDebuff(player, 'input_delay')) {
      player.queuedDirection = direction;
      player.queuedDirectionAt = now + INPUT_DELAY_MS;
      return;
    }
    player.direction = direction;
    player.queuedDirection = direction;
    player.queuedDirectionAt = null;
  }

  jumpPlayer(game: MultiplayerGameState, userId: number, now = Date.now()) {
    if (!game.options.bodyBlock) {
      return false;
    }

    const player = game.players.find((entry) => entry.userId === userId);
    if (!player || player.status !== 'alive') {
      return false;
    }

    if (player.airborneUntil && player.airborneUntil > now) {
      return false;
    }

    player.airborneUntil = now + JUMP_DURATION_MS;
    return true;
  }

  disconnectPlayer(game: MultiplayerGameState, userId: number, now = Date.now()) {
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player || player.status === 'spectator') {
      return false;
    }

    player.status = 'disconnected';
    player.direction = 0;
    player.queuedDirection = 0;
    player.queuedDirectionAt = null;
    player.disconnectDeadlineAt = now + config.multiplayerReconnectGraceMs;
    player.airborneUntil = null;
    return true;
  }

  reconnectPlayer(game: MultiplayerGameState, userId: number, now = Date.now()) {
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player || player.status !== 'disconnected' || !player.disconnectDeadlineAt || player.disconnectDeadlineAt < now) {
      return false;
    }

    player.status = 'alive';
    player.disconnectDeadlineAt = null;
    return true;
  }

  applyPlayerHit(game: MultiplayerGameState, userId: number, damage = 1) {
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player || player.status !== 'alive') {
      return false;
    }

    player.lives = Math.max(0, player.lives - damage);
    if (player.lives === 0) {
      player.status = 'spectator';
      player.direction = 0;
      player.queuedDirection = 0;
      player.queuedDirectionAt = null;
      player.disconnectDeadlineAt = null;
      player.airborneUntil = null;
      recordPlacement(game, player.userId);
      this.resolveWinner(game);
    }
    return true;
  }

  spawnDebuffItem(game: MultiplayerGameState, x = GAME_WIDTH / 2 - DEBUFF_ITEM_SIZE / 2, y = GAME_HEIGHT / 2) {
    const item: MultiplayerItemState = {
      id: game.nextItemId,
      type: 'debuff',
      x,
      y,
      width: DEBUFF_ITEM_SIZE,
      height: DEBUFF_ITEM_SIZE
    };
    game.nextItemId += 1;
    game.items.push(item);
    return item;
  }

  collectItem(game: MultiplayerGameState, collectorUserId: number, itemId: number, now = Date.now(), randomValue = Math.random()) {
    const collector = game.players.find((entry) => entry.userId === collectorUserId);
    if (!collector || collector.status !== 'alive') {
      return null;
    }

    const itemIndex = game.items.findIndex((entry) => entry.id === itemId);
    if (itemIndex === -1) {
      return null;
    }

    game.items.splice(itemIndex, 1);
    const target = this.debuffService.chooseRandomTarget(game.players, collectorUserId, randomValue);
    if (!target) {
      return null;
    }

    const debuffType = this.debuffService.chooseDebuff(game.options, randomValue);
    this.applyDebuff(game, target.userId, debuffType, now);
    return {
      targetUserId: target.userId,
      debuffType
    };
  }

  tick(game: MultiplayerGameState, delta: number, now = Date.now()) {
    if (game.phase === 'complete') {
      return game;
    }

    game.elapsedInPhase += delta;
    game.spawnTimer += delta;
    game.itemSpawnTimer += delta;

    for (const player of game.players) {
      player.activeDebuffs = player.activeDebuffs.filter((debuff) => debuff.expiresAt > now);
      if (player.airborneUntil && player.airborneUntil <= now) {
        player.airborneUntil = null;
      }
      if (player.queuedDirectionAt && player.queuedDirectionAt <= now) {
        player.direction = player.queuedDirection;
        player.queuedDirectionAt = null;
      }
      if (player.status === 'alive') {
        const direction = getEffectiveDirection(player);
        const speed = getEffectiveSpeed(player);
        player.x = clamp(player.x + direction * speed * delta, 0, GAME_WIDTH - player.width);
      }
      if (player.status === 'disconnected' && player.disconnectDeadlineAt && player.disconnectDeadlineAt <= now) {
        player.status = 'spectator';
        player.disconnectDeadlineAt = null;
        recordPlacement(game, player.userId);
      }
    }

    if (game.options.bodyBlock) {
      resolveBodyBlock(game.players, now);
    }

    if (game.phase !== 'boss' && game.spawnTimer >= getSpawnInterval(game)) {
      game.spawnTimer = 0;
      game.hazards.push(createHazard(game.nextHazardId, game.round, game.phase, game.options.difficulty));
      game.nextHazardId += 1;
    }

    if (game.winnerUserId === null && game.itemSpawnTimer >= 4) {
      game.itemSpawnTimer = 0;
      this.spawnDebuffItem(game, getItemSpawnX(game.nextItemId), GAME_HEIGHT / 2 - 24);
    }

    for (const hazard of game.hazards) {
      hazard.y += hazard.speed * delta;
    }
    game.hazards = game.hazards.filter((hazard) => hazard.y < GAME_HEIGHT + hazard.height);

    this.resolveHazardCollisions(game);
    this.resolveItemCollections(game, now);

    this.resolveWinner(game, now);
    if (game.winnerUserId !== null) {
      return game;
    }

    if (game.phase === 'wave' && game.elapsedInPhase >= getRoundDuration(game)) {
      const nextRound = game.round + 1;
      game.round = nextRound;
      game.elapsedInPhase = 0;
      game.phase = shouldEnterBoss(nextRound) ? 'boss' : 'wave';
      return game;
    }

    if (game.phase === 'boss' && game.elapsedInPhase >= getBossDuration(game)) {
      game.elapsedInPhase = 0;
      game.phase = 'wave';
      return game;
    }

    return game;
  }

  private resolveHazardCollisions(game: MultiplayerGameState) {
    const remaining = [];
    for (const hazard of game.hazards) {
      let consumed = false;
      for (const player of game.players) {
        if (player.status !== 'alive') {
          continue;
        }
        if (overlaps(hazard.x, hazard.y, hazard.width, hazard.height, player.x, player.y, player.width, player.height)) {
          this.applyPlayerHit(game, player.userId, 1);
          consumed = true;
          break;
        }
      }
      if (!consumed) {
        remaining.push(hazard);
      }
    }
    game.hazards = remaining;
  }

  private resolveItemCollections(game: MultiplayerGameState, now: number) {
    const remaining = [];
    for (const item of game.items) {
      let consumed = false;
      for (const player of game.players) {
        if (player.status !== 'alive' || hasDebuff(player, 'item_lock')) {
          continue;
        }
        if (overlaps(item.x, item.y, item.width, item.height, player.x, player.y, player.width, player.height)) {
          this.collectItem(game, player.userId, item.id, now);
          consumed = true;
          break;
        }
      }
      if (!consumed) {
        remaining.push(item);
      }
    }
    game.items = remaining;
  }

  private applyDebuff(game: MultiplayerGameState, userId: number, debuffType: MultiplayerDebuffType, now: number) {
    const player = game.players.find((entry) => entry.userId === userId);
    if (!player) {
      return;
    }

    const existing = player.activeDebuffs.find((debuff) => debuff.type === debuffType);
    if (existing) {
      existing.expiresAt = now + DEBUFF_DURATION_MS;
      return;
    }

    player.activeDebuffs.push({
      type: debuffType,
      expiresAt: now + DEBUFF_DURATION_MS
    });
  }

  private resolveWinner(game: MultiplayerGameState, now = Date.now()) {
    const reconnectPending = game.players.some(
      (player) => player.status === 'disconnected' && !!player.disconnectDeadlineAt && player.disconnectDeadlineAt > now
    );
    if (reconnectPending) {
      return;
    }

    const alivePlayers = game.players.filter((player) => player.status === 'alive');
    if (alivePlayers.length > 1) {
      return;
    }

    if (alivePlayers[0]) {
      recordPlacement(game, alivePlayers[0].userId);
    }
    game.phase = 'complete';
    game.winnerUserId = alivePlayers[0]?.userId ?? null;
  }
}

function createPlayerState(userId: number, username: string, index: number, totalPlayers: number): MultiplayerPlayerState {
  const spacing = totalPlayers <= 1 ? 0 : (GAME_WIDTH - PLAYER_WIDTH) / Math.max(1, totalPlayers - 1);
  return {
    userId,
    username,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    x: Math.round(index * spacing),
    y: GAME_HEIGHT - 56,
    direction: 0,
    queuedDirection: 0,
    queuedDirectionAt: null,
    lives: PLAYER_LIVES,
    status: 'alive',
    disconnectDeadlineAt: null,
    airborneUntil: null,
    activeDebuffs: []
  };
}

function createHazard(id: number, round: number, phase: MultiplayerGameState['phase'], difficulty: 'normal' | 'hard'): MultiplayerHazardState {
  const size = phase === 'boss' ? 28 : difficulty === 'hard' ? 22 : 20;
  const laneCount = difficulty === 'hard' ? 7 : 6;
  const laneWidth = Math.max(1, Math.floor((GAME_WIDTH - size) / Math.max(1, laneCount - 1)));
  const lane = id % laneCount;
  return {
    id,
    owner: phase === 'boss' ? 'boss' : 'wave',
    width: size,
    height: size,
    x: Math.min(GAME_WIDTH - size, lane * laneWidth),
    y: -size,
    speed: phase === 'boss' ? 220 + round * 8 + (difficulty === 'hard' ? 22 : 0) : 160 + round * 6 + (difficulty === 'hard' ? 16 : 0)
  };
}

function recordPlacement(game: MultiplayerGameState, userId: number) {
  if (!game.placementOrder.includes(userId)) {
    game.placementOrder.push(userId);
  }
}

function shouldEnterBoss(round: number) {
  return round >= 3 && round % 3 === 0;
}

function getEffectiveDirection(player: MultiplayerPlayerState) {
  return hasDebuff(player, 'reverse') ? (player.direction * -1 as -1 | 0 | 1) : player.direction;
}

function getEffectiveSpeed(player: MultiplayerPlayerState) {
  return hasDebuff(player, 'slow') ? PLAYER_SPEED * 0.6 : PLAYER_SPEED;
}

function getRoundDuration(game: MultiplayerGameState) {
  return game.options.difficulty === 'hard' ? 8 : 9;
}

function getBossDuration(game: MultiplayerGameState) {
  return game.options.difficulty === 'hard' ? 13 : 11;
}

function getSpawnInterval(game: MultiplayerGameState) {
  const base = game.options.difficulty === 'hard' ? 0.72 : 0.85;
  return Math.max(0.38, base - (game.round - 1) * 0.025);
}

function getItemSpawnX(itemId: number) {
  const safePadding = 40;
  const lanes = 5;
  const laneWidth = (GAME_WIDTH - safePadding * 2) / (lanes - 1);
  return safePadding + (itemId % lanes) * laneWidth - DEBUFF_ITEM_SIZE / 2;
}

function hasDebuff(player: MultiplayerPlayerState, debuffType: MultiplayerDebuffType) {
  return player.activeDebuffs.some((debuff) => debuff.type === debuffType);
}

function resolveBodyBlock(players: MultiplayerPlayerState[], now: number) {
  const alivePlayers = players.filter((player) => player.status === 'alive' && (!player.airborneUntil || player.airborneUntil <= now));
  for (let index = 0; index < alivePlayers.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < alivePlayers.length; otherIndex += 1) {
      const left = alivePlayers[index]!;
      const right = alivePlayers[otherIndex]!;
      const overlap = left.x + left.width - right.x;
      const reverseOverlap = right.x + right.width - left.x;
      const actualOverlap = Math.min(overlap, reverseOverlap);
      if (actualOverlap <= 0) {
        continue;
      }

      const shift = Math.ceil(actualOverlap / 2);
      if (left.x <= right.x) {
        left.x = clamp(left.x - shift, 0, GAME_WIDTH - left.width);
        right.x = clamp(right.x + shift, 0, GAME_WIDTH - right.width);
      } else {
        left.x = clamp(left.x + shift, 0, GAME_WIDTH - left.width);
        right.x = clamp(right.x - shift, 0, GAME_WIDTH - right.width);
      }
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
