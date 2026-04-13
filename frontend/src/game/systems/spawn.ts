import { createItem } from "../entities/item";
import { createHazard } from "../entities/poop";
import type { GameState, Hazard, ItemType } from "../state";

const ITEM_TYPES: ItemType[] = ["invincibility", "speed", "heal", "slow", "clear"];
const NORMAL_HAZARD_SIZES = [16, 20, 24] as const;

type CustomHazardOptions = {
  height?: number;
  owner?: Hazard["owner"];
  size: number;
  speed: number;
  variant?: Hazard["variant"];
  width?: number;
  x: number;
};

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
    height: options.height,
    owner: options.owner,
    variant: options.variant,
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
