import type { GameMode } from "../contracts/index.js";

export type SharedWavePattern = "single" | "cluster_2" | "cluster_3" | "splitter" | "bouncer";
export type SharedHazardBehavior = "none" | "split" | "bounce";
export type SharedHazardVariant = "small" | "medium" | "large" | "boss" | "giant";

export type SharedWaveDirector = {
  seed: number;
  patternCursor: number;
  recentPatterns: SharedWavePattern[];
  specialCooldown: number;
  roundBudget: number;
  clusterQuota: number;
  tripleQuota: number;
  splitterQuota: number;
  bounceQuota: number;
  roundBand: number;
  round: number;
};

export type SharedWaveHazardSpec = {
  id?: number;
  x: number;
  y?: number;
  size: number;
  speed: number;
  owner: "wave";
  variant: SharedHazardVariant;
  behavior?: SharedHazardBehavior;
  width?: number;
  height?: number;
  velocityX?: number;
  gravity?: number;
  splitAtY?: number;
  splitChildCount?: number;
  splitChildSize?: number;
  splitChildSpeed?: number;
  splitChildSpread?: number;
  bouncesRemaining?: number;
  triggered?: boolean;
  pendingRemoval?: boolean;
};

type PickPatternChoice = { pattern: SharedWavePattern; weight: number };

type BuildWaveSpawnInput = {
  director: SharedWaveDirector;
  mode: GameMode;
  round: number;
  width: number;
  height: number;
  nextHazardId: number;
};

type BuildWaveSpawnOutput = {
  hazards: SharedWaveHazardSpec[];
  nextDirector: SharedWaveDirector;
  pattern: SharedWavePattern;
};

const NORMAL_HAZARD_SIZES = [16, 20, 24] as const;
const MAX_RUN_SEED = 2147483646;

function createRunSeed() {
  return Math.floor(Math.random() * MAX_RUN_SEED) + 1;
}

export function getWaveRoundBand(mode: GameMode, round: number) {
  if (mode === "hard") {
    if (round >= 10) {
      return 3;
    }
    if (round >= 7) {
      return 2;
    }
    if (round >= 4) {
      return 1;
    }
    return 0;
  }

  if (round >= 10) {
    return 3;
  }
  if (round >= 7) {
    return 2;
  }
  if (round >= 4) {
    return 1;
  }
  return 0;
}

export function createSharedWaveDirector(mode: GameMode, round: number, seed = createRunSeed()): SharedWaveDirector {
  const roundBand = getWaveRoundBand(mode, round);
  return {
    seed,
    patternCursor: 0,
    recentPatterns: [],
    specialCooldown: 0,
    roundBudget: mode === "hard"
      ? roundBand >= 3 ? 4 : roundBand >= 2 ? 3 : roundBand >= 1 ? 2 : 1
      : roundBand >= 3 ? 3 : roundBand >= 2 ? 2 : 1,
    clusterQuota: mode === "hard"
      ? roundBand >= 3 ? 3 : roundBand >= 1 ? 2 : 1
      : roundBand >= 2 ? 2 : 1,
    tripleQuota: mode === "hard"
      ? roundBand >= 2 ? 1 : 0
      : roundBand >= 3 ? 1 : 0,
    splitterQuota: mode === "hard"
      ? roundBand >= 2 ? 2 : roundBand >= 1 ? 1 : 0
      : roundBand >= 2 ? 1 : 0,
    bounceQuota: mode === "hard"
      ? roundBand >= 2 ? 2 : roundBand >= 1 ? 1 : 0
      : roundBand >= 2 ? 1 : 0,
    roundBand,
    round,
  };
}

export function buildWaveDirectorForRound(mode: GameMode, round: number, current?: SharedWaveDirector): SharedWaveDirector {
  const base = createSharedWaveDirector(mode, round);
  return {
    ...base,
    seed: current?.seed ?? base.seed,
    patternCursor: current?.patternCursor ?? 0,
    recentPatterns: current?.recentPatterns ?? [],
    specialCooldown: Math.max(0, (current?.specialCooldown ?? 0) - 1),
  };
}

function roundPressure(mode: GameMode, round: number) {
  return Math.min(mode === "hard" ? 18 : 16, Math.max(0, round - 1));
}

export function getSharedWaveSpawnThreshold(mode: GameMode, round: number) {
  const pressure = Math.min(mode === "hard" ? 14 : 13, Math.max(0, round - 1));
  const waveSpawnBase = mode === "hard" ? 0.82 : 0.93;
  const waveSpawnFloor = mode === "hard" ? 0.12 : 0.17;
  const waveDecay = mode === "hard" ? 0.076 : 0.07;
  return Math.max(waveSpawnFloor, waveSpawnBase - pressure * waveDecay);
}

function advanceWaveSeed(seed: number) {
  const nextSeed = (seed * 48271) % 2147483647;
  return {
    nextSeed,
    value: nextSeed / 2147483647,
  };
}

