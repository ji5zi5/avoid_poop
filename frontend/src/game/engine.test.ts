import { describe, expect, it, vi } from "vitest";

import { buildWaveSpawnSpecs } from "../../../shared/src/index.js";
import { copy } from "../content/copy";
import { createWaveDirector } from "./state";
import { createGameEngine, updateGame } from "./engine";
import {
  buildBossPatternQueue,
  getAvailableBossPatternIds,
  getBossLanePositions,
  getBossThemeLabel,
  hasBossSequenceRemaining,
  initializeBossEncounter,
  isHardOnlyPattern,
  runBossPattern,
} from "./systems/bossPatterns";
import { maybeSpawnItem, selectWavePattern, spawnWavePattern } from "./systems/spawn";
import { getHazardHitbox, getPlayerHitbox } from "./systems/collision";

const BOSS_SIM_STEP = 0.05;
const PLAYER_X_STEP = 2;

function getCandidatePlayerXs(state: ReturnType<typeof createGameEngine>) {
  const limit = state.width - state.player.width;
  const xs = new Set<number>([state.player.x, 0, limit]);
  for (let x = 0; x <= limit; x += PLAYER_X_STEP) {
    xs.add(x);
  }
  return Array.from(xs).sort((a, b) => a - b);
}

function overlapsRect(a: ReturnType<typeof getPlayerHitbox>, b: ReturnType<typeof getHazardHitbox>) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function advanceBossSimulation(state: ReturnType<typeof createGameEngine>, delta: number) {
  state.elapsedInPhase += delta;
  runBossPattern(state, delta);
  state.hazards.forEach((hazard) => {
    hazard.x += (hazard.velocityX ?? 0) * delta;
    hazard.y += hazard.speed * delta;
    if (hazard.gravity) {
      hazard.speed += hazard.gravity * delta;
    }
  });
  state.hazards = state.hazards.filter((hazard) => {
    if (hazard.pendingRemoval) {
      return false;
    }
    if (hazard.x > state.width + hazard.width || hazard.x + hazard.width < -hazard.width) {
      return false;
    }
    return hazard.y < state.height + hazard.height;
  });
}

function hasReachableSafePath(state: ReturnType<typeof createGameEngine>) {
  const candidateXs = getCandidatePlayerXs(state);
  let reachable = candidateXs.map((x) => Math.abs(x - state.player.x) < 0.01);
  const deadline = state.bossEncounterDuration + 6;
  let elapsed = 0;

  while (elapsed < deadline && (hasBossSequenceRemaining(state) || state.hazards.some((hazard) => hazard.owner === "boss"))) {
    advanceBossSimulation(state, BOSS_SIM_STEP);
    elapsed += BOSS_SIM_STEP;

    const hazardHitboxes = state.hazards.map((hazard) => getHazardHitbox(hazard));
    const safe = candidateXs.map((x) => {
      const playerHitbox = getPlayerHitbox({ ...state.player, x });
      return hazardHitboxes.every((hazardHitbox) => !overlapsRect(playerHitbox, hazardHitbox));
    });

    const previousXs = candidateXs.filter((_, index) => reachable[index]);
    const nextReachable = candidateXs.map(() => false);
    const maxMove = state.player.speed * BOSS_SIM_STEP + PLAYER_X_STEP;
    let pointer = 0;

    for (let index = 0; index < candidateXs.length; index += 1) {
      if (!safe[index]) {
        continue;
      }
      while (pointer < previousXs.length && previousXs[pointer] < candidateXs[index] - maxMove) {
        pointer += 1;
      }
      if (pointer < previousXs.length && previousXs[pointer] <= candidateXs[index] + maxMove) {
        nextReachable[index] = true;
      }
    }

    reachable = nextReachable;
    if (reachable.every((value) => value === false)) {
      return false;
    }
  }

  return true;
}

function createBossEncounterState(round: number, seed: number) {
  const state = createGameEngine("hard");
  state.round = round;
  state.reachedRound = round;
  state.currentPhase = "boss";
  state.bossPatternSeed = seed;
  initializeBossEncounter(state);
  return state;
}

