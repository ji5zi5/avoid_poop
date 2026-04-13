import { describe, expect, it } from "vitest";

import { copy } from "../content/copy";
import { createGameEngine, updateGame } from "./engine";
import { buildBossPatternQueue, getAvailableBossPatternIds, getBossLanePositions, isHardOnlyPattern } from "./systems/bossPatterns";
import { getHazardHitbox, getPlayerHitbox } from "./systems/collision";

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

  it("builds a boss queue when entering boss phase", () => {
    const state = createGameEngine("hard");
    state.elapsedInPhase = 10;

    updateGame(state, 0.016, 0);

    expect(state.currentPhase).toBe("boss");
    expect(state.bossPatternQueue.length).toBeGreaterThan(0);
    expect(state.phaseAnnouncementText.length).toBeGreaterThan(0);
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

    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(playerHitbox.width);
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
