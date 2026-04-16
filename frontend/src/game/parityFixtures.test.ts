import { describe, expect, it } from "vitest";

import { createWaveDirector } from "./state.js";
import { selectWavePattern } from "./systems/spawn.js";
import { buildBossEncounterPlan } from "./systems/bossPatterns.js";
import { buildWaveSpawnSpecs, createSharedWaveDirector, evolveSupportedHazards } from "../../../shared/src/index.js";

const parityFixtureMatrix = [
  {
    mode: "normal" as const,
    round: 2,
    waveSeed: 101,
    bossSeed: 1001,
    expectedWave: {
      pattern: "single",
      nextSeed: 4_875_371,
      recentPatterns: ["single"],
      roundBudget: 1,
      clusterQuota: 1,
      tripleQuota: 0,
      splitterQuota: 0,
      bounceQuota: 0,
    },
    expectedBoss: {
      themeId: "pressure_intro",
      queue: ["half_stomp_alternating", "door_jam", "center_crush"],
      nextQueueSeed: 1_079_944_513,
      minEncounterDuration: 5.6,
    },
  },
  {
    mode: "normal" as const,
    round: 4,
    waveSeed: 202,
    bossSeed: 2002,
    expectedWave: {
      pattern: "single",
      nextSeed: 9_750_742,
      recentPatterns: ["single"],
      roundBudget: 1,
      clusterQuota: 1,
      tripleQuota: 0,
      splitterQuota: 0,
      bounceQuota: 0,
    },
    expectedBoss: {
      themeId: "pressure_intro",
      queue: ["half_stomp_alternating", "door_jam", "center_crush"],
      nextQueueSeed: 12_405_379,
      minEncounterDuration: 5.6,
    },
  },
  {
    mode: "normal" as const,
    round: 7,
    waveSeed: 303,
    bossSeed: 3003,
    expectedWave: {
      pattern: "single",
      nextSeed: 14_626_113,
      recentPatterns: ["single"],
      roundBudget: 2,
      clusterQuota: 2,
      tripleQuota: 0,
      splitterQuota: 1,
      bounceQuota: 1,
    },
    expectedBoss: {
      themeId: "pressure_intro",
      queue: ["half_stomp_alternating", "door_jam", "center_crush"],
      nextQueueSeed: 1_092_349_892,
      minEncounterDuration: 5.6,
    },
  },
  {
    mode: "hard" as const,
    round: 2,
    waveSeed: 404,
    bossSeed: 4004,
    expectedWave: {
      pattern: "single",
      nextSeed: 19_501_484,
      recentPatterns: ["single"],
      roundBudget: 1,
      clusterQuota: 1,
      tripleQuota: 0,
      splitterQuota: 0,
      bounceQuota: 0,
    },
    expectedBoss: {
      themeId: "pressure_intro",
      queue: ["half_stomp_alternating", "door_jam", "center_crush", "door_jam", "center_crush"],
      nextQueueSeed: 1_112_066_659,
      minEncounterDuration: 9.09,
    },
  },
  {
    mode: "hard" as const,
    round: 4,
    waveSeed: 505,
    bossSeed: 5005,
    expectedWave: {
      pattern: "single",
      nextSeed: 24_376_855,
      recentPatterns: ["single"],
      roundBudget: 2,
      clusterQuota: 2,
      tripleQuota: 0,
      splitterQuota: 1,
      bounceQuota: 1,
    },
    expectedBoss: {
      themeId: "lane_intro",
      queue: ["edge_tunnel", "crossfall_mix", "zigzag_corridor", "center_swing"],
      nextQueueSeed: 1_327_764_137,
      minEncounterDuration: 7.24,
    },
  },
  {
    mode: "hard" as const,
    round: 7,
    waveSeed: 606,
    bossSeed: 6006,
    expectedWave: {
      pattern: "single",
      nextSeed: 29_252_226,
      recentPatterns: ["single"],
      roundBudget: 3,
      clusterQuota: 2,
      tripleQuota: 1,
      splitterQuota: 2,
      bounceQuota: 2,
    },
    expectedBoss: {
      themeId: "lane_intro",
      queue: ["edge_tunnel", "switch_press", "staircase_corridor", "center_swing"],
      nextQueueSeed: 1_163_820_235,
      minEncounterDuration: 7.04,
    },
  },
];

