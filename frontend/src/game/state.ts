import type { GameMode, RunResultPayload } from "../../../shared/src/contracts/index";

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
  | "corridor_switch"
  | "trap_weave"
  | "residue_fakeout"
  | "lane_gauntlet"
  | "residue_storm";
export type BossPatternId =
  | "half_stomp_alternating"
  | "closing_doors"
  | "center_crush"
  | "edge_crush"
  | "double_side_stomp"
  | "center_swing"
  | "door_jam"
  | "three_gate_shuffle"
  | "pillar_press"
  | "shifting_corridor"
  | "zigzag_corridor"
  | "staircase_corridor"
  | "center_break"
  | "edge_tunnel"
  | "switch_press"
  | "crossfall_mix"
  | "corridor_snapback"
  | "lane_pincer"
  | "fake_safe_lane"
  | "funnel_switch"
  | "aftershock_lane"
  | "residue_zone"
  | "residue_switch"
  | "residue_crossfire"
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

function getWaveRoundBand(mode: GameMode, round: number) {
  if (mode === "hard") {
    if (round >= 10) {
      return 3;
    }
    if (round >= 7) {
      return 2;
    }
    if (round >= 4) {
      return 1;
    }
    return 0;
  }

  if (round >= 10) {
    return 3;
  }
  if (round >= 7) {
    return 2;
  }
  if (round >= 4) {
    return 1;
  }
  return 0;
}

export function createWaveDirector(mode: GameMode, round: number, seed = createRunSeed()): WaveDirector {
  const roundBand = getWaveRoundBand(mode, round);
  return {
    seed,
    patternCursor: 0,
    recentPatterns: [],
    specialCooldown: 0,
    roundBudget: mode === "hard"
      ? roundBand >= 3 ? 4 : roundBand >= 2 ? 3 : roundBand >= 1 ? 2 : 1
      : roundBand >= 3 ? 3 : roundBand >= 2 ? 2 : 1,
    clusterQuota: mode === "hard"
      ? roundBand >= 3 ? 3 : roundBand >= 1 ? 2 : 1
      : roundBand >= 2 ? 2 : 1,
    tripleQuota: mode === "hard"
      ? roundBand >= 2 ? 1 : 0
      : roundBand >= 3 ? 1 : 0,
    splitterQuota: mode === "hard"
      ? roundBand >= 2 ? 2 : roundBand >= 1 ? 1 : 0
      : roundBand >= 2 ? 1 : 0,
    bounceQuota: mode === "hard"
      ? roundBand >= 2 ? 2 : roundBand >= 1 ? 1 : 0
      : roundBand >= 2 ? 1 : 0,
    roundBand,
    round,
  };
}

export function createInitialState(
  mode: GameMode,
  seedOverrides?: {
    waveSeed?: number;
    bossSeed?: number;
  },
): GameState {
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
    waveDirector: createWaveDirector(mode, 1, seedOverrides?.waveSeed),
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
