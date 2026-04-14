import { BOSS_DURATION } from "../state";
import type { BossPatternFamily, BossPatternId, BossThemeId, GameState } from "../state";

import { createCustomHazard, spawnCenterHazard, spawnEdgeHazards, spawnGiantHazard, spawnHalfHazard, spawnLaneBarrage } from "./spawn";

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
  "fake_safe_lane",
  "funnel_switch",
  "residue_zone",
  "residue_switch",
  "fake_warning",
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
  "center_collapse",
  "shoulder_crush",
  "delayed_burst",
]);

function clampRoundPressure(state: GameState) {
  return Math.max(0, state.round - 1);
}

function giantSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 278 : 262) + Math.min(112, clampRoundPressure(state) * (state.mode === "hard" ? 8 : 8)) + bonus;
}

function laneSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 224 : 214) + Math.min(88, clampRoundPressure(state) * (state.mode === "hard" ? 6 : 6)) + bonus;
}

function mediumSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 210 : 198) + Math.min(78, clampRoundPressure(state) * (state.mode === "hard" ? 5 : 5)) + bonus;
}

function pickSide(state: GameState) {
  return (state.round + state.bossPatternIndex) % 2 === 0 ? "left" : "right";
}

function oppositeSide(side: "left" | "right") {
  return side === "left" ? "right" : "left";
}

function telegraphSeconds(state: GameState, definition: BossPatternDefinition) {
  const base = state.mode === "hard" ? definition.telegraphHardMs : definition.telegraphNormalMs;
  const reduction = clampRoundPressure(state) * (state.mode === "hard" ? 10 : 8);
  const floor = state.mode === "hard" ? 280 : 320;
  return Math.max(floor, base - reduction) / 1000;
}

function cooldownSeconds(state: GameState) {
  const base = state.mode === "hard" ? 0.24 : 0.3;
  const reduction = clampRoundPressure(state) * (state.mode === "hard" ? 0.006 : 0.006);
  return Math.max(state.mode === "hard" ? 0.14 : 0.16, base - reduction);
}

