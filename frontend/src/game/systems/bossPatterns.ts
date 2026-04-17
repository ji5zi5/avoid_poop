import { BOSS_DURATION } from "../state.js";
import type { BossPatternFamily, BossPatternId, BossThemeId, GameState } from "../state.js";

import { createCustomHazard, spawnCenterHazard, spawnEdgeHazards, spawnGiantHazard, spawnHalfHazard, spawnLaneBarrage } from "./spawn.js";

type BossPatternDefinition = {
  archetype: string;
  family: BossPatternFamily;
  isHeavySetPiece?: boolean;
  label: (state: GameState) => string;
  minEncounterContributionMs?: number;
  normalAllowed: boolean;
  telegraphHardMs: number;
  telegraphNormalMs: number;
  run: (state: GameState, delta: number) => boolean;
};

type BossThemeDefinition = {
  antiStationaryFinishers?: BossPatternId[];
  durationFloorMs: number;
  finisher: BossPatternId[];
  id: BossThemeId;
  label: string;
  maxHeavySetPieces: number;
  maxQueueLength: number;
  minQueueLength: number;
  mode: GameState["mode"] | "both";
  opener: BossPatternId[];
  optionalSetPiece?: BossPatternId[];
  roundEnd?: number;
  roundStart: number;
  themeFamilies: BossPatternFamily[];
  core: BossPatternId[];
};

export type BossEncounterBuilderInput = {
  mode: GameState["mode"];
  previousFamilyStreak: BossPatternFamily | null;
  previousFamilyStreakCount: number;
  queueSeed: number;
  recentPatterns: readonly BossPatternId[];
  recentThemes: readonly BossThemeId[];
  round: number;
};

export type BossEncounterPlan = {
  minEncounterDuration: number;
  nextQueueSeed: number;
  queue: BossPatternId[];
  themeId: BossThemeId;
};

const HARD_ONLY_PATTERNS: BossPatternId[] = [
  "three_gate_shuffle",
  "pillar_press",
  "pillar_slide",
  "shatter_lane",
  "glider_cross",
  "glider_stack",
  "diagonal_rain",
  "cross_arc",
  "fan_arc",
  "bounce_drive",
  "split_rebound",
  "corridor_snapback",
  "lane_pincer",
  "fake_safe_lane",
  "funnel_switch",
  "aftershock_lane",
  "safe_third_flip",
  "residue_zone",
  "residue_switch",
  "residue_crossfire",
  "residue_pivot",
  "fake_warning",
  "corridor_fakeout",
  "center_collapse",
  "shoulder_crush",
  "delayed_burst",
];

const HEAVY_SET_PIECE_IDS = new Set<BossPatternId>([
  "three_gate_shuffle",
  "pillar_press",
  "funnel_switch",
  "residue_zone",
  "residue_switch",
  "residue_crossfire",
  "center_collapse",
  "shoulder_crush",
  "delayed_burst",
]);

function clampRoundPressure(state: GameState) {
  return Math.max(0, state.round - 1);
}

function isNightmareMode(mode: GameState["mode"]) {
  return mode === "nightmare";
}

function isHardOrAboveMode(mode: GameState["mode"]) {
  return mode !== "normal";
}

function giantSpeed(state: GameState, bonus = 0) {
  return (isNightmareMode(state.mode) ? 292 : isHardOrAboveMode(state.mode) ? 278 : 262) + Math.min(118, clampRoundPressure(state) * 8) + bonus;
}

function laneSpeed(state: GameState, bonus = 0) {
  return (isNightmareMode(state.mode) ? 236 : isHardOrAboveMode(state.mode) ? 224 : 214) + Math.min(96, clampRoundPressure(state) * 6) + bonus;
}

function mediumSpeed(state: GameState, bonus = 0) {
  return (isNightmareMode(state.mode) ? 222 : isHardOrAboveMode(state.mode) ? 210 : 198) + Math.min(84, clampRoundPressure(state) * 5) + bonus;
}

function pickSide(state: GameState) {
  return (state.round + state.bossPatternIndex) % 2 === 0 ? "left" : "right";
}

function oppositeSide(side: "left" | "right") {
  return side === "left" ? "right" : "left";
}

function telegraphSeconds(state: GameState, definition: BossPatternDefinition) {
  const base = isHardOrAboveMode(state.mode) ? definition.telegraphHardMs : definition.telegraphNormalMs;
  const reduction = clampRoundPressure(state) * (isNightmareMode(state.mode) ? 13 : isHardOrAboveMode(state.mode) ? 10 : 8);
  const floor = isNightmareMode(state.mode) ? 240 : isHardOrAboveMode(state.mode) ? 280 : 320;
  return Math.max(floor, base - reduction) / 1000;
}

function cooldownSeconds(state: GameState) {
  const base = isNightmareMode(state.mode) ? 0.2 : isHardOrAboveMode(state.mode) ? 0.24 : 0.3;
  const reduction = clampRoundPressure(state) * 0.006;
  return Math.max(isNightmareMode(state.mode) ? 0.11 : isHardOrAboveMode(state.mode) ? 0.14 : 0.16, base - reduction);
}

function scaledInterval(state: GameState, hardBase: number, normalBase: number, hardFloor: number, normalFloor: number) {
  const base = isHardOrAboveMode(state.mode) ? hardBase : normalBase;
  const floor = isNightmareMode(state.mode) ? Math.max(0.08, hardFloor - 0.03) : isHardOrAboveMode(state.mode) ? hardFloor : normalFloor;
  const reduction = clampRoundPressure(state) * (isNightmareMode(state.mode) ? 0.015 : isHardOrAboveMode(state.mode) ? 0.012 : 0.009);
  return Math.max(floor, base - reduction);
}

function advanceSeed(seed: number) {
  const nextQueueSeed = (seed * 48271) % 2147483647;
  return {
    nextQueueSeed,
    value: nextQueueSeed / 2147483647,
  };
}

function getLaneCount(state: GameState) {
  if (isNightmareMode(state.mode)) {
    return 5;
  }
  if (state.mode === "hard") {
    return Math.min(5, 4 + Math.floor(clampRoundPressure(state) / 5));
  }
  return Math.min(5, 4 + Math.floor(clampRoundPressure(state) / 6));
}

export function getBossLanePositions(state: GameState, laneCount = getLaneCount(state), size = 28) {
  const laneWidth = Math.floor((state.width - size) / Math.max(1, laneCount - 1));
  return Array.from({ length: laneCount }, (_, index) => Math.min(state.width - size, Math.max(0, index * laneWidth)));
}

export function getBossPatternFamily(id: BossPatternId) {
  return definitions[id].family;
}

function getBossPatternArchetype(id: BossPatternId) {
  return definitions[id].archetype;
}

function tickPattern(state: GameState, delta: number, interval: number, shots: number, fire: (shotIndex: number) => void) {
  state.bossPatternTimer += delta;
  while (state.bossPatternShots < shots && state.bossPatternTimer >= interval) {
    state.bossPatternTimer -= interval;
    fire(state.bossPatternShots);
    state.bossPatternShots += 1;
  }
  return state.bossPatternShots >= shots;
}

function spawnFollowupPair(state: GameState, speed: number) {
  createCustomHazard(state, { x: Math.floor(state.width * 0.28), size: 20, speed, owner: "boss", variant: "medium" });
  createCustomHazard(state, { x: Math.floor(state.width * 0.58), size: 20, speed, owner: "boss", variant: "medium" });
}

function spawnSafeThirdSetup(state: GameState, safeZone: "left" | "center" | "right", speed: number, height = 84) {
  if (safeZone === "center") {
    spawnEdgeHazards(state, 0.31, speed, height);
    return;
  }

  const coverage = Math.floor(state.width * 0.6);
  const x = safeZone === "left" ? state.width - coverage : 0;
  spawnGiantHazard(state, x, coverage, speed, height);
}

function spawnTwinPillars(state: GameState, leftRatio: number, rightRatio: number, widthRatio: number, speed: number, height = 110) {
  const width = Math.floor(state.width * widthRatio);
  spawnGiantHazard(state, Math.floor(state.width * leftRatio), width, speed, height);
  spawnGiantHazard(state, Math.floor(state.width * rightRatio), width, speed, height);
}

function buildSweepOrder(laneCount: number, startSide: "left" | "right") {
  const order = Array.from({ length: laneCount }, (_, index) => index);
  return startSide === "left" ? order : [...order].reverse();
}

function buildCenterBreakOrder(laneCount: number) {
  const center = Math.floor((laneCount - 1) / 2);
  const order: number[] = [center];

  for (let offset = 1; order.length < laneCount; offset += 1) {
    const left = center - offset;
    const right = center + offset;

    if (left >= 0) {
      order.push(left);
    }
    if (right < laneCount && order.length < laneCount) {
      order.push(right);
    }
  }

  return order;
}

function buildInsideOutOrder(laneCount: number) {
  const center = Math.floor((laneCount - 1) / 2);
  const order: number[] = [];

  for (let offset = 0; order.length < laneCount; offset += 1) {
    const left = center - offset;
    const right = center + offset;
    if (left >= 0 && !order.includes(left)) {
      order.push(left);
    }
    if (right < laneCount && !order.includes(right)) {
      order.push(right);
    }
  }

  return order;
}

function getPatternVariant(state: GameState, variantCount: number, salt = 0) {
  const activeId = state.bossPatternActiveId ?? state.bossPatternQueue[state.bossPatternIndex] ?? "half_stomp_alternating";
  let hash = salt;
  for (const character of activeId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 104729;
  }
  return Math.abs(state.bossPatternSeed + state.round * 17 + state.bossPatternIndex * 31 + hash) % variantCount;
}

function pushUniqueLane(order: number[], lane: number) {
  if (!order.includes(lane)) {
    order.push(lane);
  }
}

function buildEdgeTunnelOrder(laneCount: number, startSide: "left" | "right") {
  const center = Math.floor((laneCount - 1) / 2);
  const nearLeft = Math.min(1, laneCount - 1);
  const nearRight = Math.max(0, laneCount - 2);
  const order: number[] = [];
  const sequence = startSide === "left"
    ? [0, laneCount - 1, nearLeft, nearRight, center]
    : [laneCount - 1, 0, nearRight, nearLeft, center];
  sequence.forEach((lane) => pushUniqueLane(order, lane));
  return order;
}