function runPassiveBossEncounter(state: ReturnType<typeof createGameEngine>, maxSteps = 500) {
  const initialTheme = state.bossThemeId;
  const startLives = state.player.lives;

  for (
    let step = 0;
    step < maxSteps && state.player.lives === startLives && (state.currentPhase === "boss" || state.pendingBossClearAnnouncement || state.hazards.length > 0);
    step += 1
  ) {
    updateGame(state, 0.05, 0);
  }

  return {
    initialTheme,
    lostLife: state.player.lives < startLives,
  };
}

function runPassiveBossEncounterAtX(state: ReturnType<typeof createGameEngine>, x: number, maxSteps = 500) {
  state.player.x = Math.max(0, Math.min(state.width - state.player.width, x));
  return runPassiveBossEncounter(state, maxSteps);
}

describe("game engine", () => {
  it("moves the player only within bounds", () => {
    const state = createGameEngine("normal");
    updateGame(state, 1, -1);
    expect(state.player.x).toBe(0);
    updateGame(state, 5, 1);
    expect(state.player.x).toBeLessThanOrEqual(state.width - state.player.width);
  });

  it("continues advancing rounds without a clear end state", () => {
    const state = createGameEngine("normal");
    state.invincibilityTimer = Number.POSITIVE_INFINITY;
    for (let step = 0; step < 40; step += 1) {
      updateGame(state, 1, 0);
    }
    expect(state.reachedRound).toBeGreaterThanOrEqual(3);
    expect(state.clear).toBe(false);
  });

  it("uses harder rules for hard mode", () => {
    const normal = createGameEngine("normal", { waveSeed: 101, bossSeed: 202 });
    const hard = createGameEngine("hard", { waveSeed: 101, bossSeed: 202 });

    updateGame(normal, 1.2, 0);
    updateGame(hard, 1.2, 0);

    expect(hard.hazards.length).toBeGreaterThanOrEqual(normal.hazards.length);
  });

  it("uses nightmare rules above hard mode", () => {
    const hard = createGameEngine("hard", { waveSeed: 101, bossSeed: 202 });
    const nightmare = createGameEngine("nightmare", { waveSeed: 101, bossSeed: 202 });

    updateGame(hard, 1.2, 0);
    updateGame(nightmare, 1.2, 0);

    expect(nightmare.hazards.length).toBeGreaterThanOrEqual(hard.hazards.length);
    expect(nightmare.waveDirector.roundBudget).toBeGreaterThanOrEqual(hard.waveDirector.roundBudget);
  });

  it("does not refund a heart on nightmare round transitions", () => {
    const state = createGameEngine("nightmare");
    state.player.lives = 1;
    state.elapsedInPhase = 8;

    updateGame(state, 0.016, 0);

    expect(state.round).toBe(2);
    expect(state.player.lives).toBe(1);
    expect(state.currentPhase).toBe("boss");
  });

  it("draws fresh initial seeds for new runs", () => {
    const randomSpy = vi.spyOn(Math, "random");
    try {
      randomSpy
        .mockReturnValueOnce(0.01)
        .mockReturnValueOnce(0.11)
        .mockReturnValueOnce(0.21)
        .mockReturnValueOnce(0.31);

      const first = createGameEngine("hard");
      const second = createGameEngine("hard");

      expect(first.waveDirector.seed).not.toBe(second.waveDirector.seed);
      expect(first.bossPatternSeed).not.toBe(second.bossPatternSeed);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("cycles through multiple hazard sizes in normal waves", () => {
    const state = createGameEngine("normal", { waveSeed: 23, bossSeed: 11 });
    state.invincibilityTimer = Number.POSITIVE_INFINITY;

    for (let step = 0; step < 6; step += 1) {
      updateGame(state, 1.05, 0);
    }

    expect(new Set(state.hazards.map((hazard) => hazard.size))).toEqual(new Set([16, 20, 24]));
  });

  it("spawns more hazards each round in normal mode", () => {
    const early = createGameEngine("normal", { waveSeed: 23, bossSeed: 11 });
    const late = createGameEngine("normal", { waveSeed: 23, bossSeed: 11 });
    early.invincibilityTimer = Number.POSITIVE_INFINITY;
    late.invincibilityTimer = Number.POSITIVE_INFINITY;
    late.round = 6;

    for (let step = 0; step < 4; step += 1) {
      updateGame(early, 0.7, 0);
      updateGame(late, 0.7, 0);
    }

    expect(late.nextHazardId).toBeGreaterThan(early.nextHazardId);
  });

  it("unlocks multi-drop wave patterns in later rounds", () => {
    const state = createGameEngine("hard");
    state.round = 6;
    state.waveDirector.seed = 15953;
    state.waveDirector.specialCooldown = 0;
    state.waveDirector.roundBudget = 2;
    state.waveDirector.clusterQuota = 2;
    state.waveDirector.bounceQuota = 0;
    state.waveDirector.splitterQuota = 0;
    state.waveDirector.tripleQuota = 0;

    const pattern = spawnWavePattern(state);

    expect(pattern).toBe("cluster_2");
    expect(state.hazards.length).toBe(2);
  });

  it("does not let nextHazardId change the selected wave pattern when director state is fixed", () => {
    const state = createGameEngine("hard");
    state.round = 10;
    state.waveDirector.seed = 1777;
    state.waveDirector.specialCooldown = 0;
    state.waveDirector.roundBudget = 3;
    state.waveDirector.clusterQuota = 2;
    state.waveDirector.tripleQuota = 1;
    state.waveDirector.splitterQuota = 1;
    state.waveDirector.bounceQuota = 1;

    const first = selectWavePattern({ ...state.waveDirector, recentPatterns: [...state.waveDirector.recentPatterns] }, state.mode, state.round);
    state.nextHazardId = 99;
    const second = selectWavePattern({ ...state.waveDirector, recentPatterns: [...state.waveDirector.recentPatterns] }, state.mode, state.round);

    expect(second.pattern).toBe(first.pattern);
  });

  it("does not let item spawning change the next supported wave selection for the same wave seed", () => {
    const withItem = createGameEngine("hard", { waveSeed: 505, bossSeed: 9001 });
    const withoutItem = createGameEngine("hard", { waveSeed: 505, bossSeed: 9001 });

    withItem.round = 4;
    withoutItem.round = 4;
    withItem.waveDirector = createWaveDirector("hard", 4, 505);
    withoutItem.waveDirector = createWaveDirector("hard", 4, 505);
    withItem.itemTimer = 99;

    maybeSpawnItem(withItem);

    const selectionWithItem = selectWavePattern({ ...withItem.waveDirector, recentPatterns: [...withItem.waveDirector.recentPatterns] }, withItem.mode, withItem.round);
    const selectionWithoutItem = selectWavePattern({ ...withoutItem.waveDirector, recentPatterns: [...withoutItem.waveDirector.recentPatterns] }, withoutItem.mode, withoutItem.round);

    expect(selectionWithItem.pattern).toBe(selectionWithoutItem.pattern);
    expect(selectionWithItem.nextDirector.seed).toBe(selectionWithoutItem.nextDirector.seed);
  });

  it("keeps triple clusters rarer than singles and doubles in the deterministic late sample window", () => {
    let director = createWaveDirector("hard", 8);
    director.seed = 17;
    const counts = {
      single: 0,
      cluster_2: 0,
      cluster_3: 0,
      splitter: 0,
      bouncer: 0,
    };

    for (let round = 8; round <= 12; round += 1) {
      director = {
        ...createWaveDirector("hard", round),
        seed: director.seed,
        patternCursor: director.patternCursor,
        recentPatterns: director.recentPatterns,
        specialCooldown: director.specialCooldown,
      };

      for (let step = 0; step < 40; step += 1) {
        const selected = selectWavePattern(director, "hard", round);
        counts[selected.pattern] += 1;
        director = selected.nextDirector;
      }
    }

    expect(counts.cluster_3).toBeLessThan(counts.single);
    expect(counts.cluster_3).toBeLessThan(counts.cluster_2);
  });

  it("splits special wave hazards into two children midair", () => {
    const state = createGameEngine("hard");
    state.hazards.push({
      id: 1,
      x: 120,
      y: 140,
      size: 24,
      width: 24,
      height: 24,
      speed: 180,
      owner: "wave",
      variant: "large",
      behavior: "split",
      splitAtY: 150,
      splitChildCount: 2,
      splitChildSize: 14,
      splitChildSpeed: 170,
      splitChildSpread: 72,
    });
    state.nextHazardId = 2;

    updateGame(state, 0.1, 0);

    const childHazards = state.hazards.filter((hazard) => hazard.size === 14);
    expect(childHazards).toHaveLength(2);
    expect(childHazards.some((hazard) => (hazard.velocityX ?? 0) < 0)).toBe(true);
    expect(childHazards.some((hazard) => (hazard.velocityX ?? 0) > 0)).toBe(true);
  });

  it("lets hard split hazards burst into three or four children", () => {
    const state = createGameEngine("hard");
    state.hazards.push({
      id: 1,
      x: 120,
      y: 140,
      size: 24,
      width: 24,
      height: 24,
      speed: 190,
      owner: "wave",
      variant: "large",
      behavior: "split",
      splitAtY: 150,
      splitChildCount: 4,
      splitChildSize: 14,
      splitChildSpeed: 178,
      splitChildSpread: 72,
    });
    state.nextHazardId = 2;

    updateGame(state, 0.1, 0);

    const childHazards = state.hazards.filter((hazard) => hazard.size === 14);
    expect(childHazards).toHaveLength(4);
    expect(childHazards.every((hazard) => typeof hazard.velocityX === "number")).toBe(true);
    expect(childHazards.filter((hazard) => (hazard.velocityX ?? 0) < 0)).toHaveLength(2);
    expect(childHazards.filter((hazard) => (hazard.velocityX ?? 0) > 0)).toHaveLength(2);
  });

  it("lets bounce hazards hop once before disappearing", () => {
    const state = createGameEngine("normal");
    state.spawnTimer = -999;
    state.hazards.push({
      id: 1,
      x: 80,
      y: state.height - 64,
      size: 18,
      width: 18,
      height: 18,
      speed: 180,
      owner: "wave",
      variant: "small",
      behavior: "bounce",
      bouncesRemaining: 1,
    });

    updateGame(state, 0.2, 0);
    expect(state.hazards[0]?.speed).toBeLessThan(0);
    const startX = state.hazards[0]?.x ?? 0;
    let activeBounceTime = 0;
    let maxTravel = 0;

    for (let step = 0; step < 20 && state.hazards.length > 0; step += 1) {
      updateGame(state, 0.1, 0);
      activeBounceTime += 0.1;
      if (state.hazards[0]) {
        maxTravel = Math.max(maxTravel, Math.abs(state.hazards[0].x - startX));
      }
    }

    expect(activeBounceTime).toBeGreaterThanOrEqual(0.35);
    expect(maxTravel).toBeGreaterThanOrEqual(18);
    expect(state.hazards).toHaveLength(0);
  });

  it("gives hard bounce hazards a stronger lateral rebound path", () => {
    const state = createGameEngine("hard");
    state.spawnTimer = -999;
    state.hazards.push({
      id: 1,
      x: 80,
      y: state.height - 64,
      size: 20,
      width: 20,
      height: 20,
      speed: 190,
      owner: "wave",
      variant: "medium",
      behavior: "bounce",
      bouncesRemaining: 1,
    });

    updateGame(state, 0.2, 0);
    const startX = state.hazards[0]?.x ?? 0;
    let maxTravel = 0;

    for (let step = 0; step < 20 && state.hazards.length > 0; step += 1) {
      updateGame(state, 0.1, 0);
      if (state.hazards[0]) {
        maxTravel = Math.max(maxTravel, Math.abs(state.hazards[0].x - startX));
      }
    }

    expect(maxTravel).toBeGreaterThanOrEqual(24);
  });

  it("lets hard bounce hazards rebound more than twice before disappearing", () => {
    const state = createGameEngine("hard");
    state.spawnTimer = -999;
    state.hazards.push({
      id: 1,
      x: 80,
      y: state.height - 64,
      size: 20,
      width: 20,
      height: 20,
      speed: 190,
      owner: "wave",
      variant: "medium",
      behavior: "bounce",
      bouncesRemaining: 3,
    });

    let bounceEvents = 0;
    let previousSpeed = state.hazards[0]?.speed ?? 0;

    for (let step = 0; step < 80 && state.hazards.length > 0; step += 1) {
      updateGame(state, 0.1, 0);
      const nextSpeed = state.hazards[0]?.speed ?? 0;
      if (previousSpeed > 0 && nextSpeed < 0) {
        bounceEvents += 1;
      }
      previousSpeed = nextSpeed;
    }

    expect(bounceEvents).toBeGreaterThanOrEqual(3);
    expect(state.hazards).toHaveLength(0);
  });

  it("builds a boss queue when entering boss phase", () => {
    const state = createGameEngine("hard");
    state.elapsedInPhase = 10;

    updateGame(state, 0.016, 0);

    expect(state.currentPhase).toBe("boss");
    expect(state.bossThemeId).not.toBeNull();
    expect(state.bossPatternQueue.length).toBeGreaterThan(0);
    expect(state.phaseAnnouncementText.length).toBeGreaterThan(0);
    expect(state.phaseAnnouncementText).toContain(getBossThemeLabel(state.bossThemeId));
    expect(state.phaseAnnouncementTimer).toBeGreaterThan(0);
    expect(state.screenShakeTimer).toBeGreaterThan(0);
    expect(state.itemToastText).toBe("보스 경고");
  });

  it("sends nightmare mode into boss phase on every round after round one", () => {
    const state = createGameEngine("nightmare");
    state.elapsedInPhase = 10;

    updateGame(state, 0.016, 0);

    expect(state.round).toBe(2);
    expect(state.currentPhase).toBe("boss");
    expect(state.bossPatternQueue.length).toBeGreaterThan(0);
  });

  it("waits to announce boss clear until boss-owned hazards are gone", () => {
    const state = createGameEngine("hard");
    state.currentPhase = "boss";
    state.bossPatternQueue = [];
    state.elapsedInPhase = 20;
    state.hazards.push({ id: 1, x: 20, y: 80, size: 20, width: 20, height: 20, speed: 0, owner: "boss", variant: "medium" });

    updateGame(state, 0.016, 0);

    expect(state.currentPhase).toBe("wave");
    expect(state.pendingBossClearAnnouncement).toBe(true);
    expect(state.phaseAnnouncementText).toBe("");

    state.hazards = [];
    updateGame(state, 0.016, 0);

    expect(state.pendingBossClearAnnouncement).toBe(false);
    expect(state.phaseAnnouncementText).toBe(copy.transitions.bossCleared);
  });

  it("does not spawn new wave hazards while boss-owned hazards are draining", () => {
    const state = createGameEngine("normal");
    state.currentPhase = "wave";
    state.pendingBossClearAnnouncement = true;
    state.spawnTimer = 5;
    state.hazards.push({ id: 7, x: 24, y: 120, size: 20, width: 20, height: 20, speed: 0, owner: "boss", variant: "medium" });

    updateGame(state, 0.5, 0);

    expect(state.nextHazardId).toBe(1);
    expect(state.spawnTimer).toBe(0);
    expect(state.elapsedInPhase).toBe(0);
  });

  it("freezes passive score, survival time, and item spawning during boss drain", () => {
    const state = createGameEngine("normal");
    state.currentPhase = "wave";
    state.pendingBossClearAnnouncement = true;
    state.score = 120;
    state.survivalTime = 8;
    state.itemTimer = 4;
    state.hazards.push({ id: 8, x: 40, y: 180, size: 20, width: 20, height: 20, speed: 0, owner: "boss", variant: "medium" });

    updateGame(state, 0.5, 0);

    expect(state.score).toBe(120);
    expect(state.survivalTime).toBe(8);
    expect(state.itemTimer).toBe(4);
    expect(state.items).toHaveLength(0);
  });

  it("leaves a dodgeable gap in hard boss lane patterns", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    const playerHitbox = getPlayerHitbox(state.player);
    const positions = getBossLanePositions(state);
    const hitboxes = positions.map((x) =>
      getHazardHitbox({ id: 0, x, y: 0, size: 28, width: 28, height: 28, speed: 0, owner: "boss", variant: "boss" }),
    );

    const gaps: number[] = [];
    gaps.push(hitboxes[0].x);
    for (let index = 0; index < hitboxes.length - 1; index += 1) {
      gaps.push(hitboxes[index + 1].x - (hitboxes[index].x + hitboxes[index].width));
    }
    gaps.push(state.width - (hitboxes[hitboxes.length - 1].x + hitboxes[hitboxes.length - 1].width));

    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(playerHitbox.width + 8);
  });

  it("keeps hard-only boss patterns out of normal mode queues", () => {
    const state = createGameEngine("normal");
    state.round = 9;

    expect(getAvailableBossPatternIds("normal").every((id) => !isHardOnlyPattern(id))).toBe(true);
    expect(buildBossPatternQueue(state).every((id) => !isHardOnlyPattern(id))).toBe(true);
  });

  it("uses giant hitboxes for half-screen boss hazards", () => {
    const state = createGameEngine("hard");
    const giantHitbox = getHazardHitbox({
      id: 1,
      x: 0,
      y: 12,
      size: 180,
      width: 180,
      height: 72,
      speed: 0,
      owner: "boss",
      variant: "giant",
    });

    expect(giantHitbox.width).toBeGreaterThanOrEqual(state.width * 0.45 - 20);
    expect(giantHitbox.height).toBeGreaterThan(40);
  });

  it("late hard bosses outscale the midgame wave pace", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["shifting_corridor"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;

    updateGame(state, 0.4, 0);
    updateGame(state, 0.4, 0);

    expect(state.hazards.length).toBeGreaterThan(3);
    expect(state.hazards.some((hazard) => hazard.speed >= 260)).toBe(true);
  });

  it("spawns diagonal boss hazards with drift and gravity in diagonal_rain", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["diagonal_rain"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 6 && state.hazards.length === 0; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.length).toBeGreaterThan(0);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) !== 0)).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.gravity ?? 0) > 0)).toBe(true);
  });

  it("spawns mirrored angled hazards in mirror_dive without relying on giant center swings", () => {
    const state = createGameEngine("hard");
    state.round = 10;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["mirror_dive"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 6 && state.hazards.length < 2; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.length).toBeGreaterThanOrEqual(2);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) < 0)).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) > 0)).toBe(true);
    expect(state.hazards.some((hazard) => hazard.variant === "giant")).toBe(false);
  });

  it("spawns a fan spread in fan_arc", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["fan_arc"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 6 && state.hazards.length < 3; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.length).toBeGreaterThanOrEqual(3);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) < 0)).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) > 0)).toBe(true);
  });

  it("spawns bouncing boss hazards in bounce_drive", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["bounce_drive"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 6 && state.hazards.length === 0; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.some((hazard) => hazard.behavior === "bounce")).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.bouncesRemaining ?? 0) >= 1)).toBe(true);
  });

  it("spawns split boss hazards in shatter_lane", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["shatter_lane"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 6 && state.hazards.length === 0; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.some((hazard) => hazard.behavior === "split")).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.splitChildCount ?? 0) >= 3)).toBe(true);
  });

  it("spawns side-entry gliders in glider_cross", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["glider_cross"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 6 && state.hazards.length < 2; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.length).toBeGreaterThanOrEqual(2);
    expect(state.hazards.some((hazard) => hazard.x < 40)).toBe(true);
    expect(state.hazards.some((hazard) => hazard.x > state.width - 40)).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) < 0)).toBe(true);
    expect(state.hazards.some((hazard) => (hazard.velocityX ?? 0) > 0)).toBe(true);
  });

  it("spawns layered side-entry gliders in glider_stack", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["glider_stack"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 8 && state.hazards.length < 3; step += 1) {
      updateGame(state, 0.25, 0);
    }

    const variedHeights = new Set(state.hazards.map((hazard) => Math.round(hazard.y / 10)));
    expect(state.hazards.length).toBeGreaterThanOrEqual(3);
    expect(variedHeights.size).toBeGreaterThanOrEqual(2);
    expect(state.hazards.every((hazard) => (hazard.velocityX ?? 0) !== 0)).toBe(true);
  });

  it("mixes splitters and bouncers in split_rebound", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["split_rebound"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 8 && state.hazards.length < 2; step += 1) {
      updateGame(state, 0.25, 0);
    }

    expect(state.hazards.some((hazard) => hazard.behavior === "split")).toBe(true);
    expect(state.hazards.some((hazard) => hazard.behavior === "bounce")).toBe(true);
  });

  it("keeps sampled hard boss encounters dodgeable from the real starting position", () => {
    const sampledRounds = [2, 4, 6, 8, 10, 12, 14];
    const sampledSeeds = [1, 17, 19773, 24716, 29659, 34602, 39545];
    const failures: string[] = [];

    for (const round of sampledRounds) {
      for (const seed of sampledSeeds) {
        const state = createGameEngine("hard");
        state.round = round;
        state.reachedRound = round;
        state.currentPhase = "boss";
        state.bossPatternSeed = seed;
        initializeBossEncounter(state);

        if (!hasReachableSafePath(state)) {
          failures.push(`round ${round} seed ${seed} theme ${state.bossThemeId ?? "unknown"}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps representative late hard-only themes dodgeable across their theme seeds", () => {
    const cases = [
      { round: 12, seed: 14830, themeId: "corridor_switch" },
      { round: 12, seed: 19773, themeId: "trap_weave" },
      { round: 12, seed: 24716, themeId: "rush_detour" },
      { round: 12, seed: 29659, themeId: "residue_fakeout" },
      { round: 12, seed: 34602, themeId: "split_crucible" },
      { round: 12, seed: 39545, themeId: "residue_storm" },
      { round: 12, seed: 44488, themeId: "residue_denial" },
      { round: 14, seed: 14830, themeId: "corridor_switch" },
      { round: 14, seed: 19773, themeId: "trap_weave" },
      { round: 14, seed: 24716, themeId: "rush_detour" },
      { round: 14, seed: 29659, themeId: "residue_fakeout" },
      { round: 14, seed: 34602, themeId: "split_crucible" },
      { round: 14, seed: 39545, themeId: "residue_storm" },
      { round: 14, seed: 44488, themeId: "residue_denial" },
    ] as const;
    const failures: string[] = [];

    for (const { round, seed, themeId } of cases) {
      const state = createBossEncounterState(round, seed);
      if (state.bossThemeId !== themeId) {
        failures.push(`round ${round} seed ${seed} expected ${themeId} got ${state.bossThemeId ?? "unknown"}`);
        continue;
      }
      if (!hasReachableSafePath(state)) {
        failures.push(`round ${round} seed ${seed} theme ${themeId} lost all reachable lanes`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("makes lane_intro punish standing still in the center", () => {
    const state = createBossEncounterState(2, 6356);

    expect(state.bossThemeId).toBe("lane_intro");

    expect(runPassiveBossEncounter(state, 400).lostLife).toBe(true);
  });

  it("removes stationary solves from representative corridor-family seeds", () => {
    const cases = [
      { round: 2, seed: 6356, themeId: "lane_intro", x: 160 },
      { round: 2, seed: 9887, themeId: "corridor_intro", x: 160 },
      { round: 2, seed: 19773, themeId: "corridor_switch", x: 160 },
      { round: 2, seed: 34602, themeId: "lane_gauntlet", x: 160 },
    ] as const;

    const failures: string[] = [];
    for (const { round, seed, themeId, x } of cases) {
      const result = runPassiveBossEncounterAtX(createBossEncounterState(round, seed), x, 500);
      if (result.initialTheme !== themeId) {
        failures.push(`round ${round} seed ${seed} expected ${themeId} got ${result.initialTheme ?? "unknown"}`);
        continue;
      }
      if (!result.lostLife) {
        failures.push(`round ${round} seed ${seed} theme ${themeId} still allows stationary solve at x=${x}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps movement-heavy boss themes from allowing passive center play", () => {
    const cases = [
      { round: 8, seed: 15889, themeId: "edge_rotation" },
      { round: 8, seed: 19773, themeId: "corridor_switch" },
      { round: 12, seed: 14830, themeId: "corridor_switch" },
      { round: 12, seed: 19773, themeId: "trap_weave" },
      { round: 12, seed: 24716, themeId: "rush_detour" },
      { round: 12, seed: 29659, themeId: "residue_fakeout" },
      { round: 12, seed: 34602, themeId: "split_crucible" },
      { round: 12, seed: 39545, themeId: "residue_storm" },
      { round: 12, seed: 44488, themeId: "residue_denial" },
    ] as const;
    const failures: string[] = [];

    for (const { round, seed, themeId } of cases) {
      const result = runPassiveBossEncounter(createBossEncounterState(round, seed));
      if (result.initialTheme !== themeId) {
        failures.push(`round ${round} seed ${seed} expected ${themeId} got ${result.initialTheme ?? "unknown"}`);
        continue;
      }
      if (!result.lostLife) {
        failures.push(`round ${round} seed ${seed} theme ${themeId} let center camping survive`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps triple clusters, multi-splits, and multi-bounces rare in the deterministic late sample window", () => {
    let director = createWaveDirector("hard", 8, 17);
    let cluster3Count = 0;
    let multiSplitCount = 0;
    let multiBounceCount = 0;
    let combinedCount = 0;
    let specialStreak = 0;
    let lastSpecial: "cluster_3" | "splitter" | "bouncer" | null = null;

    for (const round of [8, 10, 12, 14]) {
      director = {
        ...createWaveDirector("hard", round, director.seed),
        seed: director.seed,
        patternCursor: director.patternCursor,
        recentPatterns: director.recentPatterns,
        specialCooldown: director.specialCooldown,
      };

      for (let step = 0; step < 50; step += 1) {
        const selection = buildWaveSpawnSpecs({
          director,
          mode: "hard",
          round,
          width: 360,
          height: 520,
          nextHazardId: step + 1,
        });
        director = selection.nextDirector;

        const primaryHazard = selection.hazards[0];
        const isMultiSplit = selection.pattern === "splitter" && (primaryHazard?.splitChildCount ?? 0) >= 3;
        const isMultiBounce = selection.pattern === "bouncer" && (primaryHazard?.bouncesRemaining ?? 0) >= 2;

        if (selection.pattern === "cluster_3") {
          cluster3Count += 1;
        }
        if (isMultiSplit) {
          multiSplitCount += 1;
        }
        if (isMultiBounce) {
          multiBounceCount += 1;
        }
        if (isMultiSplit || isMultiBounce) {
          combinedCount += 1;
        }

        const specialPattern = selection.pattern === "cluster_3" || selection.pattern === "splitter" || selection.pattern === "bouncer"
          ? selection.pattern
          : null;

        if (specialPattern && specialPattern === lastSpecial) {
          specialStreak += 1;
        } else if (specialPattern) {
          lastSpecial = specialPattern;
          specialStreak = 1;
        } else {
          lastSpecial = null;
          specialStreak = 0;
        }

        expect(specialStreak).toBeLessThanOrEqual(2);
      }
    }

    expect(cluster3Count).toBeLessThanOrEqual(10);
    expect(multiSplitCount).toBeLessThanOrEqual(12);
    expect(multiBounceCount).toBeLessThanOrEqual(16);
    expect(combinedCount).toBeLessThanOrEqual(28);
  });

  it("surfaces more special wave patterns in nightmare than in hard over the same sample window", () => {
    const countSpecials = (mode: "hard" | "nightmare") => {
      let director = createWaveDirector(mode, 8, 17);
      let specialCount = 0;

      for (const round of [8, 10, 12, 14]) {
        director = {
          ...createWaveDirector(mode, round, director.seed),
          seed: director.seed,
          patternCursor: director.patternCursor,
          recentPatterns: director.recentPatterns,
          specialCooldown: director.specialCooldown,
        };

        for (let step = 0; step < 40; step += 1) {
          const selection = selectWavePattern(director, mode, round);
          director = selection.nextDirector;
          if (selection.pattern !== "single") {
            specialCount += 1;
          }
        }
      }

      return specialCount;
    };

    expect(countSpecials("nightmare")).toBeGreaterThan(countSpecials("hard"));
  });

  it("remembers recently finished boss patterns to avoid repetition next time", () => {
    const state = createGameEngine("hard");
    state.round = 8;
    state.currentPhase = "boss";
    state.bossPatternQueue = ["center_swing"];
    state.bossPatternActiveId = null;
    state.bossPatternIndex = 0;
    state.bossEncounterDuration = 30;

    for (let step = 0; step < 80 && !state.bossRecentPatterns.includes("center_swing"); step += 1) {
      updateGame(state, 0.1, 0);
    }

    expect(state.bossRecentPatterns).toContain("center_swing");
  });

  it("shows a reward toast and burst when an item is collected", () => {
    const state = createGameEngine("normal");
    state.items.push({
      id: 1,
      x: state.player.x,
      y: state.player.y,
      size: 14,
      speed: 0,
      type: "heal",
    });

    updateGame(state, 0.016, 0);

    expect(state.itemToastText).toBe("하트 +1");
    expect(state.itemToastTimer).toBeGreaterThan(0);
    expect(state.itemToastTone).toBe("reward");
    expect(state.effectBurstTimer).toBeGreaterThan(0);
    expect(state.effectBurstType).toBe("heal");
    expect(state.screenShakeTimer).toBe(0);
  });

  it("does not show an extra toast when a timed effect ends", () => {
    const state = createGameEngine("normal");
    state.invincibilityTimer = 0.1;
    state.itemToastText = "무적 4초";
    state.itemToastTimer = 0.1;

    updateGame(state, 0.2, 0);

    expect(state.invincibilityTimer).toBe(0);
    expect(state.itemToastText).toBe("");
  });
});
