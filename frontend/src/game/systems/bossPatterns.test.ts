import { describe, expect, it } from "vitest";

import type { BossThemeId } from "../state";
import { createGameEngine } from "../engine";
import { buildBossEncounterPlan, buildBossPatternQueue, getAvailableBossPatternIds, getBossThemeLabel, isHardOnlyPattern } from "./bossPatterns";

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

  it("builds boss encounter plans deterministically from the same snapshot", () => {
    const input = {
      mode: "hard" as const,
      round: 10,
      previousFamilyStreak: "lane" as const,
      previousFamilyStreakCount: 1,
      recentPatterns: ["switch_press", "crossfall_mix"] as const,
      recentThemes: [],
      queueSeed: 17,
    };

    const first = buildBossEncounterPlan(input);
    const second = buildBossEncounterPlan(input);

    expect(second).toEqual(first);
    expect(getBossThemeLabel(first.themeId).length).toBeGreaterThan(0);
  });

  it("keeps residue themes gated out before late hard rounds", () => {
    const beforeUnlock = buildBossEncounterPlan({
      mode: "hard",
      round: 9,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: [],
      queueSeed: 39893,
    });
    const afterUnlock = buildBossEncounterPlan({
      mode: "hard",
      round: 10,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: [],
      queueSeed: 39893,
    });

    expect(beforeUnlock.themeId).not.toBe("residue_fakeout");
    expect(afterUnlock.themeId).toBe("residue_fakeout");
  });

  it("keeps normal mode out of hard-only themes and patterns across seeds", () => {
    const results = Array.from({ length: 16 }, (_, index) =>
      buildBossEncounterPlan({
        mode: "normal",
        round: 10,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed: index + 1,
      }),
    );

    expect(results.every((plan) => plan.themeId !== "corridor_switch" && plan.themeId !== "trap_weave" && plan.themeId !== "residue_fakeout")).toBe(true);
    expect(results.every((plan) => plan.queue.every((id) => !isHardOnlyPattern(id)))).toBe(true);
  });

  it("matches the early hard unlock matrix with pressure and lane themes only", () => {
    const seeds = [1, 39893, 177777];
    const results = seeds.map((queueSeed) =>
      buildBossEncounterPlan({
        mode: "hard",
        round: 2,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed,
      }),
    );
    const seenThemes = new Set(results.map((plan) => plan.themeId));
    const heavyIds = ["three_gate_shuffle", "pillar_press", "residue_zone", "residue_switch", "center_collapse", "shoulder_crush", "delayed_burst"];

    expect(seenThemes).toEqual(new Set(["pressure_intro", "lane_intro"]));
    expect(results.every((plan) => plan.queue.every((id) => !heavyIds.includes(id)))).toBe(true);
  });

  it("derives encounter duration from themed composition instead of queue length alone", () => {
    const pressurePlan = buildBossEncounterPlan({
      mode: "hard",
      round: 7,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: [],
      queueSeed: 1,
    });
    const trapPlan = buildBossEncounterPlan({
      mode: "hard",
      round: 10,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: [],
      queueSeed: 39893,
    });

    expect(pressurePlan.queue.length).toBeGreaterThan(0);
    expect(trapPlan.queue.length).toBeGreaterThan(0);
    expect(trapPlan.minEncounterDuration).not.toBe(pressurePlan.queue.length * 2.8 + 1.8);
    expect(trapPlan.minEncounterDuration).not.toBe(pressurePlan.minEncounterDuration);
  });

  it("uses theme composition without double-stacking heavy set pieces", () => {
    const seeds = Array.from({ length: 40 }, (_, index) => index + 1);

    for (const seed of seeds) {
      const plan = buildBossEncounterPlan({
        mode: "hard",
        round: 12,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed: seed,
      });

      for (let index = 0; index < plan.queue.length - 1; index += 1) {
        const current = plan.queue[index];
        const next = plan.queue[index + 1];
        const heavyIds = ["three_gate_shuffle", "pillar_press", "residue_zone", "residue_switch", "center_collapse", "shoulder_crush", "delayed_burst"];
        expect(!(heavyIds.includes(current) && heavyIds.includes(next))).toBe(true);
      }
    }
  });

  it("avoids repeating the last two boss themes when alternatives exist", () => {
    const plan = buildBossEncounterPlan({
      mode: "hard",
      round: 10,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: ["pressure_intro", "lane_intro"],
      queueSeed: 1,
    });

    expect(plan.themeId).not.toBe("pressure_intro");
    expect(plan.themeId).not.toBe("lane_intro");
  });

  it("surfaces more than three boss themes over a representative hard progression", () => {
    const rounds = [2, 4, 6, 8, 10, 12, 14];
    let queueSeed = 17;
    let recentThemes: BossThemeId[] = [];
    const seenThemes = new Set<string>();

    for (const round of rounds) {
      const plan = buildBossEncounterPlan({
        mode: "hard",
        round,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes,
        queueSeed,
      });
      seenThemes.add(plan.themeId);
      recentThemes = [...recentThemes, plan.themeId].slice(-3);
      queueSeed = plan.nextQueueSeed;
    }

    expect(seenThemes.size).toBeGreaterThan(3);
  });
});