function buildSnapbackOrder(laneCount: number, startSide: "left" | "right") {
  const center = Math.floor((laneCount - 1) / 2);
  const nearStart = startSide === "left" ? Math.min(1, laneCount - 1) : Math.max(0, laneCount - 2);
  const farEnd = startSide === "left" ? laneCount - 1 : 0;
  const nearEnd = startSide === "left" ? Math.max(0, laneCount - 2) : Math.min(1, laneCount - 1);
  const hardReturn = startSide === "left" ? 0 : laneCount - 1;
  const order: number[] = [];
  [nearStart, farEnd, center, nearEnd, hardReturn].forEach((lane) => pushUniqueLane(order, lane));
  return order;
}

function buildFlipbackOrder(laneCount: number, startSide: "left" | "right") {
  const edge = startSide === "left" ? 0 : laneCount - 1;
  const farEdge = startSide === "left" ? laneCount - 1 : 0;
  const center = Math.floor((laneCount - 1) / 2);
  const nearStart = startSide === "left" ? Math.min(1, laneCount - 1) : Math.max(0, laneCount - 2);
  return [edge, farEdge, center, nearStart, edge];
}

function spawnAngledBossHazard(
  state: GameState,
  xRatio: number,
  speed: number,
  velocityX: number,
  size = 22,
  gravity = 180,
) {
  return createCustomHazard(state, {
    x: Math.floor((state.width - size) * xRatio),
    size,
    speed,
    owner: "boss",
    variant: "boss",
    velocityX,
    gravity,
  });
}

function spawnArcPair(
  state: GameState,
  speed: number,
  drift: number,
  leftRatio = 0.12,
  rightRatio = 0.76,
  size = 20,
  gravity = 180,
) {
  spawnAngledBossHazard(state, leftRatio, speed, drift, size, gravity);
  spawnAngledBossHazard(state, rightRatio, speed, -drift, size, gravity);
}

function spawnFanSpread(
  state: GameState,
  speed: number,
  drifts: readonly number[],
  gravity = 170,
  size = 18,
) {
  const anchorRatios = drifts.length === 4
    ? [0.24, 0.4, 0.56, 0.72]
    : drifts.length === 3
      ? [0.34, 0.47, 0.6]
      : [0.38, 0.54];
  drifts.forEach((drift, index) => {
    spawnAngledBossHazard(state, anchorRatios[index] ?? 0.47, speed + Math.abs(drift) * 0.08, drift, size, gravity);
  });
}

function spawnBossBouncer(
  state: GameState,
  xRatio: number,
  speed: number,
  size = 22,
  bouncesRemaining = 2,
) {
  return createCustomHazard(state, {
    x: Math.floor((state.width - size) * xRatio),
    size,
    speed,
    owner: "boss",
    variant: "boss",
    behavior: "bounce",
    bouncesRemaining,
  });
}

function spawnBossSplitter(
  state: GameState,
  xRatio: number,
  speed: number,
  size = 22,
  splitChildCount = 3,
  splitChildSize = 14,
  splitChildSpread = 82,
) {
  return createCustomHazard(state, {
    x: Math.floor((state.width - size) * xRatio),
    size,
    speed,
    owner: "boss",
    variant: "boss",
    behavior: "split",
    splitAtY: Math.floor(state.height * 0.28),
    splitChildCount,
    splitChildSize,
    splitChildSpeed: speed * 0.92,
    splitChildSpread,
  });
}

function spawnSideGlider(
  state: GameState,
  side: "left" | "right",
  y: number,
  speed: number,
  drift: number,
  size = 20,
  gravity = 120,
) {
  const hazard = createCustomHazard(state, {
    x: side === "left" ? 0 : state.width - size,
    size,
    speed,
    owner: "boss",
    variant: "boss",
    velocityX: side === "left" ? Math.abs(drift) : -Math.abs(drift),
    gravity,
  });
  hazard.x = side === "left" ? -size * 0.9 : state.width - size * 0.1;
  hazard.y = y;
  return hazard;
}

function pushRecentPattern(state: GameState, id: BossPatternId) {
  state.bossRecentPatterns = [...state.bossRecentPatterns, id].slice(-6);
}

function isHeavySetPiece(id: BossPatternId) {
  return HEAVY_SET_PIECE_IDS.has(id);
}

function pickReplacementPattern(seed: number, queue: BossPatternId[], replaceIndex: number, candidates: BossPatternId[]) {
  const previous = replaceIndex > 0 ? queue[replaceIndex - 1] : null;
  const next = replaceIndex < queue.length - 1 ? queue[replaceIndex + 1] : null;

  const filtered = candidates.filter((id) => {
    if (previous && id === previous) {
      return false;
    }
    if (next && id === next) {
      return false;
    }
    if (previous && getBossPatternArchetype(id) === getBossPatternArchetype(previous) && candidates.length > 1) {
      return false;
    }
    if (previous && next && getBossPatternFamily(previous) === getBossPatternFamily(next) && getBossPatternFamily(id) === getBossPatternFamily(previous) && candidates.length > 1) {
      return false;
    }
    return true;
  });

  const pool = filtered.length > 0 ? filtered : candidates;
  const rolled = advanceSeed(seed);
  return {
    id: pool[Math.floor(rolled.value * pool.length)],
    nextQueueSeed: rolled.nextQueueSeed,
  };
}

function ensureQueueIncludes(seed: number, queue: BossPatternId[], candidates: BossPatternId[]) {
  if (candidates.length === 0 || queue.some((id) => candidates.includes(id))) {
    return seed;
  }

  const replaceIndex = [...queue.keys()].reverse().find((index) => !candidates.includes(queue[index]));
  if (replaceIndex === undefined) {
    return seed;
  }

  const replacement = pickReplacementPattern(seed, queue, replaceIndex, candidates);
  queue[replaceIndex] = replacement.id;
  return replacement.nextQueueSeed;
}

