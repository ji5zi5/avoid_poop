import { createItem } from "../entities/item.js";
import { createHazard } from "../entities/poop.js";
import { createWaveDirector } from "../state.js";
import type { GameState, Hazard, ItemType, WaveDirector, WavePattern } from "../state.js";

const ITEM_TYPES: ItemType[] = ["invincibility", "speed", "heal", "slow", "clear"];
const NORMAL_HAZARD_SIZES = [16, 20, 24] as const;

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

function randomX(state: GameState, width: number, size: number) {
  const rolled = advanceWaveSeed(state.waveDirector.seed);
  state.waveDirector.seed = rolled.nextSeed;
  return Math.floor(rolled.value * Math.max(1, width - size));
}

function clampX(width: number, hazardWidth: number, x: number) {
  return Math.max(0, Math.min(width - hazardWidth, x));
}

function roundPressure(state: GameState) {
  return Math.min(state.mode === "hard" ? 18 : 16, Math.max(0, state.round - 1));
}

function advanceWaveSeed(seed: number) {
  const nextSeed = (seed * 48271) % 2147483647;
  return {
    nextSeed,
    value: nextSeed / 2147483647,
  };
}

function getNormalHazardSize(state: GameState) {
  const offset = state.mode === "hard" ? 1 : 0;
  return NORMAL_HAZARD_SIZES[(state.nextHazardId + state.round + offset) % NORMAL_HAZARD_SIZES.length];
}

function buildRoundDirector(mode: GameState["mode"], round: number, current?: WaveDirector): WaveDirector {
  const base = createWaveDirector(mode, round);
  return {
    ...base,
    seed: current?.seed ?? base.seed,
    patternCursor: current?.patternCursor ?? 0,
    recentPatterns: current?.recentPatterns ?? [],
    specialCooldown: Math.max(0, (current?.specialCooldown ?? 0) - 1),
  };
}

export function syncWaveDirectorForRound(state: GameState, round = state.round) {
  state.waveDirector = buildRoundDirector(state.mode, round, state.waveDirector);
}

function pickWeightedPattern(seed: number, choices: Array<{ pattern: WavePattern; weight: number }>) {
  const rolled = advanceWaveSeed(seed);
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = rolled.value * totalWeight;

  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) {
      return { pattern: choice.pattern, nextSeed: rolled.nextSeed };
    }
  }

  return { pattern: choices[choices.length - 1].pattern, nextSeed: rolled.nextSeed };
}

