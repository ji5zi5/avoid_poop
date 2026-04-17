import type { GameMode, RunResultPayload } from "../../../shared/src/contracts/index.js";
import { createSharedWaveDirector } from "../../../shared/src/index.js";

export type ItemType = "invincibility" | "speed" | "heal" | "slow" | "clear";
export type ToastTone = "neutral" | "danger" | "reward" | "boss";
export type HazardOwner = "wave" | "boss";
export type HazardVariant = "small" | "medium" | "large" | "boss" | "giant";
export type HazardBehavior = "none" | "split" | "bounce";
export type WavePattern = "single" | "cluster_2" | "cluster_3" | "splitter" | "bouncer";
export type BossPatternFamily = "pressure" | "lane" | "trap";
export type BossThemeId =
  | "pressure_intro"
  | "lane_intro"
  | "corridor_intro"
  | "trap_intro"
  | "pressure_bridge"
  | "edge_rotation"
  | "corridor_switch"
  | "snapback_lite"
  | "trap_weave"
  | "fakeout_chain"
  | "residue_fakeout"
  | "forced_cross"
  | "lane_gauntlet"
  | "residue_storm"
  | "residue_denial"
  | "arc_storm"
  | "rebound_labyrinth";
export type BossPatternId =
  | "half_stomp_alternating"
  | "closing_doors"
  | "center_crush"
  | "edge_crush"
  | "double_side_stomp"
  | "center_swing"
  | "door_jam"
  | "wing_press"
  | "three_gate_shuffle"
  | "pillar_press"
  | "pillar_slide"
  | "shifting_corridor"
  | "zigzag_corridor"
  | "staircase_corridor"
  | "center_break"
  | "edge_tunnel"
  | "switch_press"
  | "crossfall_mix"
  | "lane_flipback"
  | "center_lane_weave"
  | "diagonal_rain"
  | "cross_arc"
  | "fan_arc"
  | "bounce_drive"
  | "corridor_snapback"
  | "lane_pincer"
  | "fake_safe_lane"
  | "funnel_switch"
  | "aftershock_lane"
  | "safe_third_flip"
  | "residue_zone"
  | "residue_switch"
  | "residue_crossfire"
  | "residue_pivot"
  | "fake_warning"
  | "corridor_fakeout"
  | "center_collapse"
  | "shoulder_crush"
  | "delayed_burst"
  | "last_hit_followup";
export type BossPatternPhase = "idle" | "telegraph" | "attack" | "cooldown";

export type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  lives: number;
};

export type Hazard = {
  id: number;
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
  speed: number;
  owner: HazardOwner;
  variant: HazardVariant;
  behavior?: HazardBehavior;
  velocityX?: number;
  gravity?: number;
  splitAtY?: number;
  splitChildCount?: number;
  splitChildSize?: number;
  splitChildSpeed?: number;
  splitChildSpread?: number;
  bouncesRemaining?: number;
  triggered?: boolean;
  awardOnExit?: boolean;
  pendingRemoval?: boolean;
};

export type Item = {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  type: ItemType;
};

export type WaveDirector = {
  seed: number;
  patternCursor: number;
  recentPatterns: WavePattern[];
  specialCooldown: number;
  roundBudget: number;
  clusterQuota: number;
  tripleQuota: number;
  splitterQuota: number;
  bounceQuota: number;
  roundBand: number;
  round: number;
};