const definitions: Record<BossPatternId, BossPatternDefinition> = {
  half_stomp_alternating: {
    archetype: "half_flip",
    family: "pressure",
    label: () => "절반 막기",
    normalAllowed: true,
    telegraphHardMs: 320,
    telegraphNormalMs: 620,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, isHardOrAboveMode(state.mode) ? 0.34 : 0.42, 4 + (isNightmareMode(state.mode) ? 1 : 0), (shot) => {
        const side = shot % 2 === 0 ? firstSide : oppositeSide(firstSide);
        spawnHalfHazard(state, side, giantSpeed(state, 12), 0.42, 70);
      });
    },
  },
  closing_doors: {
    archetype: "edge_doors",
    family: "pressure",
    label: () => "양문 닫기",
    normalAllowed: true,
    telegraphHardMs: 470,
    telegraphNormalMs: 760,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.58, 0.68, 0.32, 0.44), 2 + (state.round >= 10 ? 1 : 0), () => {
        spawnEdgeHazards(state, 0.3, giantSpeed(state, -8), 68);
      });
    },
  },
  center_crush: {
    archetype: "center_press",
    family: "pressure",
    label: () => "중앙 압착",
    normalAllowed: true,
    telegraphHardMs: 340,
    telegraphNormalMs: 780,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.5, 0.62, 0.28, 0.38), (isHardOrAboveMode(state.mode) ? 2 : 1) + (state.round >= 12 ? 1 : 0) + (isNightmareMode(state.mode) ? 1 : 0), () => {
        spawnCenterHazard(state, 0.46, giantSpeed(state, -12), 70);
      });
    },
  },
  edge_crush: {
    archetype: "edge_press",
    family: "pressure",
    label: () => "외곽 압착",
    normalAllowed: true,
    telegraphHardMs: 340,
    telegraphNormalMs: 780,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.52, 0.64, 0.28, 0.4), (isHardOrAboveMode(state.mode) ? 2 : 1) + (state.round >= 12 ? 1 : 0) + (isNightmareMode(state.mode) ? 1 : 0), () => {
        spawnEdgeHazards(state, 0.24, giantSpeed(state, -10), 70);
      });
    },
  },
  double_side_stomp: {
    archetype: "double_half",
    family: "pressure",
    label: () => "연속 덮기",
    normalAllowed: true,
    telegraphHardMs: 300,
    telegraphNormalMs: 610,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.32, 0.38, 0.18, 0.24), 3 + (state.round >= 9 ? 1 : 0), (shot) => {
        const side = shot < 2 ? firstSide : oppositeSide(firstSide);
        spawnHalfHazard(state, side, giantSpeed(state, 18), 0.42, 72);
      });
    },
  },
  center_swing: {
    archetype: "center_swing",
    family: "pressure",
    label: () => "중앙 스윙",
    normalAllowed: true,
    telegraphHardMs: 360,
    telegraphNormalMs: 690,
    run(state, delta) {
      const firstSide = pickSide(state);
      const order = firstSide === "left" ? ["left", "center", "right", "center"] as const : ["right", "center", "left", "center"] as const;
      const shots = isNightmareMode(state.mode)
        ? order.length + 1
        : isHardOrAboveMode(state.mode) && state.round >= 11
          ? order.length
          : order.length - 1;
      return tickPattern(state, delta, scaledInterval(state, 0.34, 0.44, 0.2, 0.28), shots, (shot) => {
        const step = order[shot];
        if (step === "center") {
          spawnCenterHazard(state, shot === shots - 1 ? 0.32 : 0.36, giantSpeed(state, -6), 70);
          return;
        }
        spawnHalfHazard(state, step, giantSpeed(state, 6), 0.38, 70);
      });
    },
  },
  door_jam: {
    archetype: "door_jam",
    family: "pressure",
    label: () => "문틀 압박",
    normalAllowed: true,
    telegraphHardMs: 320,
    telegraphNormalMs: 640,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.34, 0.44, 0.2, 0.28), 4, (shot) => {
        if (shot % 2 === 0) {
          spawnEdgeHazards(state, shot === 0 ? 0.22 : 0.28, giantSpeed(state, shot === 0 ? -18 : -6), 68);
          return;
        }
        spawnCenterHazard(state, shot === 1 ? 0.32 : 0.28, giantSpeed(state, shot === 1 ? 2 : 10), 72);
      });
    },
  },
  wing_press: {
    archetype: "wing_press",
    family: "pressure",
    label: () => "날개 압박",
    normalAllowed: true,
    telegraphHardMs: 320,
    telegraphNormalMs: 640,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.34, 0.44, 0.2, 0.28), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnEdgeHazards(state, 0.18, giantSpeed(state, -22), 64);
          return;
        }
        if (shot === 1) {
          spawnCenterHazard(state, 0.24, giantSpeed(state, 4), 68);
          return;
        }
        if (shot === 2) {
          spawnEdgeHazards(state, 0.24, giantSpeed(state, -8), 68);
          return;
        }
        spawnHalfHazard(state, pickSide(state), giantSpeed(state, 10), 0.34, 68);
      });
    },
  },
  three_gate_shuffle: {
    archetype: "three_gate",
    family: "pressure",
    label: () => "삼문 셔플",
    normalAllowed: false,
    telegraphHardMs: 340,
    telegraphNormalMs: 700,
    run(state, delta) {
      const firstSide = pickSide(state) === "left" ? ["left", "center", "right", "center"] as const : ["right", "center", "left", "center"] as const;
      const shots = state.round >= 11 ? firstSide.length + 1 : firstSide.length;
      return tickPattern(state, delta, scaledInterval(state, 0.3, 0.4, 0.18, 0.24), shots, (shot) => {
        const zone = firstSide[shot % firstSide.length];
        spawnSafeThirdSetup(state, zone, giantSpeed(state, -6), zone === "center" ? 78 : 84);
      });
    },
  },
  pillar_press: {
    archetype: "pillar_press",
    family: "pressure",
    label: () => "기둥 압박",
    normalAllowed: false,
    telegraphHardMs: 380,
    telegraphNormalMs: 720,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.4, 0.5, 0.22, 0.3), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot % 3 === 0) {
          spawnTwinPillars(state, 0.18, 0.62, 0.15, giantSpeed(state, -46), 106);
          return;
        }
        if (shot % 3 === 1) {
          spawnCenterHazard(state, 0.28, giantSpeed(state, -8), 76);
          return;
        }
        spawnTwinPillars(state, 0.1, 0.72, 0.12, giantSpeed(state, -18), 92);
      });
    },
  },
  pillar_slide: {
    archetype: "pillar_slide",
    family: "pressure",
    label: () => "기둥 슬라이드",
    normalAllowed: false,
    telegraphHardMs: 360,
    telegraphNormalMs: 720,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.38, 0.48, 0.22, 0.3), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnTwinPillars(state, 0.14, 0.66, 0.12, giantSpeed(state, -42), 96);
          return;
        }
        if (shot === 1) {
          spawnTwinPillars(state, 0.08, 0.74, 0.1, giantSpeed(state, -18), 90);
          return;
        }
        if (shot === 2) {
          spawnCenterHazard(state, 0.24, giantSpeed(state, -4), 72);
          return;
        }
        spawnTwinPillars(state, 0.2, 0.6, 0.12, giantSpeed(state, 4), 90);
      });
    },
  },
  shifting_corridor: {
    archetype: "corridor_shift",
    family: "lane",
    label: () => "통로 흔들기",
    normalAllowed: true,
    telegraphHardMs: 350,
    telegraphNormalMs: 660,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const variant = getPatternVariant(state, 4);
      const order = variant === 0
        ? Array.from({ length: laneCount }, (_, index) => index)
        : variant === 1
          ? Array.from({ length: laneCount }, (_, index) => laneCount - 1 - index)
          : variant === 2
            ? buildInsideOutOrder(laneCount)
            : buildCenterBreakOrder(laneCount);
      const shots = Math.min(order.length, (isHardOrAboveMode(state.mode) ? 5 : 4) + (state.round >= 10 ? 1 : 0) + (isNightmareMode(state.mode) ? 1 : 0));
      return tickPattern(state, delta, scaledInterval(state, 0.33, 0.42, 0.18, 0.24), shots, (shot) => {
        const safeLane = order[shot];
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 6));
      });
    },
  },
  zigzag_corridor: {
    archetype: "corridor_zigzag",
    family: "lane",
    label: () => "지그재그 통로",
    normalAllowed: true,
    telegraphHardMs: 340,
    telegraphNormalMs: 650,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const variant = getPatternVariant(state, 3);
      const order = variant === 0
        ? [0, laneCount - 1, 1, Math.max(0, laneCount - 2), Math.min(2, laneCount - 1)]
        : variant === 1
          ? [laneCount - 1, 0, Math.max(0, laneCount - 2), 1, Math.max(0, laneCount - 3)]
          : [0, Math.max(0, laneCount - 2), 1, laneCount - 1, Math.min(2, laneCount - 1)];
      return tickPattern(state, delta, scaledInterval(state, 0.31, 0.4, 0.18, 0.24), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 10));
      });
    },
  },
  staircase_corridor: {
    archetype: "corridor_stairs",
    family: "lane",
    label: () => "계단 통로",
    normalAllowed: true,
    telegraphHardMs: 340,
    telegraphNormalMs: 660,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const variant = getPatternVariant(state, 3);
      const order = variant === 0
        ? buildSweepOrder(laneCount, pickSide(state))
        : variant === 1
          ? buildSweepOrder(laneCount, pickSide(state) === "left" ? "right" : "left")
          : buildInsideOutOrder(laneCount);
      return tickPattern(state, delta, scaledInterval(state, 0.29, 0.38, 0.18, 0.24), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 8));
      });
    },
  },
  center_break: {
    archetype: "corridor_center",
    family: "lane",
    label: () => "중앙 탈출",
    normalAllowed: true,
    telegraphHardMs: 320,
    telegraphNormalMs: 640,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const variant = getPatternVariant(state, 3);
      const order = (variant === 0
        ? buildCenterBreakOrder(laneCount)
        : variant === 1
          ? buildInsideOutOrder(laneCount)
          : buildSweepOrder(laneCount, pickSide(state))).slice(0, isHardOrAboveMode(state.mode) ? laneCount : Math.min(laneCount, 5));
      return tickPattern(state, delta, scaledInterval(state, 0.3, 0.4, 0.18, 0.24), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 4), shot === 0 ? 24 : 28);
      });
    },
  },
  edge_tunnel: {
    archetype: "corridor_edge_tunnel",
    family: "lane",
    label: () => "끝선 질주",
    normalAllowed: true,
    telegraphHardMs: 320,
    telegraphNormalMs: 620,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const variant = getPatternVariant(state, 2);
      const order = buildEdgeTunnelOrder(laneCount, variant === 0 ? pickSide(state) : oppositeSide(pickSide(state)));
      const shots = Math.min(order.length, isHardOrAboveMode(state.mode) ? order.length : Math.min(4, order.length));
      return tickPattern(state, delta, scaledInterval(state, 0.3, 0.4, 0.18, 0.24), shots, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, shot < 2 ? 12 : 8), shot < 2 ? 32 : 30);
      });
    },
  },
  switch_press: {
    archetype: "switch_flip",
    family: "lane",
    label: () => "스위치 압박",
    normalAllowed: true,
    telegraphHardMs: 280,
    telegraphNormalMs: 560,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.28, 0.36, 0.16, 0.22), (isHardOrAboveMode(state.mode) ? 5 : 4) + (state.round >= 10 ? 1 : 0) + (isNightmareMode(state.mode) ? 1 : 0), (shot) => {
        const side = shot % 2 === 0 ? firstSide : oppositeSide(firstSide);
        spawnHalfHazard(state, side, giantSpeed(state, 14), 0.4, 66);
      });
    },
  },
  crossfall_mix: {
    archetype: "mix_crossfall",
    family: "lane",
    label: () => "교차 낙하",
    normalAllowed: true,
    telegraphHardMs: 330,
    telegraphNormalMs: 640,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const variant = getPatternVariant(state, 3);
      return tickPattern(state, delta, scaledInterval(state, 0.44, 0.5, 0.24, 0.3), 3 + (state.round >= 11 ? 1 : 0), (shot) => {
        const safeLane = variant === 0
          ? (shot + 1) % laneCount
          : variant === 1
            ? (laneCount - 1 - shot + laneCount) % laneCount
            : [Math.floor((laneCount - 1) / 2), 0, laneCount - 1, Math.max(0, laneCount - 2)][shot] ?? ((shot + 1) % laneCount);
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 2), 24);
        if (shot === 1) {
          spawnHalfHazard(state, firstSide, giantSpeed(state, -6), 0.36, 58);
        }
        if (shot === 2) {
          spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, -6), 0.36, 58);
        }
      });
    },
  },
  lane_flipback: {
    archetype: "lane_flipback",
    family: "lane",
    label: () => "반전 통로",
    normalAllowed: true,
    telegraphHardMs: 320,
    telegraphNormalMs: 630,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const order = buildFlipbackOrder(laneCount, pickSide(state));
      return tickPattern(state, delta, scaledInterval(state, 0.31, 0.4, 0.18, 0.24), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, shot === 1 ? 10 : 6), shot >= 2 ? 26 : 30);
      });
    },
  },
  center_lane_weave: {
    archetype: "center_lane_weave",
    family: "lane",
    label: () => "중앙 직조",
    normalAllowed: true,
    telegraphHardMs: 330,
    telegraphNormalMs: 640,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const centerLane = Math.floor((laneCount - 1) / 2);
      const firstSide = pickSide(state);
      const firstEdgeLane = firstSide === "left" ? 0 : laneCount - 1;
      const secondEdgeLane = firstSide === "left" ? laneCount - 1 : 0;
      const order = [centerLane, firstEdgeLane, centerLane, secondEdgeLane];
      return tickPattern(state, delta, scaledInterval(state, 0.36, 0.46, 0.22, 0.28), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, shot === 0 || shot === 2 ? 4 : 8), shot === 1 ? 30 : 24);
        if (shot === 1) {
          spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, -14), 0.28, 58);
        }
        if (shot === 2 && isHardOrAboveMode(state.mode)) {
          spawnHalfHazard(state, firstSide, giantSpeed(state, -10), 0.28, 58);
        }
      });
    },
  },
  mirror_dive: {
    archetype: "mirror_dive",
    family: "lane",
    label: () => "거울 급강하",
    normalAllowed: true,
    telegraphHardMs: 350,
    telegraphNormalMs: 690,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const centerLane = Math.floor((laneCount - 1) / 2);
      const firstSide = pickSide(state);
      const firstDrift = firstSide === "left" ? 86 : -86;
      const secondDrift = -firstDrift;
      return tickPattern(state, delta, scaledInterval(state, 0.4, 0.5, 0.22, 0.3), 3 + (state.round >= 10 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnArcPair(state, mediumSpeed(state, 6), firstDrift, 0.12, 0.76, 20, 176);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, centerLane, laneCount, laneSpeed(state, 6), 24);
          return;
        }
        if (shot === 2) {
          spawnArcPair(state, mediumSpeed(state, 12), secondDrift, 0.12, 0.76, 20, 184);
          return;
        }
        spawnLaneBarrage(state, firstSide === "left" ? laneCount - 1 : 0, laneCount, laneSpeed(state, 10), 26);
      });
    },
  },
  glider_cross: {
    archetype: "glider_cross",
    family: "lane",
    label: () => "글라이더 교차",
    normalAllowed: false,
    telegraphHardMs: 360,
    telegraphNormalMs: 720,
    run(state, delta) {
      const lanes = getLaneCount(state);
      const centerLane = Math.floor((lanes - 1) / 2);
      const topY = 40;
      const lowerY = 118;
      return tickPattern(state, delta, scaledInterval(state, 0.42, 0.52, 0.24, 0.32), 3, (shot) => {
        if (shot === 0) {
          spawnSideGlider(state, "left", topY, mediumSpeed(state, 10), 128, 20, 126);
          spawnSideGlider(state, "right", lowerY, mediumSpeed(state, 4), 110, 20, 118);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, centerLane, lanes, laneSpeed(state, 8), 24);
          return;
        }
        spawnSideGlider(state, "right", topY, mediumSpeed(state, 12), 132, 20, 128);
        spawnSideGlider(state, "left", lowerY, mediumSpeed(state, 6), 112, 20, 120);
      });
    },
  },
  glider_stack: {
    archetype: "glider_stack",
    family: "lane",
    label: () => "글라이더 연쇄",
    normalAllowed: false,
    telegraphHardMs: 350,
    telegraphNormalMs: 710,
    run(state, delta) {
      const startSide = pickSide(state);
      const sequence = startSide === "left"
        ? [
            { side: "left" as const, y: 46, drift: 122 },
            { side: "right" as const, y: 94, drift: 106 },
            { side: "left" as const, y: 152, drift: 94 },
            { side: "right" as const, y: 210, drift: 84 },
          ]
        : [
            { side: "right" as const, y: 46, drift: 122 },
            { side: "left" as const, y: 94, drift: 106 },
            { side: "right" as const, y: 152, drift: 94 },
            { side: "left" as const, y: 210, drift: 84 },
          ];
      return tickPattern(state, delta, scaledInterval(state, 0.31, 0.4, 0.18, 0.24), sequence.length, (shot) => {
        const current = sequence[shot];
        spawnSideGlider(state, current.side, current.y, mediumSpeed(state, 10 + shot * 3), current.drift, 18, 112);
      });
    },
  },
  diagonal_rain: {
    archetype: "diagonal_rain",
    family: "lane",
    label: () => "사선 낙하",
    normalAllowed: false,
    telegraphHardMs: 360,
    telegraphNormalMs: 700,
    run(state, delta) {
      const firstSide = pickSide(state);
      const xRatios = isNightmareMode(state.mode)
        ? firstSide === "left" ? [0.08, 0.66, 0.18, 0.56, 0.38] : [0.66, 0.08, 0.56, 0.18, 0.38]
        : firstSide === "left" ? [0.08, 0.66, 0.18, 0.56] : [0.66, 0.08, 0.56, 0.18];
      const drifts = isNightmareMode(state.mode)
        ? firstSide === "left" ? [92, -92, 74, -74, 0] : [-92, 92, -74, 74, 0]
        : firstSide === "left" ? [82, -82, 64, -64] : [-82, 82, -64, 64];
      return tickPattern(state, delta, scaledInterval(state, 0.3, 0.4, 0.18, 0.24), xRatios.length, (shot) => {
        spawnAngledBossHazard(state, xRatios[shot], mediumSpeed(state, shot < 2 ? 8 : 14) + (isNightmareMode(state.mode) ? 10 : 0), drifts[shot], 22, isNightmareMode(state.mode) ? 210 : 185);
      });
    },
  },
  cross_arc: {
    archetype: "cross_arc",
    family: "lane",
    label: () => "교차 포물선",
    normalAllowed: false,
    telegraphHardMs: 380,
    telegraphNormalMs: 720,
    run(state, delta) {
      const shots = (isNightmareMode(state.mode) ? 4 : 3) + (state.round >= 12 ? 1 : 0);
      return tickPattern(state, delta, scaledInterval(state, 0.38, 0.48, 0.22, 0.3), shots, (shot) => {
        spawnArcPair(state, mediumSpeed(state, 6 + shot * 4) + (isNightmareMode(state.mode) ? 8 : 0), shot % 2 === 0 ? 76 : 92, 0.12, 0.76, 20, isNightmareMode(state.mode) ? 195 : 180);
      });
    },
  },
  fan_arc: {
    archetype: "fan_arc",
    family: "pressure",
    label: () => "부채꼴 포물선",
    normalAllowed: false,
    telegraphHardMs: 420,
    telegraphNormalMs: 760,
    run(state, delta) {
      const variant = getPatternVariant(state, 2);
      const drifts = isNightmareMode(state.mode)
        ? (variant === 0 ? [-122, -34, 34, 122] as const : [-104, -22, 22, 104] as const)
        : (variant === 0 ? [-92, 0, 92] as const : [-72, 0, 72] as const);
      return tickPattern(state, delta, scaledInterval(state, 0.5, 0.62, 0.28, 0.38), (isNightmareMode(state.mode) ? 3 : 2) + (state.round >= 12 ? 1 : 0), () => {
        spawnFanSpread(state, mediumSpeed(state, 8) + (isNightmareMode(state.mode) ? 8 : 0), drifts, isNightmareMode(state.mode) ? 190 : 175, 18);
      });
    },
  },
  bounce_drive: {
    archetype: "bounce_drive",
    family: "trap",
    label: () => "도약 압박",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 760,
    run(state, delta) {
      const firstSide = pickSide(state);
      const bounceRatios = isNightmareMode(state.mode)
        ? firstSide === "left" ? [0.08, 0.38, 0.68] : [0.68, 0.38, 0.08]
        : firstSide === "left" ? [0.14, 0.62] : [0.62, 0.14];
      const laneCount = getLaneCount(state);
      const centerLane = Math.floor((laneCount - 1) / 2);
      return tickPattern(state, delta, scaledInterval(state, 0.42, 0.52, 0.24, 0.32), isNightmareMode(state.mode) ? 4 : 3, (shot) => {
        if (shot < bounceRatios.length) {
          spawnBossBouncer(state, bounceRatios[shot], mediumSpeed(state, 18) + (isNightmareMode(state.mode) ? 10 : 0), 22, isNightmareMode(state.mode) ? 3 : state.round >= 12 ? 2 : 1);
          return;
        }
        spawnLaneBarrage(state, centerLane, laneCount, laneSpeed(state, 8), 24);
      });
    },
  },
  split_rebound: {
    archetype: "split_rebound",
    family: "trap",
    label: () => "분열 도약",
    normalAllowed: false,
    telegraphHardMs: 420,
    telegraphNormalMs: 780,
    run(state, delta) {
      const startSide = pickSide(state);
      const leftRatio = startSide === "left" ? 0.12 : 0.62;
      const rightRatio = startSide === "left" ? 0.62 : 0.12;
      return tickPattern(state, delta, scaledInterval(state, 0.46, 0.58, 0.26, 0.34), 4, (shot) => {
        if (shot === 0) {
          spawnBossSplitter(state, leftRatio, mediumSpeed(state, 18), 22, isNightmareMode(state.mode) ? 4 : 3, 14, isNightmareMode(state.mode) ? 96 : 84);
          return;
        }
        if (shot === 1) {
          spawnBossBouncer(state, rightRatio, mediumSpeed(state, 22), 22, isNightmareMode(state.mode) ? 3 : 2);
          return;
        }
        if (shot === 2) {
          spawnBossSplitter(state, rightRatio, mediumSpeed(state, 24), 22, isNightmareMode(state.mode) ? 4 : 3, 14, isNightmareMode(state.mode) ? 100 : 88);
          return;
        }
        spawnBossBouncer(state, leftRatio, mediumSpeed(state, 28), 22, isNightmareMode(state.mode) ? 3 : 2);
      });
    },
  },
  shatter_lane: {
    archetype: "shatter_lane",
    family: "lane",
    label: () => "분열 통로",
    normalAllowed: false,
    telegraphHardMs: 390,
    telegraphNormalMs: 760,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const centerLane = Math.floor((laneCount - 1) / 2);
      const firstSide = pickSide(state);
      const ratios = firstSide === "left" ? [0.16, 0.6] : [0.6, 0.16];
      const childCount = isNightmareMode(state.mode) ? 4 : 3;
      return tickPattern(state, delta, scaledInterval(state, 0.44, 0.56, 0.24, 0.34), 3, (shot) => {
        if (shot === 0) {
          spawnBossSplitter(state, ratios[0], mediumSpeed(state, 18), 22, childCount, 14, isNightmareMode(state.mode) ? 92 : 82);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, centerLane, laneCount, laneSpeed(state, 8), 24);
          return;
        }
        spawnBossSplitter(state, ratios[1], mediumSpeed(state, 24), 22, childCount, 14, isNightmareMode(state.mode) ? 96 : 86);
      });
    },
  },
  corridor_snapback: {
    archetype: "corridor_snapback",
    family: "lane",
    label: () => "통로 되감기",
    normalAllowed: false,
    telegraphHardMs: 320,
    telegraphNormalMs: 660,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const order = buildSnapbackOrder(laneCount, pickSide(state));
      return tickPattern(state, delta, scaledInterval(state, 0.28, 0.38, 0.16, 0.22), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, shot >= 2 ? 14 : 10), shot === order.length - 1 ? 32 : 30);
      });
    },
  },
  lane_pincer: {
    archetype: "lane_pincer",
    family: "lane",
    label: () => "통로 죄기",
    normalAllowed: false,
    telegraphHardMs: 300,
    telegraphNormalMs: 620,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const firstLane = firstSide === "left" ? 0 : laneCount - 1;
      const secondLane = firstSide === "left" ? laneCount - 1 : 0;
      const centerLane = Math.floor((laneCount - 1) / 2);
      return tickPattern(state, delta, scaledInterval(state, 0.32, 0.42, 0.18, 0.24), 4, (shot) => {
        if (shot === 0) {
          spawnLaneBarrage(state, firstLane, laneCount, laneSpeed(state, 10), 32);
          return;
        }
        if (shot === 1) {
          spawnHalfHazard(state, firstSide, giantSpeed(state, -18), 0.46, 66);
          return;
        }
        if (shot === 2) {
          spawnLaneBarrage(state, secondLane, laneCount, laneSpeed(state, 14), 32);
          return;
        }
        spawnLaneBarrage(state, centerLane === secondLane ? firstLane : centerLane, laneCount, laneSpeed(state, 10), 30);
      });
    },
  },
  fake_safe_lane: {
    archetype: "trap_bait",
    family: "trap",
    label: (state) => (pickSide(state) === "left" ? "왼쪽 유도, 반대로 회피" : "오른쪽 유도, 반대로 회피"),
    normalAllowed: false,
    telegraphHardMs: 580,
    telegraphNormalMs: 900,
    run(state, delta) {
      const baitSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.5, 0.62, 0.3, 0.38), 2, (shot) => {
        if (shot === 0) {
          spawnSafeThirdSetup(state, baitSide, giantSpeed(state, -26), 82);
          return;
        }
        spawnHalfHazard(state, baitSide, giantSpeed(state, -10), 0.3, 62);
      });
    },
  },
  funnel_switch: {
    archetype: "trap_funnel_switch",
    family: "trap",
    label: () => "통로 뒤집기",
    normalAllowed: false,
    telegraphHardMs: 440,
    telegraphNormalMs: 780,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSafeSide = pickSide(state) === "left" ? "left" : "right";
      const firstSafeLane = firstSafeSide === "left" ? 0 : laneCount - 1;
      const secondSafeLane = firstSafeSide === "left" ? laneCount - 1 : 0;
      return tickPattern(state, delta, scaledInterval(state, 0.34, 0.44, 0.2, 0.28), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnSafeThirdSetup(state, firstSafeSide, giantSpeed(state, -10), 82);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, secondSafeLane, laneCount, laneSpeed(state, 8), 24);
          return;
        }
        if (shot === 2) {
          spawnSafeThirdSetup(state, secondSafeLane === 0 ? "left" : "right", giantSpeed(state, 4), 78);
          return;
        }
        spawnCenterHazard(state, 0.32, giantSpeed(state, -4), 72);
      });
    },
  },
  aftershock_lane: {
    archetype: "trap_aftershock_lane",
    family: "trap",
    label: () => "여진 통로",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 760,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const firstLane = firstSide === "left" ? 0 : laneCount - 1;
      const centerLane = Math.floor((laneCount - 1) / 2);
      const finalLane = centerLane === firstLane ? (firstLane === 0 ? laneCount - 1 : 0) : centerLane;
      return tickPattern(state, delta, scaledInterval(state, 0.42, 0.52, 0.24, 0.34), 4, (shot) => {
        if (shot === 0) {
          spawnCenterHazard(state, 0.34, giantSpeed(state, -12), 78);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, firstLane, laneCount, laneSpeed(state, 6), 26);
          return;
        }
        if (shot === 2) {
          spawnFollowupPair(state, mediumSpeed(state, 24));
          return;
        }
        spawnLaneBarrage(state, finalLane, laneCount, laneSpeed(state, 10), 28);
      });
    },
  },
  safe_third_flip: {
    archetype: "trap_safe_third_flip",
    family: "trap",
    label: () => "안전지대 뒤집기",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 780,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const centerLane = Math.floor((laneCount - 1) / 2);
      const finalLane = firstSide === "left" ? laneCount - 1 : 0;
      return tickPattern(state, delta, scaledInterval(state, 0.42, 0.52, 0.24, 0.32), 4, (shot) => {
        if (shot === 0) {
          spawnSafeThirdSetup(state, firstSide, giantSpeed(state, -28), 92);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, centerLane, laneCount, laneSpeed(state, 8), 24);
          return;
        }
        if (shot === 2) {
          spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, -6), 0.32, 60);
          return;
        }
        spawnLaneBarrage(state, finalLane, laneCount, laneSpeed(state, 12), 26);
      });
    },
  },
  residue_zone: {
    archetype: "trap_residue",
    family: "trap",
    label: () => "가운데 잔류 후 측면 압박",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 760,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const safeLane = pickSide(state) === "left" ? 0 : laneCount - 1;
      return tickPattern(state, delta, scaledInterval(state, 0.62, 0.74, 0.4, 0.5), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnCenterHazard(state, 0.48, giantSpeed(state, -154), 124);
          return;
        }
        if (shot % 2 === 1) {
          spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 8), 24);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 32));
      });
    },
  },
  residue_switch: {
    archetype: "trap_residue_switch",
    family: "trap",
    label: () => "한쪽 잔류 후 반대 전환",
    normalAllowed: false,
    telegraphHardMs: 420,
    telegraphNormalMs: 760,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.46, 0.58, 0.28, 0.38), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnHalfHazard(state, firstSide, giantSpeed(state, -112), 0.34, 118);
          return;
        }
        if (shot === 1) {
          spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, -24), 0.34, 74);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 28));
      });
    },
  },
  residue_crossfire: {
    archetype: "trap_residue_crossfire",
    family: "trap",
    label: () => "잔류 후 교차 압박",
    normalAllowed: false,
    telegraphHardMs: 420,
    telegraphNormalMs: 760,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const oppositeLane = firstSide === "left" ? laneCount - 1 : 0;
      return tickPattern(state, delta, scaledInterval(state, 0.44, 0.56, 0.24, 0.34), 4 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnSafeThirdSetup(state, firstSide, giantSpeed(state, -32), 96);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, oppositeLane, laneCount, laneSpeed(state, 8), 24);
          return;
        }
        if (shot === 2) {
          spawnFollowupPair(state, mediumSpeed(state, 30));
          return;
        }
        if (shot === 3) {
          spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, -12), 0.36, 78);
          return;
        }
        spawnLaneBarrage(state, oppositeLane === 0 ? Math.max(1, laneCount - 1) : 0, laneCount, laneSpeed(state, 12), 24);
      });
    },
  },
  residue_pivot: {
    archetype: "trap_residue_pivot",
    family: "trap",
    label: () => "잔류 피벗",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 780,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const finalLane = firstSide === "left" ? laneCount - 1 : 0;
      const pivotX = firstSide === "left" ? Math.floor(state.width * 0.12) : Math.floor(state.width * 0.66);
      return tickPattern(state, delta, scaledInterval(state, 0.44, 0.56, 0.24, 0.34), 4, (shot) => {
        if (shot === 0) {
          spawnGiantHazard(state, pivotX, Math.floor(state.width * 0.16), giantSpeed(state, -34), 94);
          return;
        }
        if (shot === 1) {
          spawnLaneBarrage(state, finalLane, laneCount, laneSpeed(state, 8), 24);
          return;
        }
        if (shot === 2) {
          spawnFollowupPair(state, mediumSpeed(state, 26));
          return;
        }
        spawnCenterHazard(state, 0.24, giantSpeed(state, -2), 74);
      });
    },
  },
  fake_warning: {
    archetype: "trap_warning",
    family: "trap",
    label: (state) => (pickSide(state) === "left" ? "왼쪽 낙하 경고" : "오른쪽 낙하 경고"),
    normalAllowed: false,
    telegraphHardMs: 470,
    telegraphNormalMs: 780,
    run(state, delta) {
      const warnedSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.5, 0.62, 0.28, 0.4), 1 + (state.round >= 12 ? 1 : 0), () => {
        spawnHalfHazard(state, oppositeSide(warnedSide), giantSpeed(state, 10), 0.4, 68);
      });
    },
  },
  corridor_fakeout: {
    archetype: "trap_corridor_fakeout",
    family: "trap",
    label: () => "가짜 통로",
    normalAllowed: false,
    telegraphHardMs: 410,
    telegraphNormalMs: 740,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      const firstLane = firstSide === "left" ? 0 : laneCount - 1;
      const secondLane = firstSide === "left" ? laneCount - 1 : 0;
      return tickPattern(state, delta, scaledInterval(state, 0.38, 0.5, 0.22, 0.3), 4, (shot) => {
        if (shot === 0) {
          spawnLaneBarrage(state, firstLane, laneCount, laneSpeed(state, 6), 26);
          return;
        }
        if (shot === 1) {
          spawnEdgeHazards(state, 0.22, giantSpeed(state, -12), 68);
          return;
        }
        if (shot === 2) {
          spawnLaneBarrage(state, secondLane, laneCount, laneSpeed(state, 10), 28);
          return;
        }
        spawnCenterHazard(state, 0.28, giantSpeed(state, 6), 72);
      });
    },
  },
  center_collapse: {
    archetype: "trap_center_collapse",
    family: "trap",
    label: () => "중앙 붕괴",
    normalAllowed: false,
    telegraphHardMs: 520,
    telegraphNormalMs: 840,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const centerLane = Math.floor((laneCount - 1) / 2);
      return tickPattern(state, delta, scaledInterval(state, 0.46, 0.58, 0.26, 0.36), 2 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnLaneBarrage(state, centerLane, laneCount, laneSpeed(state, 0), 24);
          return;
        }
        if (shot === 1) {
          spawnCenterHazard(state, 0.34, giantSpeed(state, -2), 78);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 20));
      });
    },
  },
  shoulder_crush: {
    archetype: "shoulder_crush",
    family: "trap",
    label: () => "어깨 붕괴",
    normalAllowed: false,
    telegraphHardMs: 400,
    telegraphNormalMs: 740,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.38, 0.5, 0.22, 0.3), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnGiantHazard(state, firstSide === "left" ? Math.floor(state.width * 0.1) : Math.floor(state.width * 0.64), Math.floor(state.width * 0.18), giantSpeed(state, -38), 92);
          return;
        }
        if (shot === 1) {
          spawnGiantHazard(state, firstSide === "left" ? Math.floor(state.width * 0.64) : Math.floor(state.width * 0.1), Math.floor(state.width * 0.18), giantSpeed(state, -8), 92);
          return;
        }
        if (shot === 2) {
          spawnCenterHazard(state, 0.24, giantSpeed(state, 0), 74);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 24));
      });
    },
  },
  delayed_burst: {
    archetype: "trap_burst",
    family: "trap",
    label: () => "지연 폭주",
    normalAllowed: false,
    telegraphHardMs: 720,
    telegraphNormalMs: 1020,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.5, 0.62, 0.28, 0.4), 1 + (state.round >= 12 ? 1 : 0), () => {
        spawnCenterHazard(state, 0.4, giantSpeed(state, 24), 74);
      });
    },
  },
  last_hit_followup: {
    archetype: "trap_followup",
    family: "trap",
    label: () => "막타 함정",
    normalAllowed: true,
    telegraphHardMs: 350,
    telegraphNormalMs: 650,
    run(state, delta) {
      return tickPattern(state, delta, scaledInterval(state, 0.48, 0.6, 0.26, 0.36), 2 + (state.round >= 11 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnEdgeHazards(state, 0.24, giantSpeed(state, -10), 64);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 18));
      });
    },
  },
};