function getNormalHazardSize(mode: GameMode, round: number, nextHazardId: number) {
  const offset = mode === "hard" ? 1 : 0;
  return NORMAL_HAZARD_SIZES[(nextHazardId + round + offset) % NORMAL_HAZARD_SIZES.length];
}

function clampX(width: number, hazardWidth: number, x: number) {
  return Math.max(0, Math.min(width - hazardWidth, x));
}

function randomX(seed: number, width: number, size: number) {
  const rolled = advanceWaveSeed(seed);
  return {
    x: Math.floor(rolled.value * Math.max(1, width - size)),
    nextSeed: rolled.nextSeed,
  };
}

function pickWeightedPattern(seed: number, choices: PickPatternChoice[]) {
  const rolled = advanceWaveSeed(seed);
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = rolled.value * totalWeight;

  for (const choice of choices) {
    cursor -= choice.weight;
    if (cursor <= 0) {
      return { pattern: choice.pattern, nextSeed: rolled.nextSeed };
    }
  }

  return { pattern: choices[choices.length - 1]!.pattern, nextSeed: rolled.nextSeed };
}

export function selectSharedWavePattern(director: SharedWaveDirector, mode: GameMode, round: number) {
  const current = director.round === round ? director : buildWaveDirectorForRound(mode, round, director);
  const choices: PickPatternChoice[] = [{ pattern: "single", weight: mode === "hard" ? 5.2 : 6.1 }];
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
  const nextDirector: SharedWaveDirector = {
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

function buildSingleHazard(mode: GameMode, round: number, width: number, nextHazardId: number, seed: number) {
  const size = getNormalHazardSize(mode, round, nextHazardId);
  const pressure = roundPressure(mode, round);
  const speedBase = (mode === "hard" ? 146 : 126) + pressure * (mode === "hard" ? 20 : 15);
  const sizeWeight = Math.max(0, size - 16) * 2.5;
  const speed = speedBase + sizeWeight + Math.min(mode === "hard" ? 72 : 54, pressure * (mode === "hard" ? 6 : 5));
  const xRoll = randomX(seed, width, size);
  return {
    hazard: {
      x: xRoll.x,
      size,
      speed,
      owner: "wave" as const,
      variant: (size >= 24 ? "large" : size >= 20 ? "medium" : "small") as SharedHazardVariant,
    },
    nextSeed: xRoll.nextSeed,
  };
}

function buildClusterHazards(mode: GameMode, round: number, width: number, nextHazardId: number, seed: number, count: 2 | 3) {
  const size = getNormalHazardSize(mode, round, nextHazardId);
  const gap = size + 18;
  const totalWidth = size + gap * (count - 1);
  const anchorRoll = randomX(seed, width, totalWidth);
  const pressure = roundPressure(mode, round);
  const speed = (mode === "hard" ? 176 : 152) + pressure * (mode === "hard" ? 15 : 11);
  return {
    hazards: Array.from({ length: count }, (_, index) => ({
      x: anchorRoll.x + index * gap,
      size,
      speed: speed + index * 6,
      owner: "wave" as const,
      variant: (size >= 24 ? "large" : size >= 20 ? "medium" : "small") as SharedHazardVariant,
    })),
    nextSeed: anchorRoll.nextSeed,
  };
}

function buildSplitHazard(mode: GameMode, round: number, width: number, seed: number) {
  const pressure = roundPressure(mode, round);
  const size = mode === "hard" ? 24 : 20;
  const speed = (mode === "hard" ? 194 : 172) + pressure * (mode === "hard" ? 14 : 11);
  const splitChildCount = mode === "hard"
    ? round >= 10
      ? 4
      : 3
    : 2;
  const xRoll = randomX(seed, width, size);
  return {
    hazard: {
      x: xRoll.x,
      size,
      speed,
      owner: "wave" as const,
      behavior: "split" as const,
      splitAtY: undefined,
      splitChildCount,
      splitChildSize: 14,
      splitChildSpeed: speed * 0.9,
      splitChildSpread: mode === "hard" ? 76 : 62,
      variant: (size >= 24 ? "large" : "medium") as SharedHazardVariant,
    },
    nextSeed: xRoll.nextSeed,
  };
}

function buildBounceHazard(mode: GameMode, round: number, width: number, seed: number) {
  const pressure = roundPressure(mode, round);
  const size = mode === "hard" ? 20 : 18;
  const speed = (mode === "hard" ? 204 : 180) + pressure * (mode === "hard" ? 15 : 10);
  const xRoll = randomX(seed, width, size);
  return {
    hazard: {
      x: xRoll.x,
      size,
      speed,
      owner: "wave" as const,
      behavior: "bounce" as const,
      bouncesRemaining: mode === "hard" ? 3 : 1,
      variant: (size >= 20 ? "medium" : "small") as SharedHazardVariant,
    },
    nextSeed: xRoll.nextSeed,
  };
}

export function buildWaveSpawnSpecs(input: BuildWaveSpawnInput): BuildWaveSpawnOutput {
  const selection = selectSharedWavePattern(input.director, input.mode, input.round);
  let workingSeed = selection.nextDirector.seed;
  const { pattern } = selection;

  if (pattern === "cluster_2") {
    const cluster = buildClusterHazards(input.mode, input.round, input.width, input.nextHazardId, workingSeed, 2);
    selection.nextDirector.seed = cluster.nextSeed;
    return { pattern, nextDirector: selection.nextDirector, hazards: cluster.hazards };
  }

  if (pattern === "cluster_3") {
    const cluster = buildClusterHazards(input.mode, input.round, input.width, input.nextHazardId, workingSeed, 3);
    selection.nextDirector.seed = cluster.nextSeed;
    return { pattern, nextDirector: selection.nextDirector, hazards: cluster.hazards };
  }

  if (pattern === "splitter") {
    const split = buildSplitHazard(input.mode, input.round, input.width, workingSeed);
    selection.nextDirector.seed = split.nextSeed;
    const splitAtY = Math.floor(input.height * (input.mode === "hard" ? 0.34 : 0.4));
    return {
      pattern,
      nextDirector: selection.nextDirector,
      hazards: [{ ...split.hazard, splitAtY }],
    };
  }

  if (pattern === "bouncer") {
    const bounce = buildBounceHazard(input.mode, input.round, input.width, workingSeed);
    selection.nextDirector.seed = bounce.nextSeed;
    return { pattern, nextDirector: selection.nextDirector, hazards: [bounce.hazard] };
  }

  const single = buildSingleHazard(input.mode, input.round, input.width, input.nextHazardId, workingSeed);
  selection.nextDirector.seed = single.nextSeed;
  return { pattern, nextDirector: selection.nextDirector, hazards: [single.hazard] };
}

function buildSplitVelocityProfile(count: number) {
  if (count <= 1) {
    return [0];
  }

  const midpoint = (count - 1) / 2;
  const maxOffset = Math.max(0.5, midpoint);
  return Array.from({ length: count }, (_, index) => (index - midpoint) / maxOffset);
}

export function evolveSupportedHazards(
  hazards: SharedWaveHazardSpec[],
  width: number,
  height: number,
  delta: number,
  mode: GameMode = "hard",
) {
  const nextHazards: SharedWaveHazardSpec[] = [];
  const groundY = height - 32;

  for (const hazard of hazards) {
    const current = { ...hazard };
    current.x = clampX(width, current.width ?? current.size, current.x + (current.velocityX ?? 0) * delta);
    current.y = current.y ?? 0;
    current.y += current.speed * delta;
    if (current.gravity) {
      current.speed += current.gravity * delta;
    }

    if (current.behavior === "split" && !current.triggered && current.splitAtY !== undefined && current.y >= current.splitAtY) {
      const childCount = Math.max(2, current.splitChildCount ?? 2);
      const childSize = current.splitChildSize ?? 14;
      const childSpeed = current.splitChildSpeed ?? Math.max(150, current.speed * 0.84);
      const childSpread = current.splitChildSpread ?? 64;
      const childY = Math.max(0, current.y - childSize * 0.4);
      const hazardWidth = current.width ?? current.size;
      const hazardCenter = current.x + hazardWidth / 2;
      const spawnOffset = Math.max(childSize * 0.95, hazardWidth * 0.42);

      for (const velocityFactor of buildSplitVelocityProfile(childCount)) {
        nextHazards.push({
          ...current,
          x: clampX(width, childSize, hazardCenter + velocityFactor * spawnOffset - childSize / 2),
          y: childY,
          size: childSize,
          width: childSize,
          height: childSize,
          speed: childSpeed,
          variant: childSize >= 20 ? "medium" : "small",
          behavior: undefined,
          velocityX: childSpread * velocityFactor,
          gravity: 220,
          triggered: undefined,
          pendingRemoval: undefined,
          splitAtY: undefined,
          splitChildCount: undefined,
          splitChildSize: undefined,
          splitChildSpeed: undefined,
          splitChildSpread: undefined,
          bouncesRemaining: undefined,
        });
      }
      continue;
    }

    if (current.behavior === "bounce") {
      const hazardHeight = current.height ?? current.size;
      const floorContactY = groundY - hazardHeight;
      if ((current.bouncesRemaining ?? 0) > 0 && current.y >= floorContactY) {
        current.y = floorContactY;
        current.bouncesRemaining = (current.bouncesRemaining ?? 1) - 1;
        current.triggered = true;
        current.speed = -Math.max(230, Math.abs(current.speed) * 0.94);
        current.gravity = 390;
        const lateralBounce = mode === "hard" ? 110 : 74;
        current.velocityX = current.x + (current.width ?? current.size) / 2 < width / 2 ? lateralBounce : -lateralBounce;
        nextHazards.push(current);
        continue;
      }

      if ((current.bouncesRemaining ?? 0) === 0 && current.triggered && current.speed > 0 && current.y >= floorContactY) {
        continue;
      }
    }

    if (current.y < height + (current.height ?? current.size)) {
      nextHazards.push(current);
    }
  }

  return nextHazards;
}
