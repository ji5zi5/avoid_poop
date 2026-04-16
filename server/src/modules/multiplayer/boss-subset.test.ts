import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMultiplayerBossSubsetPlan } from './boss-subset.js';

const fixtures = [
  {
    mode: 'hard' as const,
    round: 2,
    queueSeed: 4004,
    expectedThemeId: 'pressure_intro',
    expectedQueue: ['half_stomp_alternating', 'door_jam', 'center_crush', 'door_jam', 'center_crush'],
  },
  {
    mode: 'hard' as const,
    round: 4,
    queueSeed: 5005,
    expectedThemeId: 'lane_intro',
    expectedQueue: ['edge_tunnel', 'crossfall_mix', 'zigzag_corridor', 'center_swing'],
  },
  {
    mode: 'hard' as const,
    round: 7,
    queueSeed: 6006,
    expectedThemeId: 'lane_intro',
    expectedQueue: ['edge_tunnel', 'switch_press', 'staircase_corridor', 'center_swing'],
  },
];

test('boss subset plan stays inside the approved fixed subset for fixture seeds', () => {
  for (const fixture of fixtures) {
    const plan = buildMultiplayerBossSubsetPlan({
      mode: fixture.mode,
      round: fixture.round,
      previousFamilyStreak: null,
      previousFamilyStreakCount: 0,
      recentPatterns: [],
      recentThemes: [],
      queueSeed: fixture.queueSeed,
    });

    assert.equal(plan.themeId, fixture.expectedThemeId);
    assert.deepEqual(plan.queue, fixture.expectedQueue);
    assert.ok(plan.nextQueueSeed > 0);
    assert.ok(plan.minEncounterDuration > 0);
  }
});