const PATTERN_TIMING_MS: Record<BossPatternId, number> = {
  half_stomp_alternating: 1650,
  closing_doors: 1700,
  center_crush: 1580,
  edge_crush: 1580,
  double_side_stomp: 1680,
  center_swing: 1760,
  door_jam: 1780,
  wing_press: 1740,
  three_gate_shuffle: 1900,
  pillar_press: 1960,
  pillar_slide: 1880,
  shifting_corridor: 1540,
  zigzag_corridor: 1560,
  staircase_corridor: 1600,
  center_break: 1580,
  edge_tunnel: 1640,
  switch_press: 1500,
  crossfall_mix: 1740,
  lane_flipback: 1660,
  center_lane_weave: 1780,
  mirror_dive: 1860,
  glider_cross: 1940,
  glider_stack: 1880,
  diagonal_rain: 1760,
  cross_arc: 1880,
  fan_arc: 1940,
  bounce_drive: 2040,
  split_rebound: 2120,
  shatter_lane: 1980,
  corridor_snapback: 1760,
  lane_pincer: 1820,
  fake_safe_lane: 1760,
  funnel_switch: 1820,
  aftershock_lane: 1920,
  safe_third_flip: 1940,
  residue_zone: 2060,
  residue_switch: 1980,
  residue_crossfire: 2140,
  residue_pivot: 2020,
  fake_warning: 1680,
  corridor_fakeout: 1860,
  center_collapse: 1920,
  shoulder_crush: 1880,
  delayed_burst: 1780,
  last_hit_followup: 1640,
};

