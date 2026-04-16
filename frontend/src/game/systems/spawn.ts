import { buildWaveDirectorForRound, buildWaveSpawnSpecs, selectSharedWavePattern } from "../../../../shared/src/index.js";
import { createItem } from "../entities/item.js";
import { createHazard } from "../entities/poop.js";
import { createWaveDirector } from "../state.js";
import type { GameState, Hazard, ItemType, WaveDirector, WavePattern } from "../state.js";

const ITEM_TYPES: ItemType[] = ["invincibility", "speed", "heal", "slow", "clear"];
type CustomHazardOptions = {
  awardOnExit?: boolean;
  behavior?: Hazard["behavior"];
  bouncesRemaining?: number;
  gravity?: number;
  height?: number;
  owner?: Hazard["owner"];
  pendingRemoval?: boolean;
  size: number;
  splitAtY?: number;
  splitChildCount?: number;
  splitChildSize?: number;
  splitChildSpeed?: number;
  splitChildSpread?: number;
  speed: number;
  triggered?: boolean;
  variant?: Hazard["variant"];
  velocityX?: number;
  width?: number;
  x: number;
};

function clampX(width: number, hazardWidth: number, x: number) {
  return Math.max(0, Math.min(width - hazardWidth, x));
}

function advanceWaveSeed(seed: number) {
  const nextSeed = (seed * 48271) % 2147483647;
  return {
    nextSeed,
    value: nextSeed / 2147483647,
  };
}

function randomItemX(state: GameState, width: number, size: number) {
  const rolled = advanceWaveSeed(state.itemSeed);
  state.itemSeed = rolled.nextSeed;
  return Math.floor(rolled.value * Math.max(1, width - size));
}

function buildRoundDirector(mode: GameState["mode"], round: number, current?: WaveDirector): WaveDirector {
  return buildWaveDirectorForRound(mode, round, current);
}

export function syncWaveDirectorForRound(state: GameState, round = state.round) {
  state.waveDirector = buildRoundDirector(state.mode, round, state.waveDirector);
}

export function selectWavePattern(director: WaveDirector, mode: GameState["mode"], round: number) {
  return selectSharedWavePattern(director, mode, round) as { pattern: WavePattern; nextDirector: WaveDirector };
}

export function createCustomHazard(state: GameState, options: CustomHazardOptions) {
  const hazard = createHazard(state.nextHazardId, clampX(state.width, options.width ?? options.size, options.x), options.speed, options.size, {
    awardOnExit: options.awardOnExit,
    behavior: options.behavior,
    bouncesRemaining: options.bouncesRemaining,
    gravity: options.gravity,
    height: options.height,
    owner: options.owner,
    pendingRemoval: options.pendingRemoval,
    splitAtY: options.splitAtY,
    splitChildCount: options.splitChildCount,
    splitChildSize: options.splitChildSize,
    splitChildSpeed: options.splitChildSpeed,
    splitChildSpread: options.splitChildSpread,
    triggered: options.triggered,
    variant: options.variant,
    velocityX: options.velocityX,
    width: options.width,
  });
  state.nextHazardId += 1;
  state.hazards.push(hazard);
  return hazard;
}

export function spawnWavePattern(state: GameState) {
  const selection = buildWaveSpawnSpecs({
    director: state.waveDirector,
    mode: state.mode,
    round: state.round,
    width: state.width,
    height: state.height,
    nextHazardId: state.nextHazardId,
  });

  state.waveDirector = selection.nextDirector;
  for (const hazard of selection.hazards) {
    createCustomHazard(state, {
      x: hazard.x,
      size: hazard.size,
      speed: hazard.speed,
      owner: hazard.owner,
      variant: hazard.variant,
      behavior: hazard.behavior,
      width: hazard.width,
      height: hazard.height,
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
    });
  }

  return selection.pattern;
}

export function spawnGiantHazard(state: GameState, x: number, width: number, speed: number, height = 68) {
  return createCustomHazard(state, {
    x,
    width,
    height,
    size: Math.max(width, height),
    speed,
    owner: "boss",
    variant: "giant",
  });
}

export function spawnHalfHazard(state: GameState, side: "left" | "right", speed: number, coverage = 0.5, height = 72) {
  const width = Math.floor(state.width * coverage);
  const x = side === "left" ? 0 : state.width - width;
  return spawnGiantHazard(state, x, width, speed, height);
}

export function spawnCenterHazard(state: GameState, widthRatio: number, speed: number, height = 72) {
  const width = Math.floor(state.width * widthRatio);
  return spawnGiantHazard(state, Math.floor((state.width - width) / 2), width, speed, height);
}

export function spawnEdgeHazards(state: GameState, widthRatio: number, speed: number, height = 72) {
  const width = Math.floor(state.width * widthRatio);
  spawnGiantHazard(state, 0, width, speed, height);
  spawnGiantHazard(state, state.width - width, width, speed, height);
}

export function spawnLaneBarrage(state: GameState, safeLane: number, laneCount: number, speed: number, size = 28) {
  const effectiveSize = state.bossThemeId === "lane_intro"
    ? Math.max(size, 40)
    : state.bossThemeId === "corridor_switch"
      ? Math.max(size, 34)
      : size;
  const laneWidth = Math.floor((state.width - effectiveSize) / Math.max(1, laneCount - 1));
  for (let index = 0; index < laneCount; index += 1) {
    if (index === safeLane) {
      continue;
    }
    createCustomHazard(state, {
      x: index * laneWidth,
      size: effectiveSize,
      speed,
      owner: "boss",
      variant: effectiveSize >= 28 ? "boss" : undefined,
    });
  }
}

export function maybeSpawnItem(state: GameState) {
  const itemInterval = Math.max(state.mode === "hard" ? 8.5 : 7.5, 9.5 - Math.min(2, state.round * 0.08));
  if (state.itemTimer < itemInterval) {
    return;
  }

  state.itemTimer = 0;
  const type = ITEM_TYPES[state.nextItemId % ITEM_TYPES.length];
  state.items.push(createItem(state.nextItemId, randomItemX(state, state.width, 20), type));
  state.nextItemId += 1;
}
