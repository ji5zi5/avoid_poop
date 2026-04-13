import { createItem } from "../entities/item";
import { createHazard } from "../entities/poop";
import type { GameState, Hazard, ItemType } from "../state";

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

type WavePattern = "single" | "cluster" | "splitter" | "bouncer";

function randomX(width: number, size: number) {
  return Math.floor(Math.random() * Math.max(1, width - size));
}

function clampX(width: number, hazardWidth: number, x: number) {
  return Math.max(0, Math.min(width - hazardWidth, x));
}

function roundPressure(state: GameState) {
  return Math.min(state.mode === "hard" ? 18 : 16, Math.max(0, state.round - 1));
}

function getNormalHazardSize(state: GameState) {
  const offset = state.mode === "hard" ? 1 : 0;
  return NORMAL_HAZARD_SIZES[(state.nextHazardId + state.round + offset) % NORMAL_HAZARD_SIZES.length];
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
    x: forcedX ?? randomX(state.width, size),
  });
}

function getWavePattern(state: GameState): WavePattern {
  const token = state.nextHazardId + state.round * (state.mode === "hard" ? 3 : 2);

  if (state.round >= (state.mode === "hard" ? 7 : 9) && token % 11 === 0) {
    return "bouncer";
  }
  if (state.round >= (state.mode === "hard" ? 5 : 7) && token % 7 === 0) {
    return "splitter";
  }
  if (state.round >= (state.mode === "hard" ? 4 : 6) && token % 4 === 0) {
    return "cluster";
  }

  return "single";
}

function spawnClusterHazards(state: GameState) {
  const count = state.mode === "hard" || state.round >= 10 ? 3 : 2;
  const size = getNormalHazardSize(state);
  const gap = size + 18;
  const totalWidth = size + gap * (count - 1);
  const anchorX = randomX(state.width, totalWidth);
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

  createCustomHazard(state, {
    x: randomX(state.width, size),
    size,
    speed,
    owner: "wave",
    behavior: "split",
    splitAtY: Math.floor(state.height * (state.mode === "hard" ? 0.34 : 0.4)),
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
    x: randomX(state.width, size),
    size,
    speed,
    owner: "wave",
    behavior: "bounce",
    bouncesRemaining: 1,
    variant: size >= 20 ? "medium" : "small",
  });
}

export function spawnWavePattern(state: GameState) {
  const pattern = getWavePattern(state);

  if (pattern === "cluster") {
    spawnClusterHazards(state);
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
  const laneWidth = Math.floor((state.width - size) / Math.max(1, laneCount - 1));
  for (let index = 0; index < laneCount; index += 1) {
    if (index === safeLane) {
      continue;
    }
    createCustomHazard(state, {
      x: index * laneWidth,
      size,
      speed,
      owner: "boss",
      variant: size >= 28 ? "boss" : undefined,
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
  state.items.push(createItem(state.nextItemId, randomX(state.width, 20), type));
  state.nextItemId += 1;
}
