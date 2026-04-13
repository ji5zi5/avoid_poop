import type { GameMode, RunResultPayload } from "../../../shared/src/contracts/index";

export type ItemType = "invincibility" | "speed" | "heal" | "slow" | "clear";
export type ToastTone = "neutral" | "danger" | "reward" | "boss";
export type HazardOwner = "wave" | "boss";
export type HazardVariant = "small" | "medium" | "large" | "boss" | "giant";
export type BossPatternFamily = "pressure" | "lane" | "trap";
export type BossPatternId =
  | "half_stomp_alternating"
  | "closing_doors"
  | "center_crush"
  | "edge_crush"
  | "double_side_stomp"
  | "center_swing"
  | "shifting_corridor"
  | "zigzag_corridor"
  | "staircase_corridor"
  | "center_break"
  | "switch_press"
  | "crossfall_mix"
  | "fake_safe_lane"
  | "residue_zone"
  | "residue_switch"
  | "fake_warning"
  | "center_collapse"
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
};

export type Item = {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  type: ItemType;
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
  bossPatternQueue: BossPatternId[];
  bossPatternIndex: number;
  bossPatternActiveId: BossPatternId | null;
  bossPatternPhase: BossPatternPhase;
  bossPatternStepTimer: number;
  bossPatternShots: number;
  bossPatternSeed: number;
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
  screenShakeTimer: number;
  damageFlashTimer: number;
  gameOver: boolean;
  clear: boolean;
};

export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 520;
export const ROUND_DURATION = 9;
export const BOSS_DURATION = 12;

export function createInitialState(mode: GameMode): GameState {
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
    bossPatternQueue: [],
    bossPatternIndex: 0,
    bossPatternActiveId: null,
    bossPatternPhase: "idle",
    bossPatternStepTimer: 0,
    bossPatternShots: 0,
    bossPatternSeed: mode === "hard" ? 17 : 11,
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