function scaledInterval(state: GameState, hardBase: number, normalBase: number, hardFloor: number, normalFloor: number) {
  const base = state.mode === "hard" ? hardBase : normalBase;
  const floor = state.mode === "hard" ? hardFloor : normalFloor;
  const reduction = clampRoundPressure(state) * (state.mode === "hard" ? 0.012 : 0.009);
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
      return tickPattern(state, delta, state.mode === "hard" ? 0.34 : 0.42, 4, (shot) => {
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
      return tickPattern(state, delta, scaledInterval(state, 0.5, 0.62, 0.28, 0.38), (state.mode === "hard" ? 2 : 1) + (state.round >= 12 ? 1 : 0), () => {
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
      return tickPattern(state, delta, scaledInterval(state, 0.52, 0.64, 0.28, 0.4), (state.mode === "hard" ? 2 : 1) + (state.round >= 12 ? 1 : 0), () => {
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
      const shots = state.mode === "hard" && state.round >= 11 ? order.length : order.length - 1;
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
  shifting_corridor: {
    archetype: "corridor_shift",
    family: "lane",
    label: () => "통로 흔들기",
    normalAllowed: true,
    telegraphHardMs: 350,
    telegraphNormalMs: 660,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      return tickPattern(state, delta, scaledInterval(state, 0.33, 0.42, 0.18, 0.24), (state.mode === "hard" ? 5 : 4) + (state.round >= 10 ? 1 : 0), (shot) => {
        const safeLane = shot % laneCount;
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
      const order = state.mode === "hard"
        ? [0, laneCount - 1, 1, Math.max(0, laneCount - 2), Math.min(2, laneCount - 1)]
        : [0, laneCount - 1, 1, Math.max(0, laneCount - 2)];
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
      const order = buildSweepOrder(laneCount, pickSide(state));
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
      const order = buildCenterBreakOrder(laneCount).slice(0, state.mode === "hard" ? laneCount : Math.min(laneCount, 5));
      return tickPattern(state, delta, scaledInterval(state, 0.3, 0.4, 0.18, 0.24), order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 4), shot === 0 ? 24 : 28);
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
      return tickPattern(state, delta, scaledInterval(state, 0.28, 0.36, 0.16, 0.22), (state.mode === "hard" ? 5 : 4) + (state.round >= 10 ? 1 : 0), (shot) => {
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
      return tickPattern(state, delta, scaledInterval(state, 0.44, 0.5, 0.24, 0.3), 3 + (state.round >= 11 ? 1 : 0), (shot) => {
        const safeLane = (shot + 1) % laneCount;
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
  fake_safe_lane: {
    archetype: "trap_bait",
    family: "trap",
    label: (state) => (pickSide(state) === "left" ? "왼쪽이 안전해 보임" : "오른쪽이 안전해 보임"),
    normalAllowed: false,
    telegraphHardMs: 500,
    telegraphNormalMs: 820,
    run(state, delta) {
      const baitSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.52, 0.62, 0.3, 0.4), 1 + (state.round >= 12 ? 1 : 0), () => {
        spawnHalfHazard(state, baitSide, giantSpeed(state, 8), 0.4, 68);
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
  residue_zone: {
    archetype: "trap_residue",
    family: "trap",
    label: () => "잔류 함정",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 760,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const safeLane = pickSide(state) === "left" ? 0 : laneCount - 1;
      return tickPattern(state, delta, scaledInterval(state, 0.62, 0.74, 0.4, 0.5), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnCenterHazard(state, 0.42, giantSpeed(state, -138), 96);
          return;
        }
        if (shot % 2 === 1) {
          spawnFollowupPair(state, mediumSpeed(state, 26));
          return;
        }
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 2), 24);
      });
    },
  },
  residue_switch: {
    archetype: "trap_residue_switch",
    family: "trap",
    label: () => "잔류 스위치",
    normalAllowed: false,
    telegraphHardMs: 420,
    telegraphNormalMs: 760,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, scaledInterval(state, 0.46, 0.58, 0.28, 0.38), 3 + (state.round >= 12 ? 1 : 0), (shot) => {
        if (shot === 0) {
          spawnHalfHazard(state, firstSide, giantSpeed(state, -96), 0.36, 94);
          return;
        }
        if (shot === 1) {
          spawnFollowupPair(state, mediumSpeed(state, 24));
          return;
        }
        spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, 6), 0.32, 68);
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
  three_gate_shuffle: 1900,
  pillar_press: 1960,
  shifting_corridor: 1540,
  zigzag_corridor: 1560,
  staircase_corridor: 1600,
  center_break: 1580,
  switch_press: 1500,
  crossfall_mix: 1740,
  fake_safe_lane: 1760,
  funnel_switch: 1820,
  residue_zone: 2060,
  residue_switch: 1980,
  fake_warning: 1680,
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
    core: ["center_crush", "double_side_stomp"],
    finisher: ["center_crush"],
    minQueueLength: 3,
    maxQueueLength: 4,
    maxHeavySetPieces: 0,
    durationFloorMs: 5200,
    themeFamilies: ["pressure"],
  },
  lane_intro: {
    id: "lane_intro",
    label: "통로 러시",
    mode: "both",
    roundStart: 2,
    opener: ["zigzag_corridor"],
    core: ["staircase_corridor", "zigzag_corridor", "switch_press", "crossfall_mix"],
    finisher: ["center_swing"],
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
    roundStart: 6,
    opener: ["shifting_corridor", "staircase_corridor"],
    core: ["center_break", "switch_press", "zigzag_corridor"],
    finisher: ["crossfall_mix", "last_hit_followup"],
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
    roundStart: 9,
    opener: ["switch_press", "fake_warning"],
    core: ["last_hit_followup", "fake_safe_lane"],
    finisher: ["center_swing"],
    minQueueLength: 3,
    maxQueueLength: 3,
    maxHeavySetPieces: 0,
    durationFloorMs: 5800,
    themeFamilies: ["trap", "lane"],
  },
  corridor_switch: {
    id: "corridor_switch",
    label: "통로 뒤집기",
    mode: "hard",
    roundStart: 5,
    opener: ["switch_press", "staircase_corridor"],
    core: ["center_break", "shifting_corridor"],
    finisher: ["crossfall_mix", "switch_press"],
    minQueueLength: 4,
    maxQueueLength: 5,
    maxHeavySetPieces: 0,
    durationFloorMs: 6400,
    themeFamilies: ["lane"],
  },
  trap_weave: {
    id: "trap_weave",
    label: "함정 직조",
    mode: "hard",
    roundStart: 7,
    opener: ["fake_safe_lane", "fake_warning"],
    core: ["last_hit_followup", "center_collapse", "shoulder_crush"],
    finisher: ["last_hit_followup", "delayed_burst", "shoulder_crush"],
    minQueueLength: 4,
    maxQueueLength: 5,
    maxHeavySetPieces: 1,
    durationFloorMs: 6800,
    themeFamilies: ["trap"],
  },
  residue_fakeout: {
    id: "residue_fakeout",
    label: "잔류 속임수",
    mode: "hard",
    roundStart: 10,
    opener: ["fake_warning", "fake_safe_lane"],
    core: ["residue_zone", "residue_switch"],
    finisher: ["last_hit_followup", "center_collapse"],
    optionalSetPiece: ["residue_switch"],
    minQueueLength: 4,
    maxQueueLength: 5,
    maxHeavySetPieces: 1,
    durationFloorMs: 7200,
    themeFamilies: ["trap"],
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
  state.bossTelegraphText = state.bossThemeId ? themeDefinitions[state.bossThemeId].label : definition.label(state);
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
  return (Object.keys(definitions) as BossPatternId[]).filter((id) => mode === "hard" || definitions[id].normalAllowed);
}

export function getBossThemeLabel(themeId: BossThemeId | null) {
  return themeId ? themeDefinitions[themeId].label : "";
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
    if (theme.mode !== "both" && theme.mode !== mode) {
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
  const base = mode === "hard" ? (round >= 10 ? 5 : 4) : round >= 9 ? 4 : 3;
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

function pickTheme(seed: number, availableThemes: BossThemeDefinition[], recentThemes: readonly BossThemeId[]) {
  const recentThemeSet = buildRecentThemeSet(recentThemes);
  const pool = availableThemes.some((theme) => !recentThemeSet.has(theme.id))
    ? availableThemes.filter((theme) => !recentThemeSet.has(theme.id))
    : availableThemes;
  const rolled = advanceSeed(seed);
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
  if (theme.optionalSetPiece && targetLength >= 4 && mode === "hard" && round >= 5) {
    const rolled = advanceSeed(nextQueueSeed);
    nextQueueSeed = rolled.nextQueueSeed;
    includeSetPiece = rolled.value > 0.42;
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

export function buildBossEncounterPlan(input: BossEncounterBuilderInput): BossEncounterPlan {
  const availableThemes = getUnlockedThemes(input.mode, input.round);
  if (availableThemes.length === 0) {
    throw new Error(`No boss themes available for ${input.mode} round ${input.round}`);
  }

  let seed = input.queueSeed;
  const themePick = pickTheme(seed, availableThemes, input.recentThemes);
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
