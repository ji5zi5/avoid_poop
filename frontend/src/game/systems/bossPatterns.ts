import type { BossPatternFamily, BossPatternId, GameState } from "../state";

import { createCustomHazard, spawnCenterHazard, spawnEdgeHazards, spawnHalfHazard, spawnLaneBarrage } from "./spawn";

type BossPatternDefinition = {
  archetype: string;
  family: BossPatternFamily;
  label: (state: GameState) => string;
  normalAllowed: boolean;
  telegraphHardMs: number;
  telegraphNormalMs: number;
  run: (state: GameState, delta: number) => boolean;
};

const HARD_ONLY_PATTERNS: BossPatternId[] = [
  "fake_safe_lane",
  "residue_zone",
  "residue_switch",
  "fake_warning",
  "center_collapse",
  "delayed_burst",
];

function clampRoundPressure(state: GameState) {
  return Math.max(0, state.round - 1);
}

function giantSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 312 : 262) + Math.min(138, clampRoundPressure(state) * (state.mode === "hard" ? 10 : 8)) + bonus;
}

function laneSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 248 : 214) + Math.min(112, clampRoundPressure(state) * (state.mode === "hard" ? 8 : 6)) + bonus;
}

function mediumSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 232 : 198) + Math.min(96, clampRoundPressure(state) * (state.mode === "hard" ? 7 : 5)) + bonus;
}

function pickSide(state: GameState) {
  return (state.round + state.bossPatternIndex) % 2 === 0 ? "left" : "right";
}

function oppositeSide(side: "left" | "right") {
  return side === "left" ? "right" : "left";
}

function telegraphSeconds(state: GameState, definition: BossPatternDefinition) {
  const base = state.mode === "hard" ? definition.telegraphHardMs : definition.telegraphNormalMs;
  const reduction = clampRoundPressure(state) * (state.mode === "hard" ? 16 : 12);
  const floor = state.mode === "hard" ? 180 : 260;
  return Math.max(floor, base - reduction) / 1000;
}

function cooldownSeconds(state: GameState) {
  const base = state.mode === "hard" ? 0.18 : 0.26;
  const reduction = clampRoundPressure(state) * (state.mode === "hard" ? 0.01 : 0.008);
  return Math.max(state.mode === "hard" ? 0.08 : 0.12, base - reduction);
}

function scaledInterval(state: GameState, hardBase: number, normalBase: number, hardFloor: number, normalFloor: number) {
  const base = state.mode === "hard" ? hardBase : normalBase;
  const floor = state.mode === "hard" ? hardFloor : normalFloor;
  const reduction = clampRoundPressure(state) * (state.mode === "hard" ? 0.012 : 0.009);
  return Math.max(floor, base - reduction);
}

function nextSeed(state: GameState) {
  state.bossPatternSeed = (state.bossPatternSeed * 48271) % 2147483647;
  return state.bossPatternSeed / 2147483647;
}

function desiredQueueLength(state: GameState) {
  if (state.mode === "hard") {
    if (state.round >= 10) {
      return 7;
    }
    return state.round >= 6 ? 6 : 5;
  }
  if (state.round >= 12) {
    return 5;
  }
  return state.round >= 7 ? 4 : 3;
}

