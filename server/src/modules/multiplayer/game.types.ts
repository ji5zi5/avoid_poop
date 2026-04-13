import type {RoomOptions} from './multiplayer.schemas.js';

export type MultiplayerPhase = 'wave' | 'boss' | 'complete';
export type MultiplayerPlayerStatus = 'alive' | 'spectator' | 'disconnected';

export type MultiplayerPlayerState = {
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

export type MultiplayerGameState = {
  elapsedInPhase: number;
  hazards: MultiplayerHazardState[];
  nextHazardId: number;
  options: RoomOptions;
  phase: MultiplayerPhase;
  players: MultiplayerPlayerState[];
  roomCode: string;
  round: number;
  spawnTimer: number;
  startedAt: number;
  winnerUserId: number | null;
};
