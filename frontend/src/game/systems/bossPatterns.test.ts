import { describe, expect, it } from "vitest";

import { createGameEngine } from "../engine";
import { buildBossPatternQueue, getAvailableBossPatternIds, getBossPatternFamily, isHardOnlyPattern } from "./bossPatterns";

describe("boss patterns", () => {
  it("exposes a larger hard-mode boss pattern pool", () => {
    expect(getAvailableBossPatternIds("hard")).toHaveLength(23);
  });

  it("keeps normal queues inside the normal-safe pattern pool", () => {
    const state = createGameEngine("normal");
    state.round = 8;

    const queue = buildBossPatternQueue(state);

    expect(queue.length).toBeGreaterThanOrEqual(3);
    expect(queue.every((id) => !isHardOnlyPattern(id))).toBe(true);
  });

  it("avoids three same-family patterns in a row", () => {
    const state = createGameEngine("hard");
    state.round = 10;

    const queue = buildBossPatternQueue(state);
    const families = queue.map((id) => getBossPatternFamily(id));

    for (let index = 0; index <= families.length - 3; index += 1) {
      expect(new Set(families.slice(index, index + 3)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("respects streak carry-over from the previous boss", () => {
    const state = createGameEngine("hard");
    state.round = 10;
    state.bossPatternFamilyStreak = "pressure";
    state.bossPatternFamilyStreakCount = 2;

    const queue = buildBossPatternQueue(state);

    expect(getBossPatternFamily(queue[0])).not.toBe("pressure");
  });

  it("increases queue length for late hard bosses", () => {
    const early = createGameEngine("hard");
    early.round = 4;
    const late = createGameEngine("hard");
    late.round = 12;

    expect(buildBossPatternQueue(late).length).toBeGreaterThan(buildBossPatternQueue(early).length);
  });

  it("avoids recently used pattern ids when enough choices remain", () => {
    const state = createGameEngine("hard");
    state.round = 12;
    state.bossRecentPatterns = ["half_stomp_alternating", "closing_doors", "center_crush"];

    const queue = buildBossPatternQueue(state);

    expect(queue[0]).not.toBe("half_stomp_alternating");
    expect(queue[0]).not.toBe("closing_doors");
    expect(queue[0]).not.toBe("center_crush");
  });

  it("forces hard bosses to include both lane pressure and trap variety", () => {
    const state = createGameEngine("hard");
    state.round = 8;

    const queue = buildBossPatternQueue(state);
    const families = queue.map((id) => getBossPatternFamily(id));

    expect(families).toContain("lane");
    expect(families).toContain("trap");
  });

  it("makes late hard bosses include a residue-style trap", () => {
    const state = createGameEngine("hard");
    state.round = 11;

    const queue = buildBossPatternQueue(state);

    expect(queue.some((id) => id === "residue_zone" || id === "residue_switch")).toBe(true);
  });

  it("makes hard bosses pull in at least one giant set-piece pattern", () => {
    const state = createGameEngine("hard");
    state.round = 7;

    const queue = buildBossPatternQueue(state);

    expect(queue.some((id) => ["three_gate_shuffle", "pillar_press", "funnel_switch", "shoulder_crush"].includes(id))).toBe(true);
  });
});
