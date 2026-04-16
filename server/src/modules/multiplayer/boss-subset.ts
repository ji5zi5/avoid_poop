import type { BossEncounterBuilderInput, BossEncounterPlan } from '../../../../frontend/src/game/systems/bossPatterns.js';
import { buildBossEncounterPlan, getBossThemeLabel } from '../../../../frontend/src/game/systems/bossPatterns.js';

const ALLOWED_THEMES = new Set([
  'pressure_intro',
  'lane_intro',
  'corridor_intro',
]);

const ALLOWED_PATTERNS = new Set([
  'half_stomp_alternating',
  'closing_doors',
  'center_crush',
  'double_side_stomp',
  'door_jam',
  'zigzag_corridor',
  'edge_tunnel',
  'staircase_corridor',
  'switch_press',
  'crossfall_mix',
  'center_swing',
  'shifting_corridor',
  'center_break',
  'last_hit_followup',
]);

function advanceSeed(seed: number) {
  const nextQueueSeed = (seed * 48271) % 2147483647;
  return nextQueueSeed;
}

export function buildMultiplayerBossSubsetPlan(input: BossEncounterBuilderInput): BossEncounterPlan {
  let workingSeed = input.queueSeed;

  for (let attempt = 0; attempt < 256; attempt += 1) {
    const plan = buildBossEncounterPlan({ ...input, queueSeed: workingSeed });
    if (ALLOWED_THEMES.has(plan.themeId) && plan.queue.every((pattern) => ALLOWED_PATTERNS.has(pattern))) {
      return plan;
    }
    workingSeed = advanceSeed(workingSeed);
  }

  throw new Error(`Unable to build allowed multiplayer boss subset for seed ${input.queueSeed}`);
}

export function getMultiplayerBossThemeLabel(themeId: string | null) {
  return getBossThemeLabel(themeId as Parameters<typeof getBossThemeLabel>[0]);
}