const themeDefinitions: Record<BossThemeId, BossThemeDefinition> = {
  pressure_intro: {
    id: "pressure_intro",
    label: "측면 압박",
    mode: "both",
    roundStart: 2,
    opener: ["half_stomp_alternating", "closing_doors"],
    core: ["center_crush", "double_side_stomp", "door_jam", "wing_press"],
    finisher: ["center_crush", "door_jam"],
    minQueueLength: 3,
    maxQueueLength: 5,
    maxHeavySetPieces: 0,
    durationFloorMs: 5600,
    themeFamilies: ["pressure"],
  },
  lane_intro: {
    id: "lane_intro",
    label: "통로 러시",
    mode: "both",
    roundStart: 2,
    opener: ["zigzag_corridor", "mirror_dive", "edge_tunnel"],
    core: ["switch_press", "crossfall_mix", "lane_flipback", "center_lane_weave", "mirror_dive"],
    finisher: ["door_jam", "mirror_dive"],
    antiStationaryFinishers: ["door_jam", "mirror_dive"],
    minQueueLength: 4,
    maxQueueLength: 4,
    maxHeavySetPieces: 0,
    durationFloorMs: 5000,
    themeFamilies: ["lane"],
  },
  corridor_intro: {
    id: "corridor_intro",
    label: "통로 비틀기",
    mode: "both",
    roundStart: 2,
    opener: ["shifting_corridor", "mirror_dive", "edge_tunnel"],
    core: ["center_break", "switch_press", "lane_flipback", "edge_tunnel", "mirror_dive"],
    finisher: ["crossfall_mix", "last_hit_followup", "door_jam"],
    antiStationaryFinishers: ["mirror_dive", "door_jam"],
    minQueueLength: 3,
    maxQueueLength: 4,
    maxHeavySetPieces: 0,
    durationFloorMs: 5600,
    themeFamilies: ["lane", "trap"],
  },
  trap_intro: {
    id: "trap_intro",
    label: "가짜 안전지대",
    mode: "both",
    roundStart: 2,
    opener: ["switch_press", "fake_warning", "fake_safe_lane"],
    core: ["last_hit_followup", "fake_safe_lane", "fake_warning", "center_lane_weave"],
    finisher: ["center_swing", "edge_tunnel", "crossfall_mix"],
    minQueueLength: 3,
    maxQueueLength: 4,
    maxHeavySetPieces: 0,
    durationFloorMs: 5800,
    themeFamilies: ["trap", "lane"],
  },
  pressure_bridge: {
    id: "pressure_bridge",
    label: "압박 교차",
    mode: "both",
    roundStart: 4,
    opener: ["closing_doors", "edge_crush"],
    core: ["center_break", "switch_press", "double_side_stomp", "door_jam", "wing_press", "fan_arc", "cross_arc"],
    finisher: ["center_swing", "crossfall_mix", "door_jam"],
    antiStationaryFinishers: ["center_swing", "door_jam"],
    minQueueLength: 4,
    maxQueueLength: 5,
    maxHeavySetPieces: 0,
    durationFloorMs: 6200,
    themeFamilies: ["pressure", "lane"],
  },
  edge_rotation: {
    id: "edge_rotation",
    label: "외곽 회전",
    mode: "both",
    roundStart: 4,
    opener: ["edge_tunnel", "switch_press"],
    core: ["crossfall_mix", "staircase_corridor", "last_hit_followup", "shifting_corridor", "lane_flipback", "center_lane_weave", "diagonal_rain"],
    finisher: ["center_swing", "door_jam"],
    antiStationaryFinishers: ["center_swing", "door_jam"],
    minQueueLength: 4,
    maxQueueLength: 5,
    maxHeavySetPieces: 0,
    durationFloorMs: 6200,
    themeFamilies: ["lane", "pressure"],
  },
  corridor_switch: {
    id: "corridor_switch",
    label: "통로 뒤집기",
    mode: "hard",
    roundStart: 2,
    opener: ["switch_press", "mirror_dive"],
    core: ["center_break", "shatter_lane", "corridor_snapback", "lane_pincer", "mirror_dive", "glider_cross"],
    finisher: ["crossfall_mix", "shatter_lane", "door_jam", "glider_cross"],
    antiStationaryFinishers: ["shatter_lane", "door_jam", "glider_cross"],
    minQueueLength: 4,
    maxQueueLength: 6,
    maxHeavySetPieces: 0,
    durationFloorMs: 7000,
    themeFamilies: ["lane"],
  },
  snapback_lite: {
    id: "snapback_lite",
    label: "되감기 러시",
    mode: "hard",
    roundStart: 6,
    opener: ["mirror_dive", "lane_flipback", "switch_press"],
    core: ["corridor_snapback", "center_break", "crossfall_mix", "shatter_lane", "pillar_slide", "diagonal_rain", "cross_arc"],
    finisher: ["corridor_snapback", "door_jam", "mirror_dive"],
    antiStationaryFinishers: ["door_jam", "mirror_dive"],
    minQueueLength: 5,
    maxQueueLength: 6,
    maxHeavySetPieces: 0,
    durationFloorMs: 7600,
    themeFamilies: ["lane", "pressure"],
  },
  trap_weave: {
    id: "trap_weave",
    label: "함정 직조",
    mode: "hard",
    roundStart: 2,
    opener: ["fake_safe_lane", "fake_warning", "safe_third_flip"],
    core: ["last_hit_followup", "center_collapse", "shoulder_crush", "aftershock_lane", "corridor_fakeout", "safe_third_flip"],
    finisher: ["last_hit_followup", "delayed_burst", "shoulder_crush", "aftershock_lane", "safe_third_flip"],
    minQueueLength: 4,
    maxQueueLength: 6,
    maxHeavySetPieces: 1,
    durationFloorMs: 8000,
    themeFamilies: ["trap"],
  },
  fakeout_chain: {
    id: "fakeout_chain",
    label: "속임수 연쇄",
    mode: "hard",
    roundStart: 12,
    opener: ["fake_warning", "last_hit_followup"],
    core: ["aftershock_lane", "fake_safe_lane", "last_hit_followup", "safe_third_flip", "bounce_drive", "split_rebound", "mirror_dive"],
    finisher: ["aftershock_lane", "bounce_drive", "door_jam"],
    antiStationaryFinishers: ["bounce_drive", "door_jam"],
    optionalSetPiece: ["funnel_switch"],
    minQueueLength: 4,
    maxQueueLength: 6,
    maxHeavySetPieces: 1,
    durationFloorMs: 8200,
    themeFamilies: ["trap"],
  },
  rush_detour: {
    id: "rush_detour",
    label: "러시 우회전",
    mode: "both",
    roundStart: 10,
    opener: ["mirror_dive", "lane_flipback"],
    core: ["center_lane_weave", "crossfall_mix", "wing_press", "edge_tunnel", "mirror_dive"],
    finisher: ["door_jam", "mirror_dive", "crossfall_mix"],
    antiStationaryFinishers: ["door_jam", "mirror_dive"],
    minQueueLength: 5,
    maxQueueLength: 6,
    maxHeavySetPieces: 0,
    durationFloorMs: 7600,
    themeFamilies: ["lane", "pressure"],
  },
  glide_duet: {
    id: "glide_duet",
    label: "활공 이중주",
    mode: "hard",
    roundStart: 10,
    opener: ["mirror_dive", "glider_cross"],
    core: ["glider_stack", "center_lane_weave", "crossfall_mix", "mirror_dive", "glider_cross"],
    finisher: ["door_jam", "glider_cross", "mirror_dive"],
    antiStationaryFinishers: ["door_jam", "glider_cross", "mirror_dive"],
    minQueueLength: 5,
    maxQueueLength: 6,
    maxHeavySetPieces: 0,
    durationFloorMs: 8200,
    themeFamilies: ["lane", "pressure"],
  },
  residue_fakeout: {
    id: "residue_fakeout",
    label: "잔류 속임수",
    mode: "hard",
    roundStart: 2,
    opener: ["fake_warning", "fake_safe_lane"],
    core: ["residue_zone", "residue_switch", "aftershock_lane", "corridor_fakeout", "residue_pivot", "bounce_drive", "split_rebound"],
    finisher: ["last_hit_followup", "center_collapse", "residue_crossfire", "residue_pivot", "split_rebound"],
    optionalSetPiece: ["residue_switch", "residue_crossfire", "residue_pivot"],
    minQueueLength: 4,
    maxQueueLength: 6,
    maxHeavySetPieces: 1,
    durationFloorMs: 8200,
    themeFamilies: ["trap"],
  },
  forced_cross: {
    id: "forced_cross",
    label: "강제 횡단",
    mode: "hard",
    roundStart: 8,
    opener: ["mirror_dive", "switch_press"],
    core: ["crossfall_mix", "aftershock_lane", "center_break", "wing_press", "fan_arc", "diagonal_rain", "glider_cross"],
    finisher: ["door_jam", "wing_press", "mirror_dive"],
    antiStationaryFinishers: ["door_jam", "mirror_dive"],
    minQueueLength: 5,
    maxQueueLength: 5,
    maxHeavySetPieces: 0,
    durationFloorMs: 8000,
    themeFamilies: ["lane", "trap", "pressure"],
  },
  split_crucible: {
    id: "split_crucible",
    label: "분열 용광로",
    mode: "hard",
    roundStart: 12,
    opener: ["shatter_lane", "switch_press"],
    core: ["split_rebound", "center_break", "glider_cross", "lane_pincer", "bounce_drive", "shatter_lane"],
    finisher: ["door_jam", "split_rebound", "shatter_lane"],
    antiStationaryFinishers: ["door_jam", "split_rebound", "shatter_lane"],
    minQueueLength: 6,
    maxQueueLength: 7,
    maxHeavySetPieces: 0,
    durationFloorMs: 9200,
    themeFamilies: ["lane", "trap", "pressure"],
  },
  arc_storm: {
    id: "arc_storm",
    label: "궤적 폭풍",
    mode: "nightmare",
    roundStart: 6,
    opener: ["diagonal_rain", "cross_arc", "glider_cross"],
    core: ["fan_arc", "diagonal_rain", "cross_arc", "shatter_lane", "wing_press", "glider_stack"],
    finisher: ["bounce_drive", "door_jam", "fan_arc", "glider_cross"],
    antiStationaryFinishers: ["bounce_drive", "door_jam", "glider_cross"],
    minQueueLength: 6,
    maxQueueLength: 8,
    maxHeavySetPieces: 0,
    durationFloorMs: 9800,
    themeFamilies: ["lane", "pressure", "trap"],
  },
  arc_pressure: {
    id: "arc_pressure",
    label: "포물선 압박",
    mode: "nightmare",
    roundStart: 6,
    opener: ["cross_arc", "wing_press"],
    core: ["fan_arc", "glider_cross", "diagonal_rain", "door_jam", "cross_arc"],
    finisher: ["bounce_drive", "fan_arc", "door_jam"],
    antiStationaryFinishers: ["bounce_drive", "door_jam"],
    minQueueLength: 6,
    maxQueueLength: 8,
    maxHeavySetPieces: 0,
    durationFloorMs: 9900,
    themeFamilies: ["pressure", "lane", "trap"],
  },
  lane_gauntlet: {
    id: "lane_gauntlet",
    label: "통로 연쇄",
    mode: "hard",
    roundStart: 2,
    opener: ["mirror_dive", "corridor_snapback"],
    core: ["lane_pincer", "center_break", "crossfall_mix", "shatter_lane", "diagonal_rain", "center_lane_weave"],
    finisher: ["corridor_snapback", "shatter_lane", "door_jam"],
    antiStationaryFinishers: ["shatter_lane", "door_jam"],
    minQueueLength: 5,
    maxQueueLength: 7,
    maxHeavySetPieces: 0,
    durationFloorMs: 7800,
    themeFamilies: ["lane"],
  },
  residue_storm: {
    id: "residue_storm",
    label: "잔류 폭풍",
    mode: "hard",
    roundStart: 2,
    opener: ["aftershock_lane", "fake_warning"],
    core: ["residue_zone", "residue_crossfire", "residue_switch", "corridor_fakeout", "residue_pivot", "fan_arc", "split_rebound"],
    finisher: ["center_collapse", "aftershock_lane", "delayed_burst", "residue_crossfire", "residue_pivot"],
    optionalSetPiece: ["residue_crossfire", "residue_pivot"],
    minQueueLength: 5,
    maxQueueLength: 7,
    maxHeavySetPieces: 2,
    durationFloorMs: 9000,
    themeFamilies: ["trap"],
  },
  residue_denial: {
    id: "residue_denial",
    label: "잔류 봉쇄",
    mode: "hard",
    roundStart: 8,
    opener: ["aftershock_lane", "fake_warning"],
    core: ["residue_switch", "residue_zone", "corridor_fakeout", "last_hit_followup", "residue_pivot", "bounce_drive", "cross_arc", "split_rebound"],
    finisher: ["residue_crossfire", "center_collapse", "delayed_burst", "residue_pivot"],
    optionalSetPiece: ["residue_crossfire", "residue_pivot"],
    minQueueLength: 5,
    maxQueueLength: 7,
    maxHeavySetPieces: 2,
    durationFloorMs: 9000,
    themeFamilies: ["trap"],
  },
  rebound_labyrinth: {
    id: "rebound_labyrinth",
    label: "도약 미궁",
    mode: "nightmare",
    roundStart: 8,
    opener: ["bounce_drive", "split_rebound", "safe_third_flip"],
    core: ["mirror_dive", "bounce_drive", "residue_pivot", "shatter_lane", "corridor_fakeout", "fan_arc", "glider_stack"],
    finisher: ["door_jam", "bounce_drive", "split_rebound"],
    antiStationaryFinishers: ["door_jam", "bounce_drive", "split_rebound"],
    optionalSetPiece: ["residue_crossfire", "pillar_slide"],
    minQueueLength: 6,
    maxQueueLength: 8,
    maxHeavySetPieces: 1,
    durationFloorMs: 10400,
    themeFamilies: ["trap", "lane", "pressure"],
  },
  recoil_pivot: {
    id: "recoil_pivot",
    label: "반동 피벗",
    mode: "nightmare",
    roundStart: 8,
    opener: ["split_rebound", "residue_pivot"],
    core: ["bounce_drive", "glider_stack", "residue_pivot", "shatter_lane", "corridor_fakeout", "fan_arc"],
    finisher: ["door_jam", "split_rebound", "bounce_drive"],
    antiStationaryFinishers: ["door_jam", "split_rebound", "bounce_drive"],
    optionalSetPiece: ["residue_crossfire", "pillar_slide"],
    minQueueLength: 6,
    maxQueueLength: 8,
    maxHeavySetPieces: 1,
    durationFloorMs: 10800,
    themeFamilies: ["trap", "lane", "pressure"],
  },
};

