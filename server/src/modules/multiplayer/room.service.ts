import {randomUUID} from 'node:crypto';

import {
  ROOM_MAX_PLAYERS,
  defaultRoomOptions,
  type LobbyPlayer,
  type RoomChatMessage,
  type RoomOptions,
  type RoomOptionsPatch,
  type RoomSummary,
  roomSummarySchema
} from './multiplayer.schemas.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CHAT_MESSAGES = 80;

export type RoomUser = {
  id: number;
  username: string;
};

type RoomStatus = 'waiting' | 'in_progress';

type RoomRecord = {
  roomCode: string;
  hostUserId: number;
  status: RoomStatus;
  privatePassword: string | null;
  players: Array<{
    userId: number;
    username: string;
    ready: boolean;
  }>;
  options: RoomOptions;
  chatMessages: RoomChatMessage[];
};

export class RoomNotFoundError extends Error {}
export class RoomFullError extends Error {}
export class RoomClosedError extends Error {}
export class RoomAccessError extends Error {}
export class RoomStartError extends Error {}
export class RoomPasswordConflictError extends Error {}

export class RoomService {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly userRoomIndex = new Map<number, string>();

  createRoom(user: RoomUser, options?: RoomOptionsPatch, privatePassword?: string) {
    this.removeUserFromCurrentRoom(user.id);

    const mergedOptions = {
      ...defaultRoomOptions,
      ...options
    };
    const normalizedPrivatePassword = mergedOptions.visibility === 'private'
      ? normalizePrivatePassword(privatePassword)
      : null;

    if (mergedOptions.visibility === 'private' && !normalizedPrivatePassword) {
      throw new RoomAccessError('Private rooms require a password.');
    }
    if (normalizedPrivatePassword && this.findPrivateRoomCodeByPassword(normalizedPrivatePassword)) {
      throw new RoomPasswordConflictError('That private room password is already in use.');
    }

    const room: RoomRecord = {
      roomCode: this.generateRoomCode(),
      hostUserId: user.id,
      status: 'waiting',
      privatePassword: normalizedPrivatePassword,
      players: [
        {
          userId: user.id,
          username: user.username,
          ready: false
        }
      ],
      options: mergedOptions,
      chatMessages: []
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

  joinPrivateRoom(user: RoomUser, privatePassword: string) {
    const normalizedPrivatePassword = normalizePrivatePassword(privatePassword);
    const roomCode = this.findPrivateRoomCodeByPassword(normalizedPrivatePassword);
    if (!roomCode) {
      throw new RoomNotFoundError('Private room not found.');
    }
    return this.joinRoom(user, roomCode);
  }

  getRoom(roomCode: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    return this.toSummary(room);
  }

  getRoomUsers(roomCode: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    return room.players.map((player) => ({
      id: player.userId,
      username: player.username
    }));
  }

  appendChatMessage(roomCode: string, user: RoomUser, message: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    if (!room.players.some((player) => player.userId === user.id)) {
      throw new RoomAccessError('You are not a member of this room.');
    }

    const chatMessage: RoomChatMessage = {
      id: randomUUID(),
      userId: user.id,
      username: user.username,
      message: message.trim(),
      createdAt: new Date().toISOString()
    };

    room.chatMessages.push(chatMessage);
    if (room.chatMessages.length > MAX_CHAT_MESSAGES) {
      room.chatMessages = room.chatMessages.slice(-MAX_CHAT_MESSAGES);
    }

    return chatMessage;
  }

  leaveCurrentRoom(userId: number) {
    const roomCode = this.userRoomIndex.get(userId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    this.userRoomIndex.delete(userId);
    if (!room) {
      return null;
    }

    room.players = room.players.filter((player) => player.userId !== userId);
    if (room.players.length === 0) {
      this.rooms.delete(room.roomCode);
      return null;
    }

    if (room.hostUserId === userId) {
      room.hostUserId = room.players[0]!.userId;
    }

    return this.toSummary(room);
  }

  ensureRoomCanStart(roomCode: string, userId: number) {
    const room = this.getRoomForUser(userId, roomCode);
    if (room.status !== 'waiting') {
      throw new RoomStartError('Game has already started.');
    }
    if (room.hostUserId !== userId) {
      throw new RoomStartError('Only the host can start the game.');
    }
    if (room.playerCount < 2) {
      throw new RoomStartError('At least 2 players are required to start.');
    }
    if (!room.players.every((player) => player.ready)) {
      throw new RoomStartError('All players must be ready before starting.');
    }
    return room;
  }

  setReady(roomCode: string, userId: number, ready: boolean) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    const player = room.players.find((entry) => entry.userId === userId);
    if (!player) {
      throw new RoomAccessError('You are not a member of this room.');
    }

    player.ready = ready;
    return this.toSummary(room);
  }

  markRoomInProgress(roomCode: string) {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(normalizedRoomCode);

    if (!room) {
      throw new RoomNotFoundError('Room not found.');
    }

    room.status = 'in_progress';
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

  listPublicRooms() {
    return Array.from(this.rooms.values())
      .filter((room) => room.status === 'waiting' && room.options.visibility === 'public')
      .sort((left, right) => right.players.length - left.players.length || left.roomCode.localeCompare(right.roomCode))
      .map((room) => this.toSummary(room));
  }

  findJoinableRoom(options?: RoomOptionsPatch) {
    for (const room of this.rooms.values()) {
      if (room.status !== 'waiting' || room.players.length >= ROOM_MAX_PLAYERS) {
        continue;
      }

      if (room.options.visibility !== 'public') {
        continue;
      }

      if (!matchesRequestedOptions(room.options, options)) {
        continue;
      }

      return room.roomCode;
    }

    return null;
  }

  private findPrivateRoomCodeByPassword(privatePassword: string) {
    for (const room of this.rooms.values()) {
      if (room.status !== 'waiting' || room.options.visibility !== 'private') {
        continue;
      }
      if (room.privatePassword === privatePassword) {
        return room.roomCode;
      }
    }
    return null;
  }

  private removeUserFromCurrentRoom(userId: number) {
    this.leaveCurrentRoom(userId);
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
      options: room.options,
      chatMessages: room.chatMessages
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

function normalizePrivatePassword(privatePassword: string | undefined) {
  return privatePassword?.trim() ?? '';
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
