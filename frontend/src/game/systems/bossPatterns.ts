import type { BossPatternFamily, BossPatternId, GameState } from "../state";

import { createCustomHazard, spawnCenterHazard, spawnEdgeHazards, spawnHalfHazard, spawnLaneBarrage } from "./spawn";

type BossPatternDefinition = {
  family: BossPatternFamily;
  label: (state: GameState) => string;
  normalAllowed: boolean;
  telegraphHardMs: number;
  telegraphNormalMs: number;
  run: (state: GameState, delta: number) => boolean;
};

const HARD_ONLY_PATTERNS: BossPatternId[] = ["fake_safe_lane", "residue_zone", "fake_warning", "delayed_burst"];

function clampRoundPressure(state: GameState) {
  return Math.max(0, state.round - 1);
}

function giantSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 296 : 252) + Math.min(92, clampRoundPressure(state) * 7) + bonus;
}

function laneSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 238 : 206) + Math.min(78, clampRoundPressure(state) * 6) + bonus;
}

function mediumSpeed(state: GameState, bonus = 0) {
  return (state.mode === "hard" ? 224 : 194) + Math.min(66, clampRoundPressure(state) * 5) + bonus;
}

function pickSide(state: GameState) {
  return (state.round + state.bossPatternIndex) % 2 === 0 ? "left" : "right";
}

function oppositeSide(side: "left" | "right") {
  return side === "left" ? "right" : "left";
}

function telegraphSeconds(state: GameState, definition: BossPatternDefinition) {
  return (state.mode === "hard" ? definition.telegraphHardMs : definition.telegraphNormalMs) / 1000;
}

function cooldownSeconds(state: GameState) {
  return state.mode === "hard" ? 0.18 : 0.26;
}

function nextSeed(state: GameState) {
  state.bossPatternSeed = (state.bossPatternSeed * 48271) % 2147483647;
  return state.bossPatternSeed / 2147483647;
}

