import { describe, expect, it } from "vitest";

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
import { selectWavePattern, spawnWavePattern } from "./systems/spawn";
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
    const normal = createGameEngine("normal");
    const hard = createGameEngine("hard");

    updateGame(normal, 1.2, 0);
    updateGame(hard, 1.2, 0);

    expect(hard.hazards.length).toBeGreaterThanOrEqual(normal.hazards.length);
  });

  it("cycles through multiple hazard sizes in normal waves", () => {
    const state = createGameEngine("normal");
    state.invincibilityTimer = Number.POSITIVE_INFINITY;

    for (let step = 0; step < 6; step += 1) {
      updateGame(state, 1.05, 0);
    }

    expect(new Set(state.hazards.map((hazard) => hazard.size))).toEqual(new Set([16, 20, 24]));
  });

  it("spawns more hazards each round in normal mode", () => {
    const early = createGameEngine("normal");
    const late = createGameEngine("normal");
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
    state.waveDirector.seed = 300001;
    state.waveDirector.specialCooldown = 0;
    state.waveDirector.roundBudget = 2;
    state.waveDirector.clusterQuota = 2;
    state.waveDirector.bounceQuota = 0;
    state.waveDirector.splitterQuota = 0;

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

  it("keeps sampled hard boss encounters dodgeable from the real starting position", () => {
    const sampledRounds = [2, 4, 6, 8, 10, 12];
    const sampledSeeds = [1, 17, 39893, 177777, 300001];
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
