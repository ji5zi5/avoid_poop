import { describe, expect, it } from "vitest";

import { createGameEngine } from "../engine";
import { buildBossPatternQueue, getAvailableBossPatternIds, getBossPatternFamily, isHardOnlyPattern } from "./bossPatterns";

describe("boss patterns", () => {
  it("exposes 14 total boss patterns across hard mode", () => {
    expect(getAvailableBossPatternIds("hard")).toHaveLength(14);
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
});
