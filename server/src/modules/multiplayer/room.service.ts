import {
  ROOM_MAX_PLAYERS,
  defaultRoomOptions,
  type LobbyPlayer,
  type RoomOptions,
  type RoomOptionsPatch,
  type RoomSummary,
  roomSummarySchema
} from './multiplayer.schemas.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type RoomUser = {
  id: number;
  username: string;
};

type RoomStatus = 'waiting' | 'in_progress';

type RoomRecord = {
  roomCode: string;
  hostUserId: number;
  status: RoomStatus;
  players: Array<{
    userId: number;
    username: string;
    ready: boolean;
  }>;
  options: RoomOptions;
};

export class RoomNotFoundError extends Error {}
export class RoomFullError extends Error {}
export class RoomClosedError extends Error {}
export class RoomAccessError extends Error {}

export class RoomService {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly userRoomIndex = new Map<number, string>();

  createRoom(user: RoomUser, options?: RoomOptionsPatch) {
    this.removeUserFromCurrentRoom(user.id);

    const room: RoomRecord = {
      roomCode: this.generateRoomCode(),
      hostUserId: user.id,
      status: 'waiting',
      players: [
        {
          userId: user.id,
          username: user.username,
          ready: false
        }
      ],
      options: {
        ...defaultRoomOptions,
        ...options
      }
    };

    this.rooms.set(room.roomCode, room);
    this.userRoomIndex.set(user.id, room.roomCode);

    return this.toSummary(room);
  }

  joinRoom(user: RoomUser, roomCode: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    const existingPlayer = room.players.find((player) => player.userId === user.id);
    if (existingPlayer) {
      return this.toSummary(room);
    }

    if (room.status !== 'waiting') {
      throw new RoomClosedError('Room is no longer accepting players.');
    }

    if (room.players.length >= ROOM_MAX_PLAYERS) {
      throw new RoomFullError('Room is full.');
    }

    this.removeUserFromCurrentRoom(user.id);

    room.players.push({
      userId: user.id,
      username: user.username,
      ready: false
    });
    this.userRoomIndex.set(user.id, room.roomCode);

    return this.toSummary(room);
  }

  getRoom(roomCode: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    return this.toSummary(room);
  }

  getRoomForUser(userId: number, roomCode: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    if (!room.players.some((player) => player.userId === userId)) {
      throw new RoomAccessError('You are not a member of this room.');
    }

    return this.toSummary(room);
  }

  getRoomForUserId(userId: number) {
    const roomCode = this.userRoomIndex.get(userId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.userRoomIndex.delete(userId);
      return null;
    }

    return this.toSummary(room);
  }

  findJoinableRoom(options?: RoomOptionsPatch) {
    for (const room of this.rooms.values()) {
      if (room.status !== 'waiting' || room.players.length >= ROOM_MAX_PLAYERS) {
        continue;
      }

      if (!matchesRequestedOptions(room.options, options)) {
        continue;
      }

      return room.roomCode;
    }

    return null;
  }

  private removeUserFromCurrentRoom(userId: number) {
    const roomCode = this.userRoomIndex.get(userId);
    if (!roomCode) {
      return;
    }

    const room = this.rooms.get(roomCode);
    this.userRoomIndex.delete(userId);

    if (!room) {
      return;
    }

    room.players = room.players.filter((player) => player.userId !== userId);

    if (room.players.length === 0) {
      this.rooms.delete(room.roomCode);
      return;
    }

    if (room.hostUserId === userId) {
      room.hostUserId = room.players[0]!.userId;
    }
  }

  private toSummary(room: RoomRecord): RoomSummary {
    const players: LobbyPlayer[] = room.players.map((player) => ({
      userId: player.userId,
      username: player.username,
      ready: player.ready,
      isHost: player.userId === room.hostUserId
    }));

    return roomSummarySchema.parse({
      roomCode: room.roomCode,
      hostUserId: room.hostUserId,
      status: room.status,
      maxPlayers: ROOM_MAX_PLAYERS,
      playerCount: players.length,
      players,
      options: room.options
    });
  }

  private generateRoomCode() {
    for (let attempts = 0; attempts < 500; attempts += 1) {
      const roomCode = Array.from({length: 6}, () => {
        const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
        return ROOM_CODE_ALPHABET[index];
      }).join('');

      if (!this.rooms.has(roomCode)) {
        return roomCode;
      }
    }

    throw new Error('Unable to allocate a unique room code.');
  }
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

function matchesRequestedOptions(roomOptions: RoomOptions, requestedOptions?: RoomOptionsPatch) {
  if (!requestedOptions) {
    return true;
  }

  return Object.entries(requestedOptions).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    return roomOptions[key as keyof RoomOptions] === value;
  });
}