export type GameState = {
  mode: GameMode;
  width: number;
  height: number;
  player: Player;
  hazards: Hazard[];
  items: Item[];
  score: number;
  round: number;
  reachedRound: number;
  survivalTime: number;
  elapsedInPhase: number;
  currentPhase: "wave" | "boss";
  pendingBossClearAnnouncement: boolean;
  nextHazardId: number;
  nextItemId: number;
  spawnTimer: number;
  itemTimer: number;
  itemSeed: number;
  bossPatternTimer: number;
  bossEncounterDuration: number;
  bossThemeId: BossThemeId | null;
  bossPatternQueue: BossPatternId[];
  bossPatternIndex: number;
  bossPatternActiveId: BossPatternId | null;
  bossPatternPhase: BossPatternPhase;
  bossPatternStepTimer: number;
  bossPatternShots: number;
  bossPatternSeed: number;
  bossRecentThemes: BossThemeId[];
  bossPatternFamilyStreak: BossPatternFamily | null;
  bossPatternFamilyStreakCount: number;
  bossRecentPatterns: BossPatternId[];
  bossTelegraphTimer: number;
  bossTelegraphText: string;
  invincibilityTimer: number;
  speedBoostTimer: number;
  slowMotionTimer: number;
  phaseAnnouncementTimer: number;
  phaseAnnouncementText: string;
  itemToastTimer: number;
  itemToastText: string;
  itemToastTone: ToastTone;
  effectBurstTimer: number;
  effectBurstType: ItemType | null;
  waveDirector: WaveDirector;
  screenShakeTimer: number;
  damageFlashTimer: number;
  gameOver: boolean;
  clear: boolean;
};

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 520;
export const ROUND_DURATION = 9;
export const BOSS_DURATION = 12;
const MAX_RUN_SEED = 2147483646;

function createRunSeed() {
  return Math.floor(Math.random() * MAX_RUN_SEED) + 1;
}

function createDerivedSeed(seed: number, salt: number) {
  return Math.max(1, ((seed * 48271) + salt) % MAX_RUN_SEED);
}

export function createWaveDirector(mode: GameMode, round: number, seed = createRunSeed()): WaveDirector {
  return createSharedWaveDirector(mode, round, seed);
}

export function createInitialState(
  mode: GameMode,
  seedOverrides?: {
    waveSeed?: number;
    bossSeed?: number;
  },
): GameState {
  const waveSeed = seedOverrides?.waveSeed ?? createRunSeed();
  return {
    mode,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    player: {
      x: GAME_WIDTH / 2 - 18,
      y: GAME_HEIGHT - 56,
      width: 36,
      height: 24,
      speed: 210,
      lives: 3,
    },
    hazards: [],
    items: [],
    score: 0,
    round: 1,
    reachedRound: 1,
    survivalTime: 0,
    elapsedInPhase: 0,
    currentPhase: "wave",
    pendingBossClearAnnouncement: false,
    nextHazardId: 1,
    nextItemId: 1,
    spawnTimer: 0,
    itemTimer: 0,
    itemSeed: createDerivedSeed(waveSeed, 7919),
    bossPatternTimer: 0,
    bossEncounterDuration: BOSS_DURATION,
    bossThemeId: null,
    bossPatternQueue: [],
    bossPatternIndex: 0,
    bossPatternActiveId: null,
    bossPatternPhase: "idle",
    bossPatternStepTimer: 0,
    bossPatternShots: 0,
    bossPatternSeed: seedOverrides?.bossSeed ?? createRunSeed(),
    bossRecentThemes: [],
    bossPatternFamilyStreak: null,
    bossPatternFamilyStreakCount: 0,
    bossRecentPatterns: [],
    bossTelegraphTimer: 0,
    bossTelegraphText: "",
    invincibilityTimer: 0,
    speedBoostTimer: 0,
    slowMotionTimer: 0,
    phaseAnnouncementTimer: 0,
    phaseAnnouncementText: "",
    itemToastTimer: 0,
    itemToastText: "",
    itemToastTone: "neutral",
    effectBurstTimer: 0,
    effectBurstType: null,
    waveDirector: createWaveDirector(mode, 1, waveSeed),
    screenShakeTimer: 0,
    damageFlashTimer: 0,
    gameOver: false,
    clear: false,
  };
}

export function toRunResult(state: GameState): RunResultPayload {
  return {
    mode: state.mode,
    score: Math.round(state.score),
    reachedRound: state.reachedRound,
    survivalTime: Number(state.survivalTime.toFixed(2)),
    clear: state.clear,
  };
}
