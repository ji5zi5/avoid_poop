import type { GameMode } from '../../../../shared/src/contracts/index.js';
import type {RoomOptions} from './multiplayer.schemas.js';
import type { SharedHazardBehavior, SharedHazardVariant, SharedWaveDirector } from '../../../../shared/src/index.js';

export type MultiplayerPhase = 'wave' | 'boss' | 'complete';
export type MultiplayerPlayerStatus = 'alive' | 'spectator' | 'disconnected';
export type MultiplayerDebuffType = 'slow' | 'reverse' | 'input_delay' | 'vision_jam' | 'item_lock';

export type MultiplayerActiveDebuff = {
  expiresAt: number;
  type: MultiplayerDebuffType;
};

export type MultiplayerPlayerState = {
  activeDebuffs: MultiplayerActiveDebuff[];
  airborneUntil: number | null;
  direction: -1 | 0 | 1;
  queuedDirection: -1 | 0 | 1;
  queuedDirectionAt: number | null;
  disconnectDeadlineAt: number | null;
  height: number;
  lives: number;
  status: MultiplayerPlayerStatus;
  userId: number;
  username: string;
  width: number;
  x: number;
  y: number;
};

export type MultiplayerHazardState = {
  behavior?: SharedHazardBehavior;
  bouncesRemaining?: number;
  gravity?: number;
  height: number;
  id: number;
  owner: 'wave' | 'boss';
  pendingRemoval?: boolean;
  speed: number;
  splitAtY?: number;
  splitChildCount?: number;
  splitChildSize?: number;
  splitChildSpeed?: number;
  splitChildSpread?: number;
  triggered?: boolean;
  variant: SharedHazardVariant;
  velocityX?: number;
  width: number;
  x: number;
  y: number;
};

export type MultiplayerItemState = {
  height: number;
  id: number;
  type: 'debuff';
  width: number;
  x: number;
  y: number;
};

export type MultiplayerGameState = {
  bossEncounterDuration: number;
  bossPatternActiveId: string | null;
  bossPatternFamilyStreak: 'pressure' | 'lane' | 'trap' | null;
  bossPatternFamilyStreakCount: number;
  bossPatternIndex: number;
  bossPatternPhase: 'idle' | 'telegraph' | 'attack' | 'cooldown';
  bossRecentPatterns: string[];
  bossRecentThemes: string[];
  bossPatternQueue: string[];
  bossPatternTimer: number;
  bossPatternSeed: number;
  bossPatternShots: number;
  bossPatternStepTimer: number;
  bossTelegraphText: string;
  bossTelegraphTimer: number;
  bossThemeId: string | null;
  bossThemeLabel: string;
  elapsedInPhase: number;
  hazards: MultiplayerHazardState[];
  height: number;
  items: MultiplayerItemState[];
  mode: GameMode;
  nextHazardId: number;
  nextItemId: number;
  itemSpawnTimer: number;
  options: RoomOptions;
  phase: MultiplayerPhase;
  players: MultiplayerPlayerState[];
  placementOrder: number[];
  roomCode: string;
  round: number;
  spawnTimer: number;
  startedAt: number;
  width: number;
  waveDirector: SharedWaveDirector;
  winnerUserId: number | null;
};
