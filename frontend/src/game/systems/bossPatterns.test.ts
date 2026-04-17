import { describe, expect, it } from "vitest";

import type { BossThemeId } from "../state";
import { createGameEngine } from "../engine";
import { buildBossEncounterPlan, buildBossPatternQueue, getAvailableBossPatternIds, getBossThemeLabel, getUnlockedBossThemeIds, isHardOnlyPattern } from "./bossPatterns";

describe("boss patterns", () => {
  it("exposes a larger hard-mode boss pattern pool", () => {
    expect(getAvailableBossPatternIds("hard")).toHaveLength(57);
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

  it("allows residue themes in hard mode from the opening boss pool", () => {
    const plan = buildBossEncounterPlan({
      mode: "hard",
      round: 2,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: [],
      queueSeed: 29659,
    });

    expect(plan.themeId).toBe("residue_fakeout");
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

  it("exposes every hard boss theme from the start across representative seeds", () => {
    const seeds = [1, 4944, 9887, 14830, 19773, 24716, 29659, 34602, 39545];
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
    expect(seenThemes).toEqual(new Set([
      "pressure_intro",
      "lane_intro",
      "corridor_intro",
      "trap_intro",
      "corridor_switch",
      "trap_weave",
      "residue_fakeout",
      "lane_gauntlet",
      "residue_storm",
    ]));
  });

  it("unlocks at least twenty-six hard boss themes by round 12", () => {
    expect(getUnlockedBossThemeIds("hard", 12)).toHaveLength(26);
  });

  it("unlocks nightmare-only boss themes in nightmare mode", () => {
    expect(getUnlockedBossThemeIds("nightmare", 12)).toEqual(
      expect.arrayContaining(["arc_storm", "rebound_labyrinth", "arc_pressure", "recoil_pivot"]),
    );
  });

  it("surfaces nightmare-only themes over a representative nightmare progression", () => {
    const rounds = [4, 6, 8, 10, 12, 14];
    let queueSeed = 17;
    let recentThemes: BossThemeId[] = [];
    const seenThemes = new Set<string>();

    for (const round of rounds) {
      const plan = buildBossEncounterPlan({
        mode: "nightmare",
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

    expect(
      seenThemes.has("arc_storm")
      || seenThemes.has("rebound_labyrinth")
      || seenThemes.has("arc_pressure")
      || seenThemes.has("recoil_pivot"),
    ).toBe(true);
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

  it("surfaces at least six boss themes over a representative hard progression", () => {
    const rounds = [2, 4, 6, 8, 10, 12, 14, 16];
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

    expect(seenThemes.size).toBeGreaterThanOrEqual(6);
  });

  it("surfaces at least ten unique hard themes across representative round-12 seeds", () => {
    const seeds = [1, 4944, 9887, 14830, 19773, 24716, 29659, 34602, 39545, 44488, 49431, 54374];
    const seenThemes = new Set(
      seeds.map((queueSeed) =>
        buildBossEncounterPlan({
          mode: "hard",
          round: 12,
          previousFamilyStreak: null,
          previousFamilyStreakCount: 0,
          recentPatterns: [],
          recentThemes: [],
          queueSeed,
        }).themeId,
      ),
    );

    expect(seenThemes.size).toBeGreaterThanOrEqual(10);
  });

  it("keeps residue_fakeout queues varied across seeds", () => {
    const queues = new Set(
      [29659, 31234, 38133, 39545].map((queueSeed) =>
        buildBossEncounterPlan({
          mode: "hard",
          round: 12,
          previousFamilyStreak: null,
          previousFamilyStreakCount: 0,
          recentPatterns: [],
          recentThemes: [],
          queueSeed,
        }).queue.join("|"),
      ),
    );

    expect(queues.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps lane and intro themes varied across seeds inside the same theme", () => {
    const laneQueues = new Set(
      [4944, 4945, 4946].map((queueSeed) =>
        buildBossEncounterPlan({
          mode: "hard",
          round: 12,
          previousFamilyStreak: null,
          previousFamilyStreakCount: 0,
          recentPatterns: [],
          recentThemes: [],
          queueSeed,
        }).queue.join("|"),
      ),
    );
    const corridorQueues = new Set(
      [9887, 9888, 9889].map((queueSeed) =>
        buildBossEncounterPlan({
          mode: "hard",
          round: 12,
          previousFamilyStreak: null,
          previousFamilyStreakCount: 0,
          recentPatterns: [],
          recentThemes: [],
          queueSeed,
        }).queue.join("|"),
      ),
    );
    const trapIntroQueues = new Set(
      [14830, 14831, 14832].map((queueSeed) =>
        buildBossEncounterPlan({
          mode: "hard",
          round: 12,
          previousFamilyStreak: null,
          previousFamilyStreakCount: 0,
          recentPatterns: [],
          recentThemes: [],
          queueSeed,
        }).queue.join("|"),
      ),
    );

    expect(laneQueues.size).toBeGreaterThanOrEqual(3);
    expect(corridorQueues.size).toBeGreaterThanOrEqual(3);
    expect(trapIntroQueues.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps lane and trap queues diverse across representative round-12 seeds", () => {
    const seeds = [1, 4944, 9887, 14830, 19773, 24716, 29659, 34602, 39545, 44488, 49431, 54374, 59317, 64260, 69203, 74146, 79089, 84032, 88975, 93918];
    const laneThemeIds = new Set([
      "lane_intro",
      "corridor_intro",
      "pressure_bridge",
      "edge_rotation",
      "corridor_switch",
      "snapback_lite",
      "rotor_gauntlet",
      "delayed_denial",
      "shock_corridor",
      "folding_rush",
      "forced_cross",
      "rush_detour",
      "glide_duet",
      "tracker_feint",
      "mirror_pursuit",
      "split_timer",
      "snake_pressure",
      "lane_gauntlet",
      "split_crucible",
    ]);
    const trapThemeIds = new Set([
      "trap_intro",
      "trap_weave",
      "fakeout_chain",
      "tracker_feint",
      "mirror_pursuit",
      "split_timer",
      "residue_fakeout",
      "residue_storm",
      "residue_denial",
      "forced_cross",
      "split_crucible",
    ]);
    const laneQueues = new Set<string>();
    const trapQueues = new Set<string>();

    for (const queueSeed of seeds) {
      const plan = buildBossEncounterPlan({
        mode: "hard",
        round: 12,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed,
      });

      const queueSignature = `${plan.themeId}:${plan.queue.join("|")}`;
      if (laneThemeIds.has(plan.themeId)) {
        laneQueues.add(queueSignature);
      }
      if (trapThemeIds.has(plan.themeId)) {
        trapQueues.add(queueSignature);
      }
    }

    expect(laneQueues.size).toBeGreaterThanOrEqual(4);
    expect(trapQueues.size).toBeGreaterThanOrEqual(4);
  });

  it("surfaces newly added atomic patterns across representative hard queues", () => {
    const seeds = [4944, 9887, 14830, 19773, 24716, 29659, 34602, 39545, 44488, 49431, 54374, 59317, 64260, 69203];
    const seenPatterns = new Set(
      seeds.flatMap((queueSeed) =>
        buildBossEncounterPlan({
          mode: "hard",
          round: 12,
          previousFamilyStreak: null,
          previousFamilyStreakCount: 0,
          recentPatterns: [],
          recentThemes: [],
          queueSeed,
        }).queue,
      ),
    );

    const newlyAddedPatterns = [
      "wing_press",
      "pillar_slide",
      "lane_flipback",
      "center_lane_weave",
      "mirror_dive",
      "glider_cross",
      "glider_stack",
      "rotor_gate",
      "delayed_drop",
      "shockwave_burst",
      "folding_corridor",
      "tracker_drop",
      "mirror_counter",
      "delayed_splitter",
      "snake_wave",
      "safe_third_flip",
      "residue_pivot",
      "shatter_lane",
      "split_rebound",
      "wall_bounce_glider",
      "rotobounce_mix",
      "layered_barrage",
      "bait_seal",
    ] as const;

    expect(newlyAddedPatterns.filter((id) => seenPatterns.has(id)).length).toBeGreaterThanOrEqual(4);
  });

  it("replaces lane_intro's old three-big-hit finisher with non-swing finishers", () => {
    const seeds = [3708, 3709, 3710, 3711, 3712, 3713];

    for (const queueSeed of seeds) {
      const plan = buildBossEncounterPlan({
        mode: "hard",
        round: 7,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed,
      });

      expect(plan.themeId).toBe("lane_intro");
      expect(plan.queue).not.toContain("center_swing");
      expect(plan.queue.some((id) => id === "mirror_dive" || id === "door_jam")).toBe(true);
    }
  });

  it("surfaces the new trajectory-based patterns in representative hard fixtures", () => {
    const cases = [
      { round: 8, queueSeed: 15889, patternId: "diagonal_rain" },
      { round: 8, queueSeed: 12713, patternId: "cross_arc" },
      { round: 8, queueSeed: 12711, patternId: "fan_arc" },
      { round: 8, queueSeed: 28603, patternId: "bounce_drive" },
      { round: 8, queueSeed: 19067, patternId: "glider_cross" },
      { round: 8, queueSeed: 28601, patternId: "split_rebound" },
      { round: 12, queueSeed: 13689, patternId: "rotor_gate" },
      { round: 12, queueSeed: 15400, patternId: "delayed_drop" },
      { round: 12, queueSeed: 17111, patternId: "shockwave_burst" },
      { round: 12, queueSeed: 17111, patternId: "folding_corridor" },
      { round: 12, queueSeed: 15400, patternId: "tracker_drop" },
      { round: 12, queueSeed: 15400, patternId: "mirror_counter" },
      { round: 12, queueSeed: 15400, patternId: "delayed_splitter" },
      { round: 12, queueSeed: 18822, patternId: "snake_wave" },
      { round: 12, queueSeed: 27378, patternId: "bait_seal" },
    ] as const;

    for (const { round, queueSeed, patternId } of cases) {
      const plan = buildBossEncounterPlan({
        mode: "hard",
        round,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed,
      });

      expect(plan.queue).toContain(patternId);
    }
  });

  it("surfaces nightmare-only advanced patterns in representative nightmare fixtures", () => {
    const cases = [
      { round: 12, queueSeed: 24747, patternId: "glider_stack" },
      { round: 12, queueSeed: 36068, patternId: "wall_bounce_glider" },
      { round: 12, queueSeed: 40278, patternId: "layered_barrage" },
    ] as const;

    for (const { round, queueSeed, patternId } of cases) {
      const plan = buildBossEncounterPlan({
        mode: "nightmare",
        round,
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
        recentPatterns: [],
        recentThemes: [],
        queueSeed,
      });

      expect(plan.queue).toContain(patternId);
    }
  });
});