function updateFamilyStreak(state: GameState, family: BossPatternFamily) {
  if (state.bossPatternFamilyStreak === family) {
    state.bossPatternFamilyStreakCount += 1;
    return;
  }
  state.bossPatternFamilyStreak = family;
  state.bossPatternFamilyStreakCount = 1;
}

function beginPattern(state: GameState, id: BossPatternId) {
  const definition = definitions[id];
  state.bossPatternActiveId = id;
  state.bossPatternPhase = "telegraph";
  state.bossPatternStepTimer = 0;
  state.bossPatternShots = 0;
  state.bossPatternTimer = 0;
  state.bossTelegraphText = definition.label(state);
  state.bossTelegraphTimer = telegraphSeconds(state, definition);
}

function finishPattern(state: GameState) {
  if (state.bossPatternActiveId) {
    pushRecentPattern(state, state.bossPatternActiveId);
    updateFamilyStreak(state, getBossPatternFamily(state.bossPatternActiveId));
  }
  state.bossPatternIndex += 1;
  state.bossPatternActiveId = null;
  state.bossPatternPhase = "idle";
  state.bossPatternStepTimer = 0;
  state.bossPatternShots = 0;
  state.bossPatternTimer = 0;
  state.bossTelegraphText = "";
  state.bossTelegraphTimer = 0;
}

