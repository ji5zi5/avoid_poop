import {config} from '../../config.js';
import { buildWaveDirectorForRound, buildWaveSpawnSpecs, createSharedWaveDirector, evolveSupportedHazards, getSharedWaveSpawnThreshold, type SharedWaveHazardSpec } from '../../../../shared/src/index.js';
import type { GameMode } from '../../../../shared/src/contracts/index.js';
import { runBossPattern } from '../../../../frontend/src/game/systems/bossPatterns.js';

import type {RoomSummary} from './multiplayer.schemas.js';
import { buildMultiplayerBossSubsetPlan, getMultiplayerBossThemeLabel } from './boss-subset.js';
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
const JUMP_DURATION_MS = 850;
const INPUT_DELAY_MS = 180;

export class MultiplayerGameService {
  constructor(private readonly debuffService = new MultiplayerDebuffService()) {}

  createGame(room: RoomSummary, startedAt = Date.now()): MultiplayerGameState {
    return {
      roomCode: room.roomCode,
      mode: room.options.difficulty,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      options: room.options,
      startedAt,
      phase: 'wave',
      round: 1,
      elapsedInPhase: 0,
      spawnTimer: 0,
      nextHazardId: 1,
      nextItemId: 1,
      itemSpawnTimer: 0,
      bossEncounterDuration: getDefaultBossDuration(room.options.difficulty),
      bossThemeId: null,
      bossThemeLabel: '',
      bossPatternQueue: [],
      bossPatternIndex: 0,
      bossPatternActiveId: null,
      bossPatternPhase: 'idle',
      bossRecentPatterns: [],
      bossRecentThemes: [],
      bossPatternTimer: 0,
      bossPatternStepTimer: 0,
      bossPatternShots: 0,
      bossPatternSeed: createServerBossSeed(room.roomCode, startedAt),
      bossPatternFamilyStreak: null,
      bossPatternFamilyStreakCount: 0,
      bossTelegraphText: '',
      bossTelegraphTimer: 0,
      hazards: [],
      items: [],
      waveDirector: createSharedWaveDirector(room.options.difficulty, 1, createServerWaveSeed(room.roomCode, startedAt)),
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
      const selection = buildWaveSpawnSpecs({
        director: game.waveDirector,
        mode: game.options.difficulty,
        round: game.round,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        nextHazardId: game.nextHazardId,
      });
      game.waveDirector = selection.nextDirector;
      for (const hazard of selection.hazards) {
        game.hazards.push(createHazardFromSharedSpec(hazard, game.nextHazardId));
        game.nextHazardId += 1;
      }
    }

    if (game.winnerUserId === null && game.itemSpawnTimer >= 4) {
      game.itemSpawnTimer = 0;
      this.spawnDebuffItem(game, getItemSpawnX(game.nextItemId), GAME_HEIGHT / 2 - 24);
    }

    if (game.phase === 'boss') {
      runBossPattern(game as never, delta);
    }

    game.hazards = evolveMultiplayerHazards(game.hazards, delta, () => {
      const id = game.nextHazardId;
      game.nextHazardId += 1;
      return id;
    }, game.options.difficulty);

    this.resolveHazardCollisions(game);
    this.resolveItemCollections(game, now);

    this.resolveWinner(game, now);
    if (game.winnerUserId !== null) {
      return game;
    }

    if (game.phase === 'wave' && game.elapsedInPhase >= getRoundDuration(game)) {
      const nextRound = game.round + 1;
      game.round = nextRound;
      game.waveDirector = buildWaveDirectorForRound(game.options.difficulty, nextRound, game.waveDirector);
      game.elapsedInPhase = 0;
      game.phase = shouldEnterBoss(nextRound, game.options.difficulty) ? 'boss' : 'wave';
      if (game.phase === 'boss') {
        initializeMultiplayerBossEncounter(game);
      }
      return game;
    }

    if (game.phase === 'boss' && game.elapsedInPhase >= getBossDuration(game)) {
      game.elapsedInPhase = 0;
      game.bossThemeId = null;
      game.bossThemeLabel = '';
      game.bossPatternQueue = [];
      game.bossPatternIndex = 0;
      game.bossPatternActiveId = null;
      game.bossPatternPhase = 'idle';
      game.bossPatternTimer = 0;
      game.bossPatternStepTimer = 0;
      game.bossPatternShots = 0;
      game.bossTelegraphText = '';
      game.bossTelegraphTimer = 0;
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

function createHazardFromSharedSpec(spec: SharedWaveHazardSpec, id: number): MultiplayerHazardState {
  const size = spec.size;
  const width = spec.width ?? size;
  const height = spec.height ?? size;
  return {
    id,
    owner: spec.owner,
    x: clamp(spec.x, 0, GAME_WIDTH - width),
    y: spec.y ?? -height,
    width,
    height,
    speed: spec.speed,
    variant: spec.variant,
    behavior: spec.behavior,
    velocityX: spec.velocityX,
    gravity: spec.gravity,
    splitAtY: spec.splitAtY,
    splitChildCount: spec.splitChildCount,
    splitChildSize: spec.splitChildSize,
    splitChildSpeed: spec.splitChildSpeed,
    splitChildSpread: spec.splitChildSpread,
    bouncesRemaining: spec.bouncesRemaining,
    triggered: spec.triggered,
    pendingRemoval: spec.pendingRemoval,
  };
}

function evolveMultiplayerHazards(hazards: MultiplayerHazardState[], delta: number, nextId: () => number, mode: GameMode) {
  const waveHazards = hazards.filter((hazard) => hazard.owner === 'wave');
  const bossHazards = hazards.filter((hazard) => hazard.owner === 'boss').map((hazard) => ({
    ...hazard,
    y: hazard.y + hazard.speed * delta,
  })).filter((hazard) => hazard.y < GAME_HEIGHT + hazard.height);

  const evolved = evolveSupportedHazards(
    waveHazards.map((hazard) => ({
      id: hazard.id,
      owner: 'wave' as const,
      x: hazard.x,
      y: hazard.y,
      size: Math.max(hazard.width, hazard.height),
      width: hazard.width,
      height: hazard.height,
      speed: hazard.speed,
      variant: hazard.variant,
      behavior: hazard.behavior,
      velocityX: hazard.velocityX,
      gravity: hazard.gravity,
      splitAtY: hazard.splitAtY,
      splitChildCount: hazard.splitChildCount,
      splitChildSize: hazard.splitChildSize,
      splitChildSpeed: hazard.splitChildSpeed,
      splitChildSpread: hazard.splitChildSpread,
      bouncesRemaining: hazard.bouncesRemaining,
      triggered: hazard.triggered,
      pendingRemoval: hazard.pendingRemoval,
    })),
    GAME_WIDTH,
    GAME_HEIGHT,
    delta,
    mode,
  );

  return [
    ...evolved.map((hazard) => createHazardFromSharedSpec(hazard, hazard.id ?? nextId())),
    ...bossHazards,
  ];
}

function createServerWaveSeed(roomCode: string, startedAt: number) {
  let hash = startedAt % 2147483646;
  for (const character of roomCode) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483646;
  }
  return Math.max(1, hash);
}

function createServerBossSeed(roomCode: string, startedAt: number) {
  let hash = (startedAt + 97) % 2147483646;
  for (const character of roomCode) {
    hash = (hash * 47 + character.charCodeAt(0)) % 2147483646;
  }
  return Math.max(1, hash);
}

function recordPlacement(game: MultiplayerGameState, userId: number) {
  if (!game.placementOrder.includes(userId)) {
    game.placementOrder.push(userId);
  }
}

function shouldEnterBoss(round: number, difficulty: GameMode) {
  if (difficulty === 'nightmare') {
    return round >= 2;
  }
  return difficulty === 'hard' ? round >= 3 && round % 3 === 0 : round >= 3 && round % 3 === 0;
}

function getEffectiveDirection(player: MultiplayerPlayerState) {
  return hasDebuff(player, 'reverse') ? (player.direction * -1 as -1 | 0 | 1) : player.direction;
}

function getEffectiveSpeed(player: MultiplayerPlayerState) {
  return hasDebuff(player, 'slow') ? PLAYER_SPEED * 0.6 : PLAYER_SPEED;
}

function getRoundDuration(game: MultiplayerGameState) {
  return game.options.difficulty === 'nightmare' ? 7 : game.options.difficulty === 'hard' ? 8 : 9;
}

function getBossDuration(game: MultiplayerGameState) {
  return game.bossEncounterDuration;
}

function getDefaultBossDuration(difficulty: GameMode) {
  return difficulty === 'nightmare' ? 15 : difficulty === 'hard' ? 13 : 11;
}

function initializeMultiplayerBossEncounter(game: MultiplayerGameState) {
  const plan = buildMultiplayerBossSubsetPlan({
    mode: game.mode,
    round: game.round,
    previousFamilyStreak: game.bossPatternFamilyStreak,
    previousFamilyStreakCount: game.bossPatternFamilyStreakCount,
    recentPatterns: game.bossRecentPatterns as never,
    recentThemes: game.bossRecentThemes as never,
    queueSeed: game.bossPatternSeed,
  });

  game.bossThemeId = plan.themeId;
  game.bossThemeLabel = getMultiplayerBossThemeLabel(plan.themeId);
  game.bossRecentThemes = [...game.bossRecentThemes, plan.themeId].slice(-3);
  game.bossPatternQueue = plan.queue;
  game.bossPatternIndex = 0;
  game.bossPatternActiveId = null;
  game.bossPatternPhase = 'idle';
  game.bossPatternTimer = 0;
  game.bossPatternStepTimer = 0;
  game.bossPatternShots = 0;
  game.bossPatternSeed = plan.nextQueueSeed;
  game.bossTelegraphText = '';
  game.bossTelegraphTimer = 0;
  game.bossEncounterDuration = Math.max(getDefaultBossDuration(game.options.difficulty), plan.minEncounterDuration);
}

function getSpawnInterval(game: MultiplayerGameState) {
  return getSharedWaveSpawnThreshold(game.options.difficulty, game.round);
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

      const shift = Math.ceil(actualOverlap / 2) + 2;
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