function desiredQueueLength(state: GameState) {
  if (state.mode === "hard") {
    return state.round >= 7 ? 5 : 4;
  }
  return state.round >= 6 ? 4 : 3;
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

function recentFamiliesWithStreak(state: GameState, queue: BossPatternId[]) {
  const seedFamilies = state.bossPatternFamilyStreak === null ? [] : Array.from({ length: Math.min(2, state.bossPatternFamilyStreakCount) }, () => state.bossPatternFamilyStreak as BossPatternFamily);
  return [...seedFamilies, ...queue.map((id) => getBossPatternFamily(id))].slice(-2);
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

const definitions: Record<BossPatternId, BossPatternDefinition> = {
  half_stomp_alternating: {
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
    family: "pressure",
    label: () => "양문 닫기",
    normalAllowed: true,
    telegraphHardMs: 470,
    telegraphNormalMs: 760,
    run(state, delta) {
      return tickPattern(state, delta, state.mode === "hard" ? 0.58 : 0.68, 2, () => {
        spawnEdgeHazards(state, 0.34, giantSpeed(state, 10), 70);
      });
    },
  },
  center_crush: {
    family: "pressure",
    label: () => "중앙 압착",
    normalAllowed: true,
    telegraphHardMs: 340,
    telegraphNormalMs: 780,
    run(state, delta) {
      return tickPattern(state, delta, state.mode === "hard" ? 0.5 : 0.62, state.mode === "hard" ? 2 : 1, () => {
        spawnCenterHazard(state, 0.54, giantSpeed(state, 18), 72);
      });
    },
  },
  edge_crush: {
    family: "pressure",
    label: () => "외곽 압착",
    normalAllowed: true,
    telegraphHardMs: 340,
    telegraphNormalMs: 780,
    run(state, delta) {
      return tickPattern(state, delta, state.mode === "hard" ? 0.52 : 0.64, state.mode === "hard" ? 2 : 1, () => {
        spawnEdgeHazards(state, 0.27, giantSpeed(state, 8), 72);
      });
    },
  },
  double_side_stomp: {
    family: "pressure",
    label: () => "연속 덮기",
    normalAllowed: true,
    telegraphHardMs: 300,
    telegraphNormalMs: 610,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, state.mode === "hard" ? 0.32 : 0.38, 3, (shot) => {
        const side = shot < 2 ? firstSide : oppositeSide(firstSide);
        spawnHalfHazard(state, side, giantSpeed(state, 64), 0.48, 76);
      });
    },
  },
  shifting_corridor: {
    family: "lane",
    label: () => "통로 흔들기",
    normalAllowed: true,
    telegraphHardMs: 350,
    telegraphNormalMs: 660,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      return tickPattern(state, delta, state.mode === "hard" ? 0.33 : 0.42, state.mode === "hard" ? 5 : 4, (shot) => {
        const safeLane = shot % laneCount;
        spawnLaneBarrage(state, safeLane, laneCount, laneSpeed(state, 26));
      });
    },
  },
  zigzag_corridor: {
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
      return tickPattern(state, delta, state.mode === "hard" ? 0.31 : 0.4, order.length, (shot) => {
        spawnLaneBarrage(state, order[shot], laneCount, laneSpeed(state, 30));
      });
    },
  },
  switch_press: {
    family: "lane",
    label: () => "스위치 압박",
    normalAllowed: true,
    telegraphHardMs: 280,
    telegraphNormalMs: 560,
    run(state, delta) {
      const firstSide = pickSide(state);
      return tickPattern(state, delta, state.mode === "hard" ? 0.28 : 0.36, state.mode === "hard" ? 5 : 4, (shot) => {
        const side = shot % 2 === 0 ? firstSide : oppositeSide(firstSide);
        spawnHalfHazard(state, side, giantSpeed(state, 68), 0.44, 68);
      });
    },
  },
  crossfall_mix: {
    family: "lane",
    label: () => "교차 낙하",
    normalAllowed: true,
    telegraphHardMs: 330,
    telegraphNormalMs: 640,
    run(state, delta) {
      const laneCount = getLaneCount(state);
      const firstSide = pickSide(state);
      return tickPattern(state, delta, state.mode === "hard" ? 0.44 : 0.5, 3, (shot) => {
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
    family: "trap",
    label: (state) => (pickSide(state) === "left" ? "왼쪽이 안전해 보임" : "오른쪽이 안전해 보임"),
    normalAllowed: false,
    telegraphHardMs: 500,
    telegraphNormalMs: 820,
    run(state, delta) {
      const baitSide = pickSide(state);
      return tickPattern(state, delta, 0.52, 1, () => {
        spawnHalfHazard(state, baitSide, giantSpeed(state, 40), 0.46, 72);
      });
    },
  },
  residue_zone: {
    family: "trap",
    label: () => "잔류 함정",
    normalAllowed: false,
    telegraphHardMs: 430,
    telegraphNormalMs: 760,
    run(state, delta) {
      return tickPattern(state, delta, 0.74, 2, (shot) => {
        if (shot === 0) {
          spawnCenterHazard(state, 0.42, giantSpeed(state, -84), 96);
          return;
        }
        spawnFollowupPair(state, mediumSpeed(state, 48));
      });
    },
  },
  fake_warning: {
    family: "trap",
    label: (state) => (pickSide(state) === "left" ? "왼쪽 낙하 경고" : "오른쪽 낙하 경고"),
    normalAllowed: false,
    telegraphHardMs: 470,
    telegraphNormalMs: 780,
    run(state, delta) {
      const warnedSide = pickSide(state);
      return tickPattern(state, delta, 0.5, 1, () => {
        spawnHalfHazard(state, oppositeSide(warnedSide), giantSpeed(state, 42), 0.46, 72);
      });
    },
  },
  delayed_burst: {
    family: "trap",
    label: () => "지연 폭주",
    normalAllowed: false,
    telegraphHardMs: 720,
    telegraphNormalMs: 1020,
    run(state, delta) {
      return tickPattern(state, delta, 0.5, 1, () => {
        spawnCenterHazard(state, 0.5, giantSpeed(state, 92), 78);
      });
    },
  },
  last_hit_followup: {
    family: "trap",
    label: () => "막타 함정",
    normalAllowed: true,
    telegraphHardMs: 350,
    telegraphNormalMs: 650,
    run(state, delta) {
      return tickPattern(state, delta, 0.48, 2, (shot) => {
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
    const filtered = available.filter((id) => {
      if (lastPattern === id && available.length > 1) {
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