export function getAvailableBossPatternIds(mode: GameState["mode"]) {
  return (Object.keys(definitions) as BossPatternId[]).filter((id) => mode !== "normal" || definitions[id].normalAllowed);
}

export function getBossThemeLabel(themeId: BossThemeId | null) {
  return themeId ? themeDefinitions[themeId].label : "";
}

export function getUnlockedBossThemeIds(mode: GameState["mode"], round: number) {
  return getUnlockedThemes(mode, round).map((theme) => theme.id);
}

function toBossEncounterBuilderInput(state: GameState): BossEncounterBuilderInput {
  return {
    mode: state.mode,
    round: state.round,
    previousFamilyStreak: state.bossPatternFamilyStreak,
    previousFamilyStreakCount: state.bossPatternFamilyStreakCount,
    recentPatterns: state.bossRecentPatterns,
    recentThemes: state.bossRecentThemes,
    queueSeed: state.bossPatternSeed,
  };
}

function getUnlockedThemes(mode: GameState["mode"], round: number) {
  return Object.values(themeDefinitions).filter((theme) => {
    if (
      theme.mode !== "both"
      && theme.mode !== mode
      && !(mode === "nightmare" && theme.mode === "hard")
    ) {
      return false;
    }
    if (round < theme.roundStart) {
      return false;
    }
    if (theme.roundEnd && round > theme.roundEnd) {
      return false;
    }
    if (mode === "normal") {
      return [...theme.opener, ...theme.core, ...theme.finisher].every((id) => definitions[id].normalAllowed);
    }
    return true;
  });
}

function getQueueTargetLength(theme: BossThemeDefinition, mode: GameState["mode"], round: number) {
  const base = mode === "nightmare"
    ? round >= 12
      ? 8
      : round >= 8
        ? 7
        : 6
    : mode === "hard"
      ? round >= 12
        ? 7
        : round >= 8
          ? 6
          : 5
      : round >= 9 ? 4 : 3;
  return Math.max(theme.minQueueLength, Math.min(theme.maxQueueLength, base));
}

function buildRecentThemeSet(recentThemes: readonly BossThemeId[]) {
  return new Set(recentThemes.slice(-2));
}

function buildRecentFamilies(previousFamilyStreak: BossPatternFamily | null, previousFamilyStreakCount: number, queue: BossPatternId[]) {
  const seedFamilies = previousFamilyStreak === null ? [] : Array.from({ length: Math.min(2, previousFamilyStreakCount) }, () => previousFamilyStreak as BossPatternFamily);
  return [...seedFamilies, ...queue.map((id) => getBossPatternFamily(id))].slice(-2);
}

function buildRecentIds(recentPatterns: readonly BossPatternId[], queue: BossPatternId[]) {
  return new Set([...recentPatterns.slice(-4), ...queue.slice(-2)]);
}

function buildRecentArchetypes(recentPatterns: readonly BossPatternId[], queue: BossPatternId[]) {
  const recent = [...recentPatterns.slice(-2), ...queue.slice(-1)];
  return new Set(recent.map((id) => getBossPatternArchetype(id)));
}

function getNightmareThemeWeight(theme: BossThemeDefinition, round: number) {
  let weight = 1;
  if (theme.mode === "nightmare") {
    weight += 2.6;
  }
  if (theme.roundStart >= 8) {
    weight += 1.2;
  } else if (theme.roundStart >= 6) {
    weight += 0.8;
  } else if (theme.roundStart >= 4) {
    weight += 0.35;
  }
  if (theme.id === "pressure_intro" || theme.id === "lane_intro" || theme.id === "corridor_intro" || theme.id === "trap_intro") {
    weight *= round >= 10 ? 0.25 : 0.45;
  }
  if (theme.themeFamilies.includes("trap") && round >= 8) {
    weight += 0.25;
  }
  return Math.max(0.18, weight);
}