export function selectWavePattern(director: WaveDirector, mode: GameState["mode"], round: number) {
  const current = director.round === round ? director : buildRoundDirector(mode, round, director);
  const choices: Array<{ pattern: WavePattern; weight: number }> = [{ pattern: "single", weight: mode === "hard" ? 5.2 : 6.1 }];
  const recentLast = current.recentPatterns[current.recentPatterns.length - 1] ?? null;

  if (current.roundBudget > 0 && current.specialCooldown === 0) {
    if (current.clusterQuota > 0 && recentLast !== "cluster_2") {
      choices.push({ pattern: "cluster_2", weight: mode === "hard" ? 3.8 : 3 });
    }
    if (current.tripleQuota > 0 && round >= (mode === "hard" ? 10 : 12) && recentLast !== "cluster_3") {
      choices.push({ pattern: "cluster_3", weight: mode === "hard" ? 0.7 : 0.45 });
    }
    if (current.splitterQuota > 0 && recentLast !== "splitter") {
      choices.push({ pattern: "splitter", weight: mode === "hard" ? 2.6 : 2 });
    }
    if (current.bounceQuota > 0 && recentLast !== "bouncer") {
      choices.push({ pattern: "bouncer", weight: mode === "hard" ? 3.6 : 2.4 });
    }
  }

  const picked = pickWeightedPattern(current.seed, choices);
  const nextDirector: WaveDirector = {
    ...current,
    seed: picked.nextSeed,
    patternCursor: current.patternCursor + 1,
    recentPatterns: [...current.recentPatterns, picked.pattern].slice(-4),
  };

  if (picked.pattern === "single") {
    nextDirector.specialCooldown = Math.max(0, current.specialCooldown - 1);
    return { pattern: picked.pattern, nextDirector };
  }

  nextDirector.roundBudget = Math.max(0, current.roundBudget - (picked.pattern === "cluster_3" ? 2 : 1));
  nextDirector.specialCooldown = picked.pattern === "cluster_3" ? 2 : 1;

  if (picked.pattern === "cluster_2") {
    nextDirector.clusterQuota = Math.max(0, current.clusterQuota - 1);
  } else if (picked.pattern === "cluster_3") {
    nextDirector.clusterQuota = Math.max(0, current.clusterQuota - 1);
    nextDirector.tripleQuota = Math.max(0, current.tripleQuota - 1);
  } else if (picked.pattern === "splitter") {
    nextDirector.splitterQuota = Math.max(0, current.splitterQuota - 1);
  } else if (picked.pattern === "bouncer") {
    nextDirector.bounceQuota = Math.max(0, current.bounceQuota - 1);
  }

  return { pattern: picked.pattern, nextDirector };
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

export function spawnHazard(state: GameState, boss = false, forcedX?: number) {
  const size = boss ? 28 : getNormalHazardSize(state);
  const pressure = roundPressure(state);
  const speedBase = (state.mode === "hard" ? 146 : 126) + pressure * (state.mode === "hard" ? 20 : 15);
  const sizeWeight = boss ? 0 : Math.max(0, size - 16) * 2.5;
  const speed = boss
    ? speedBase + (state.mode === "hard" ? 124 : 82) + pressure * (state.mode === "hard" ? 5 : 3)
    : speedBase + sizeWeight + Math.min(state.mode === "hard" ? 72 : 54, pressure * (state.mode === "hard" ? 6 : 5));

  return createCustomHazard(state, {
    size,
    speed,
    owner: boss ? "boss" : "wave",
    variant: boss ? "boss" : undefined,
    x: forcedX ?? randomX(state, state.width, size),
  });
}

function spawnClusterHazards(state: GameState, count: 2 | 3) {
  const size = getNormalHazardSize(state);
  const gap = size + 18;
  const totalWidth = size + gap * (count - 1);
  const anchorX = randomX(state, state.width, totalWidth);
  const pressure = roundPressure(state);
  const speed = (state.mode === "hard" ? 176 : 152) + pressure * (state.mode === "hard" ? 15 : 11);

  for (let index = 0; index < count; index += 1) {
    createCustomHazard(state, {
      x: anchorX + index * gap,
      size,
      speed: speed + index * 6,
      owner: "wave",
      variant: size >= 24 ? "large" : size >= 20 ? "medium" : "small",
    });
  }
}

function spawnSplitHazard(state: GameState) {
  const pressure = roundPressure(state);
  const size = state.mode === "hard" ? 24 : 20;
  const speed = (state.mode === "hard" ? 194 : 172) + pressure * (state.mode === "hard" ? 14 : 11);
  const splitChildCount = state.mode === "hard"
    ? state.round >= 10
      ? 4
      : 3
    : 2;

  createCustomHazard(state, {
    x: randomX(state, state.width, size),
    size,
    speed,
    owner: "wave",
    behavior: "split",
    splitAtY: Math.floor(state.height * (state.mode === "hard" ? 0.34 : 0.4)),
    splitChildCount,
    splitChildSize: 14,
    splitChildSpeed: speed * 0.9,
    splitChildSpread: state.mode === "hard" ? 76 : 62,
    variant: size >= 24 ? "large" : "medium",
  });
}

function spawnBounceHazard(state: GameState) {
  const pressure = roundPressure(state);
  const size = state.mode === "hard" ? 20 : 18;
  const speed = (state.mode === "hard" ? 204 : 180) + pressure * (state.mode === "hard" ? 15 : 10);

  createCustomHazard(state, {
    x: randomX(state, state.width, size),
    size,
    speed,
    owner: "wave",
    behavior: "bounce",
    bouncesRemaining: state.mode === "hard" ? 3 : 1,
    variant: size >= 20 ? "medium" : "small",
  });
}

export function spawnWavePattern(state: GameState) {
  const selection = selectWavePattern(state.waveDirector, state.mode, state.round);
  state.waveDirector = selection.nextDirector;
  const { pattern } = selection;

  if (pattern === "cluster_2") {
    spawnClusterHazards(state, 2);
    return pattern;
  }
  if (pattern === "cluster_3") {
    spawnClusterHazards(state, 3);
    return pattern;
  }
  if (pattern === "splitter") {
    spawnSplitHazard(state);
    return pattern;
  }
  if (pattern === "bouncer") {
    spawnBounceHazard(state);
    return pattern;
  }

  spawnHazard(state);
  return pattern;
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
  state.items.push(createItem(state.nextItemId, randomX(state, state.width, 20), type));
  state.nextItemId += 1;
}