describe("multiplayer single-parity fixture matrix", () => {
  it("locks the approved wave selector traces for the fixture matrix", () => {
    for (const fixture of parityFixtureMatrix) {
      const director = createWaveDirector(fixture.mode, fixture.round, fixture.waveSeed);
      const selection = selectWavePattern(director, fixture.mode, fixture.round);

      expect({
        pattern: selection.pattern,
        nextSeed: selection.nextDirector.seed,
        recentPatterns: selection.nextDirector.recentPatterns,
        roundBudget: selection.nextDirector.roundBudget,
        clusterQuota: selection.nextDirector.clusterQuota,
        tripleQuota: selection.nextDirector.tripleQuota,
        splitterQuota: selection.nextDirector.splitterQuota,
        bounceQuota: selection.nextDirector.bounceQuota,
      }).toEqual(fixture.expectedWave);
    }
  });

  it("locks the approved boss queue/theme traces for the fixture matrix", () => {
    for (const fixture of parityFixtureMatrix) {
      const encounterPlan = buildBossEncounterPlan({
        mode: fixture.mode,
        round: fixture.round,
        queueSeed: fixture.bossSeed,
        recentPatterns: [],
        recentThemes: [],
        previousFamilyStreak: null,
        previousFamilyStreakCount: 0,
      });

      expect({
        themeId: encounterPlan.themeId,
        queue: encounterPlan.queue,
        nextQueueSeed: encounterPlan.nextQueueSeed,
        minEncounterDuration: Number(encounterPlan.minEncounterDuration.toFixed(2)),
      }).toEqual(fixture.expectedBoss);
    }
  });

  it("locks one supported shared wave spawn fixture directly", () => {
    const selection = buildWaveSpawnSpecs({
      director: createSharedWaveDirector("hard", 4, 505),
      mode: "hard",
      round: 4,
      width: 360,
      height: 520,
      nextHazardId: 1,
    });

    expect(selection).toEqual({
      pattern: "single",
      nextDirector: {
        seed: 2021612796,
        patternCursor: 1,
        recentPatterns: ["single"],
        specialCooldown: 0,
        roundBudget: 2,
        clusterQuota: 2,
        tripleQuota: 0,
        splitterQuota: 1,
        bounceQuota: 1,
        roundBand: 1,
        round: 4,
      },
      hazards: [
        {
          x: 323,
          size: 16,
          speed: 224,
          owner: "wave",
          variant: "small",
        },
      ],
    });
  });

  it("locks split evolution output for the supported shared hazard core", () => {
    const evolved = evolveSupportedHazards(
      [
        {
          id: 1,
          owner: "wave",
          x: 120,
          y: 140,
          size: 24,
          width: 24,
          height: 24,
          speed: 180,
          variant: "large",
          behavior: "split",
          splitAtY: 150,
          splitChildCount: 3,
          splitChildSize: 14,
          splitChildSpeed: 170,
          splitChildSpread: 72,
        },
      ],
      360,
      520,
      0.1,
      "hard",
    );

    expect(evolved).toEqual([
      {
        id: 1,
        owner: "wave",
        x: 111.7,
        y: 152.4,
        size: 14,
        width: 14,
        height: 14,
        speed: 170,
        variant: "small",
        velocityX: -72,
        gravity: 220,
        behavior: undefined,
        triggered: undefined,
        pendingRemoval: undefined,
        splitAtY: undefined,
        splitChildCount: undefined,
        splitChildSize: undefined,
        splitChildSpeed: undefined,
        splitChildSpread: undefined,
        bouncesRemaining: undefined,
      },
      {
        id: 1,
        owner: "wave",
        x: 125,
        y: 152.4,
        size: 14,
        width: 14,
        height: 14,
        speed: 170,
        variant: "small",
        velocityX: 0,
        gravity: 220,
        behavior: undefined,
        triggered: undefined,
        pendingRemoval: undefined,
        splitAtY: undefined,
        splitChildCount: undefined,
        splitChildSize: undefined,
        splitChildSpeed: undefined,
        splitChildSpread: undefined,
        bouncesRemaining: undefined,
      },
      {
        id: 1,
        owner: "wave",
        x: 138.3,
        y: 152.4,
        size: 14,
        width: 14,
        height: 14,
        speed: 170,
        variant: "small",
        velocityX: 72,
        gravity: 220,
        behavior: undefined,
        triggered: undefined,
        pendingRemoval: undefined,
        splitAtY: undefined,
        splitChildCount: undefined,
        splitChildSize: undefined,
        splitChildSpeed: undefined,
        splitChildSpread: undefined,
        bouncesRemaining: undefined,
      },
    ]);
  });

  it("locks normal bounce evolution to the same lateral rebound used by single-player", () => {
    const evolved = evolveSupportedHazards(
      [
        {
          id: 1,
          owner: "wave",
          x: 80,
          y: 460,
          size: 18,
          width: 18,
          height: 18,
          speed: 180,
          variant: "small",
          behavior: "bounce",
          bouncesRemaining: 1,
        },
      ],
      360,
      520,
      0.2,
      "normal",
    );

    expect(evolved[0]?.velocityX).toBe(74);
  });
});