function pickTheme(seed: number, availableThemes: BossThemeDefinition[], recentThemes: readonly BossThemeId[], mode: GameState["mode"], round: number) {
  const recentThemeSet = buildRecentThemeSet(recentThemes);
  const pool = availableThemes.some((theme) => !recentThemeSet.has(theme.id))
    ? availableThemes.filter((theme) => !recentThemeSet.has(theme.id))
    : availableThemes;
  const rolled = advanceSeed(seed);

  if (mode === "nightmare") {
    const totalWeight = pool.reduce((sum, theme) => sum + getNightmareThemeWeight(theme, round), 0);
    let cursor = rolled.value * totalWeight;
    for (const theme of pool) {
      cursor -= getNightmareThemeWeight(theme, round);
      if (cursor <= 0) {
        return {
          nextQueueSeed: rolled.nextQueueSeed,
          theme,
        };
      }
    }
  }

  return {
    nextQueueSeed: rolled.nextQueueSeed,
    theme: pool[Math.floor(rolled.value * pool.length)],
  };
}

function pickPatternForSlot(input: BossEncounterBuilderInput, seed: number, queue: BossPatternId[], pool: BossPatternId[], maxHeavySetPieces: number) {
  const recentFamilies = buildRecentFamilies(input.previousFamilyStreak, input.previousFamilyStreakCount, queue);
  const recentIds = buildRecentIds(input.recentPatterns, queue);
  const recentArchetypeSet = buildRecentArchetypes(input.recentPatterns, queue);
  const heavySetPieceCount = queue.filter((id) => isHeavySetPiece(id)).length;
  const lastPattern = queue[queue.length - 1] ?? null;
  const filtered = pool.filter((id) => {
    if (input.mode === "normal" && !definitions[id].normalAllowed) {
      return false;
    }
    if (lastPattern === id && pool.length > 1) {
      return false;
    }
    if (recentIds.has(id) && pool.some((candidate) => !recentIds.has(candidate))) {
      return false;
    }
    if (recentArchetypeSet.has(getBossPatternArchetype(id)) && pool.some((candidate) => !recentArchetypeSet.has(getBossPatternArchetype(candidate)))) {
      return false;
    }
    if (recentFamilies.length === 2 && recentFamilies[0] === recentFamilies[1] && recentFamilies[0] === getBossPatternFamily(id) && pool.some((candidate) => getBossPatternFamily(candidate) !== recentFamilies[0])) {
      return false;
    }
    if (heavySetPieceCount >= maxHeavySetPieces && isHeavySetPiece(id)) {
      return false;
    }
    if (lastPattern && isHeavySetPiece(lastPattern) && isHeavySetPiece(id)) {
      return false;
    }
    if (
      lastPattern &&
      ["half_stomp_alternating", "closing_doors", "center_crush", "edge_crush", "center_swing", "double_side_stomp"].includes(lastPattern) &&
      ["center_crush", "edge_crush", "center_swing", "double_side_stomp"].includes(id)
    ) {
      return false;
    }
    if (lastPattern === "funnel_switch" && ["crossfall_mix", "three_gate_shuffle", "pillar_press", "center_collapse", "shoulder_crush", "delayed_burst"].includes(id)) {
      return false;
    }
    return true;
  });

  const selectionPool = filtered.length > 0 ? filtered : pool;
  const rolled = advanceSeed(seed);
  return {
    id: selectionPool[Math.floor(rolled.value * selectionPool.length)],
    nextQueueSeed: rolled.nextQueueSeed,
  };
}

function buildSlotOrder(theme: BossThemeDefinition, targetLength: number, mode: GameState["mode"], round: number, seed: number) {
  let nextQueueSeed = seed;
  let includeSetPiece = false;
  if (theme.optionalSetPiece && targetLength >= 4 && mode !== "normal" && round >= 5) {
    const rolled = advanceSeed(nextQueueSeed);
    nextQueueSeed = rolled.nextQueueSeed;
    includeSetPiece = rolled.value > (mode === "nightmare" ? 0.22 : 0.42);
  }

  const slots: Array<"opener" | "core" | "setPiece" | "finisher"> = ["opener"];
  const coreSlots = Math.max(1, targetLength - 2 - (includeSetPiece ? 1 : 0));
  for (let index = 0; index < coreSlots; index += 1) {
    if (includeSetPiece && index === 1) {
      slots.push("setPiece");
    }
    slots.push("core");
  }
  if (includeSetPiece && !slots.includes("setPiece")) {
    slots.push("setPiece");
  }
  slots.push("finisher");
  return { slots, nextQueueSeed };
}

function getThemePool(theme: BossThemeDefinition, slot: "opener" | "core" | "setPiece" | "finisher") {
  if (slot === "setPiece") {
    return theme.optionalSetPiece ?? [];
  }
  return theme[slot];
}

function injectFinisher(seed: number, queue: BossPatternId[], pool: BossPatternId[]) {
  if (pool.length === 0) {
    return seed;
  }

  const rolled = advanceSeed(seed);
  let picked = pool[Math.floor(rolled.value * pool.length)];
  const previous = queue[queue.length - 2] ?? null;

  if (previous && previous === picked && pool.length > 1) {
    const pickedIndex = pool.indexOf(picked);
    picked = pool[(pickedIndex + 1) % pool.length];
  }

  if (queue.length === 0) {
    queue.push(picked);
  } else {
    queue[queue.length - 1] = picked;
  }

  return rolled.nextQueueSeed;
}

export function buildBossEncounterPlan(input: BossEncounterBuilderInput): BossEncounterPlan {
  const availableThemes = getUnlockedThemes(input.mode, input.round);
  if (availableThemes.length === 0) {
    throw new Error(`No boss themes available for ${input.mode} round ${input.round}`);
  }

  let seed = input.queueSeed;
  const themePick = pickTheme(seed, availableThemes, input.recentThemes, input.mode, input.round);
  seed = themePick.nextQueueSeed;
  const theme = themePick.theme;
  const targetLength = getQueueTargetLength(theme, input.mode, input.round);
  const slotOrder = buildSlotOrder(theme, targetLength, input.mode, input.round, seed);
  seed = slotOrder.nextQueueSeed;

  const queue: BossPatternId[] = [];
  for (const slot of slotOrder.slots) {
    const pool = getThemePool(theme, slot);
    if (pool.length === 0) {
      continue;
    }
    const picked = pickPatternForSlot(input, seed, queue, pool, theme.maxHeavySetPieces);
    queue.push(picked.id);
    seed = picked.nextQueueSeed;
  }

  const themePatternPool = [...theme.opener, ...theme.core, ...theme.finisher, ...(theme.optionalSetPiece ?? [])];
  if (theme.themeFamilies.includes("lane")) {
    seed = ensureQueueIncludes(seed, queue, themePatternPool.filter((id) => getBossPatternFamily(id) === "lane"));
  }
  if (theme.themeFamilies.includes("trap")) {
    seed = ensureQueueIncludes(seed, queue, themePatternPool.filter((id) => getBossPatternFamily(id) === "trap"));
  }
  if (theme.antiStationaryFinishers && !queue.some((id) => theme.antiStationaryFinishers?.includes(id))) {
    seed = injectFinisher(seed, queue, theme.antiStationaryFinishers);
  }

  const durationMs = Math.max(
    theme.durationFloorMs,
    queue.reduce((total, id) => total + (definitions[id].minEncounterContributionMs ?? PATTERN_TIMING_MS[id]), 0) + Math.max(0, queue.length - 1) * 180,
  );

  return {
    themeId: theme.id,
    queue,
    nextQueueSeed: seed,
    minEncounterDuration: durationMs / 1000,
  };
}

export function buildBossPatternQueue(state: GameState) {
  return buildBossEncounterPlan(toBossEncounterBuilderInput(state)).queue;
}

export function initializeBossEncounter(state: GameState) {
  const plan = buildBossEncounterPlan(toBossEncounterBuilderInput(state));
  state.bossThemeId = plan.themeId;
  state.bossRecentThemes = [...state.bossRecentThemes, plan.themeId].slice(-3);
  state.bossPatternSeed = plan.nextQueueSeed;
  state.bossPatternQueue = plan.queue;
  state.bossPatternIndex = 0;
  state.bossPatternActiveId = null;
  state.bossPatternPhase = "idle";
  state.bossPatternStepTimer = 0;
  state.bossPatternShots = 0;
  state.bossPatternTimer = 0;
  state.bossTelegraphText = "";
  state.bossTelegraphTimer = 0;
  state.bossEncounterDuration = Math.max(BOSS_DURATION, plan.minEncounterDuration);
}

export function hasBossSequenceRemaining(state: GameState) {
  return state.bossPatternActiveId !== null || state.bossPatternIndex < state.bossPatternQueue.length;
}

export function runBossPattern(state: GameState, delta: number) {
  if (state.bossTelegraphTimer > 0) {
    state.bossTelegraphTimer = Math.max(0, state.bossTelegraphTimer - delta);
    if (state.bossTelegraphTimer === 0 && state.bossPatternPhase === "telegraph") {
      state.bossTelegraphText = "";
    }
  }

  if (state.bossPatternActiveId === null) {
    if (state.bossPatternIndex >= state.bossPatternQueue.length) {
      return;
    }
    beginPattern(state, state.bossPatternQueue[state.bossPatternIndex]);
  }

  const activeId = state.bossPatternActiveId;
  if (activeId === null) {
    return;
  }

  const definition = definitions[activeId];
  state.bossPatternStepTimer += delta;

  if (state.bossPatternPhase === "telegraph") {
    if (state.bossPatternStepTimer < telegraphSeconds(state, definition)) {
      return;
    }
    state.bossPatternPhase = "attack";
    state.bossPatternStepTimer = 0;
    state.bossPatternTimer = 0;
    state.bossTelegraphText = "";
    state.bossTelegraphTimer = 0;
  }

  if (state.bossPatternPhase === "attack" && definition.run(state, delta)) {
    state.bossPatternPhase = "cooldown";
    state.bossPatternStepTimer = 0;
    return;
  }

  if (state.bossPatternPhase === "cooldown") {
    if (state.bossPatternStepTimer < cooldownSeconds(state)) {
      return;
    }
    finishPattern(state);
  }
}

export function isHardOnlyPattern(id: BossPatternId) {
  return HARD_ONLY_PATTERNS.includes(id);
}
