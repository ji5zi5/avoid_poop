import type {RoomOptions} from './multiplayer.schemas.js';

export type MultiplayerPhase = 'wave' | 'boss' | 'complete';
export type MultiplayerPlayerStatus = 'alive' | 'spectator' | 'disconnected';
export type MultiplayerDebuffType = 'slow' | 'reverse' | 'input_delay' | 'vision_jam' | 'item_lock';

export type MultiplayerActiveDebuff = {
  expiresAt: number;
  type: MultiplayerDebuffType;
};

export type MultiplayerPlayerState = {
  activeDebuffs: MultiplayerActiveDebuff[];
  direction: -1 | 0 | 1;
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
  height: number;
  id: number;
  owner: 'wave' | 'boss';
  speed: number;
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
  elapsedInPhase: number;
  hazards: MultiplayerHazardState[];
  items: MultiplayerItemState[];
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
  winnerUserId: number | null;
};