function getLaneCount(state: GameState) {
  if (state.mode === "hard") {
    return Math.min(6, 4 + Math.floor(clampRoundPressure(state) / 4));
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

function recentFamiliesWithStreak(state: GameState, queue: BossPatternId[]) {
  const seedFamilies = state.bossPatternFamilyStreak === null ? [] : Array.from({ length: Math.min(2, state.bossPatternFamilyStreakCount) }, () => state.bossPatternFamilyStreak as BossPatternFamily);
  return [...seedFamilies, ...queue.map((id) => getBossPatternFamily(id))].slice(-2);
}

function recentPatternIds(state: GameState, queue: BossPatternId[]) {
  return new Set([...state.bossRecentPatterns.slice(-4), ...queue.slice(-2)]);
}

function recentArchetypes(state: GameState, queue: BossPatternId[]) {
  const recent = [...state.bossRecentPatterns.slice(-2), ...queue.slice(-1)];
  return new Set(recent.map((id) => getBossPatternArchetype(id)));
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

function pickReplacementPattern(state: GameState, queue: BossPatternId[], replaceIndex: number, candidates: BossPatternId[]) {
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
  return pool[Math.floor(nextSeed(state) * pool.length)];
}

function ensureQueueIncludes(state: GameState, queue: BossPatternId[], candidates: BossPatternId[]) {
  if (candidates.length === 0 || queue.some((id) => candidates.includes(id))) {
    return;
  }

  const replaceIndex = [...queue.keys()].reverse().find((index) => !candidates.includes(queue[index]));
  if (replaceIndex === undefined) {
    return;
  }

  queue[replaceIndex] = pickReplacementPattern(state, queue, replaceIndex, candidates);
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
        spawnHalfHazard(state, side, giantSpeed(state, 54), 0.46, 74);
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
        spawnEdgeHazards(state, 0.34, giantSpeed(state, 10), 70);
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
        spawnCenterHazard(state, 0.54, giantSpeed(state, 18), 72);
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
        spawnEdgeHazards(state, 0.27, giantSpeed(state, 8), 72);
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
        spawnHalfHazard(state, side, giantSpeed(state, 64), 0.48, 76);
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
          spawnCenterHazard(state, shot === shots - 1 ? 0.36 : 0.4, giantSpeed(state, 20), 74);
          return;
        }
        spawnHalfHazard(state, step, giantSpeed(state, 28), 0.42, 74);
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
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 26));
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
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 30));
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
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 34));
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
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 28), shot === 0 ? 24 : 28);
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
        spawnHalfHazard(state, side, giantSpeed(state, 68), 0.44, 68);
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
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 18), 24);
        if (shot === 1) {
          spawnHalfHazard(state, firstSide, giantSpeed(state, 18), 0.4, 62);
        }
        if (shot === 2) {
          spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, 18), 0.4, 62);
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
        spawnHalfHazard(state, baitSide, giantSpeed(state, 40), 0.46, 72);
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
          spawnCenterHazard(state, 0.5, giantSpeed(state, -112), 112);
          return;
        }
        if (shot % 2 === 1) {
          spawnFollowupPair(state, mediumSpeed(state, 54));
          return;
        }
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 18), 24);
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
          spawnHalfHazard(state, firstSide, giantSpeed(state, -68), 0.43, 110);
          return;
        }
        if (shot === 1) {
          spawnFollowupPair(state, mediumSpeed(state, 62));
          return;
        }
        spawnHalfHazard(state, oppositeSide(firstSide), giantSpeed(state, 56), 0.38, 74);
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
        spawnHalfHazard(state, oppositeSide(warnedSide), giantSpeed(state, 42), 0.46, 72);
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
          spawnLaneBarrage(state, centerLane, laneCount, laneSpeed(state, 18), 24);
          return;
        }
        if (shot === 1) {
          spawnCenterHazard(state, 0.4, giantSpeed(state, 34), 86);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 50));
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
        spawnCenterHazard(state, 0.5, giantSpeed(state, 92), 78);
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
          spawnEdgeHazards(state, 0.28, giantSpeed(state, 6), 68);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 42));
      });
    },
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
  state.bossTelegraphText = "incoming";
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

export function buildBossPatternQueue(state: GameState) {
  const available = getAvailableBossPatternIds(state.mode);
  const queue: BossPatternId[] = [];

  while (queue.length < desiredQueueLength(state)) {
    const lastPattern = queue[queue.length - 1] ?? null;
    const recentFamilies = recentFamiliesWithStreak(state, queue);
    const recentIds = recentPatternIds(state, queue);
    const recentArchetypeSet = recentArchetypes(state, queue);
    const filtered = available.filter((id) => {
      if (lastPattern === id && available.length > 1) {
        return false;
      }
      if (recentIds.has(id) && available.length - recentIds.size > 0) {
        return false;
      }
      if (recentArchetypeSet.has(getBossPatternArchetype(id)) && available.some((candidate) => !recentArchetypeSet.has(getBossPatternArchetype(candidate)))) {
        return false;
      }
      if (recentFamilies.length === 2 && recentFamilies[0] === recentFamilies[1] && recentFamilies[0] === getBossPatternFamily(id)) {
        return false;
      }
      return true;
    });
    const pool = filtered.length > 0 ? filtered : available;
    const index = Math.floor(nextSeed(state) * pool.length);
    queue.push(pool[index]);
  }

  if (state.mode === "hard" && state.round >= 5) {
    ensureQueueIncludes(state, queue, available.filter((id) => getBossPatternFamily(id) === "trap"));
    ensureQueueIncludes(state, queue, available.filter((id) => getBossPatternFamily(id) === "lane"));
  }

  if (state.mode === "hard" && state.round >= 8) {
    ensureQueueIncludes(state, queue, ["residue_zone", "residue_switch"]);
  }

  return queue;
}

export function initializeBossEncounter(state: GameState) {
  state.bossPatternQueue = buildBossPatternQueue(state);
  state.bossPatternIndex = 0;
  state.bossPatternActiveId = null;
  state.bossPatternPhase = "idle";
  state.bossPatternStepTimer = 0;
  state.bossPatternShots = 0;
  state.bossPatternTimer = 0;
  state.bossTelegraphText = "";
  state.bossTelegraphTimer = 0;
  state.bossEncounterDuration = state.bossPatternQueue.length * (state.mode === "hard" ? 2.8 : 3.2) + 1.8;
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
