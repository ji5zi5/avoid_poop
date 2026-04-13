import type {IncomingMessage} from 'node:http';
import {randomUUID} from 'node:crypto';

import type {FastifyInstance} from 'fastify';
import {WebSocketServer, type RawData, type WebSocket} from 'ws';

import {config} from '../../config.js';
import {resolveSessionUserFromSignedCookie} from '../auth/auth.service.js';
import {MultiplayerGameService} from './game.service.js';
import {saveCompletedMultiplayerGame} from './results.service.js';
import type {MultiplayerGameState} from './game.types.js';
import {
  multiplayerClientEventSchema,
  multiplayerGameSnapshotSchema,
  multiplayerServerEventSchema,
  type MultiplayerClientEvent
} from './multiplayer.schemas.js';
import {RoomAccessError, RoomNotFoundError, RoomStartError, type RoomService} from './room.service.js';

type SocketGatewayOptions = {
  roomService: RoomService;
};

type ConnectedUser = {
  id: number;
  username: string;
};

type ConnectionContext = {
  reconnectToken: string;
  roomCode: string | null;
  socket: WebSocket;
  suppressDisconnect: boolean;
  user: ConnectedUser;
};

type ReconnectRecord = {
  expiresAt: number;
  roomCode: string | null;
  user: ConnectedUser;
};

type ConnectionMetadata = {
  reconnectToken: string;
  reconnected: boolean;
  roomCode: string | null;
  user: ConnectedUser;
};

export class MultiplayerSocketGateway {
  private readonly connections = new Map<WebSocket, ConnectionContext>();
  private readonly reconnectRecords = new Map<string, ReconnectRecord>();
  private readonly gameIntervals = new Map<string, NodeJS.Timeout>();
  private readonly activeGames = new Map<string, MultiplayerGameState>();
  private readonly gameService = new MultiplayerGameService();
  private readonly server = new WebSocketServer({noServer: true});

  constructor(private readonly app: FastifyInstance, private readonly options: SocketGatewayOptions) {
    this.server.on('connection', (_socket: WebSocket, _request: IncomingMessage, _metadata: ConnectionMetadata) => {});
    this.server.on('connection', (socket: WebSocket, request: IncomingMessage, metadata: ConnectionMetadata) => {
      const context: ConnectionContext = {
        socket,
        user: metadata.user,
        reconnectToken: metadata.reconnectToken,
        roomCode: metadata.roomCode,
        suppressDisconnect: false
      };
      this.connections.set(socket, context);
      this.send(socket, {
        type: 'connected',
        reconnectToken: context.reconnectToken,
        reconnectGraceMs: config.multiplayerReconnectGraceMs,
        user: context.user,
        reconnected: metadata.reconnected
      });
      if (context.roomCode) {
        const game = this.activeGames.get(context.roomCode);
        if (metadata.reconnected && game) {
          this.gameService.reconnectPlayer(game, context.user.id);
        }
        this.broadcastRoomSnapshot(context.roomCode);
        this.broadcastGameSnapshot(context.roomCode);
      }

      socket.on('message', (payload: RawData) => {
        this.handleMessage(context, payload.toString());
      });

      socket.on('close', () => {
        this.connections.delete(socket);
        if (context.suppressDisconnect) {
          return;
        }
        if (context.roomCode) {
          const game = this.activeGames.get(context.roomCode);
          if (game) {
            this.gameService.disconnectPlayer(game, context.user.id);
            this.broadcastGameSnapshot(context.roomCode);
          }
        }
        this.reconnectRecords.set(context.reconnectToken, {
          user: context.user,
          roomCode: context.roomCode,
          expiresAt: Date.now() + config.multiplayerReconnectGraceMs
        });
      });
    });
  }

  register() {
    this.app.server.on('upgrade', (request, socket, head) => {
      const upgradeUrl = new URL(request.url ?? '/', 'http://localhost');
      if (upgradeUrl.pathname !== config.multiplayerWebSocketPath) {
        return;
      }

      const user = this.resolveUser(request);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      const requestedReconnectToken = upgradeUrl.searchParams.get('reconnectToken') ?? undefined;
      const connectionMetadata = this.resolveConnectionMetadata(user, requestedReconnectToken);

      this.server.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        this.server.emit('connection', ws, request, connectionMetadata);
      });
    });

    this.app.addHook('onClose', async () => {
      for (const interval of this.gameIntervals.values()) {
        clearInterval(interval);
      }
      for (const socket of this.connections.keys()) {
        socket.close();
      }
      await new Promise<void>((resolve, reject) => {
        this.server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    });
  }

  leaveUser(userId: number) {
    const contexts = [...this.connections.values()].filter((context) => context.user.id === userId && context.roomCode);
    const roomCode = contexts[0]?.roomCode ?? this.options.roomService.getRoomForUserId(userId)?.roomCode ?? null;
    const nextRoom = this.options.roomService.leaveCurrentRoom(userId);
    if (roomCode) {
      const game = this.activeGames.get(roomCode);
      if (game) {
        this.gameService.applyPlayerHit(game, userId, 99);
      }
      for (const context of contexts) {
        context.roomCode = nextRoom?.roomCode ?? null;
      }
      this.broadcastRoomSnapshot(roomCode);
      this.broadcastGameSnapshot(roomCode);
    }
  }

  broadcastRoomSnapshot(roomCode: string) {
    let room;
    try {
      room = this.options.roomService.getRoom(roomCode);
    } catch {
      return;
    }

    for (const context of this.connections.values()) {
      if (context.roomCode === roomCode) {
        this.send(context.socket, {
          type: 'room_snapshot',
          room
        });
      }
    }
  }

  broadcastGameSnapshot(roomCode: string) {
    const game = this.activeGames.get(roomCode);
    if (!game) {
      return;
    }

    const snapshot = multiplayerGameSnapshotSchema.parse(game);
    for (const context of this.connections.values()) {
      if (context.roomCode === roomCode) {
        this.send(context.socket, {
          type: 'game_snapshot',
          game: snapshot
        });
      }
    }
  }

  private handleMessage(context: ConnectionContext, raw: string) {
    const parsed = multiplayerClientEventSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      this.send(context.socket, {type: 'error', error: parsed.error.issues[0]?.message ?? 'Invalid socket payload.'});
      return;
    }

    const event = parsed.data satisfies MultiplayerClientEvent;
    if (event.type === 'ping') {
      this.send(context.socket, {type: 'pong'});
      return;
    }

    if (event.type === 'subscribe_room') {
      try {
        const room = this.options.roomService.getRoomForUser(context.user.id, event.roomCode);
        context.roomCode = room.roomCode;
        this.broadcastRoomSnapshot(room.roomCode);
        this.broadcastGameSnapshot(room.roomCode);
      } catch (error) {
        if (error instanceof RoomNotFoundError || error instanceof RoomAccessError || error instanceof RoomStartError) {
          this.send(context.socket, {type: 'error', error: error.message});
          return;
        }
        throw error;
      }
      return;
    }

    if (!context.roomCode) {
      this.send(context.socket, {type: 'error', error: 'Subscribe to a room first.'});
      return;
    }

    if (event.type === 'set_ready') {
      try {
        this.options.roomService.setReady(context.roomCode, context.user.id, event.ready);
        this.broadcastRoomSnapshot(context.roomCode);
      } catch (error) {
        if (error instanceof RoomNotFoundError || error instanceof RoomAccessError || error instanceof RoomStartError) {
          this.send(context.socket, {type: 'error', error: error.message});
          return;
        }
        throw error;
      }
      return;
    }

    if (event.type === 'start_game') {
      try {
        this.options.roomService.ensureRoomCanStart(context.roomCode, context.user.id);
        const startedRoom = this.options.roomService.markRoomInProgress(context.roomCode);
        const game = this.gameService.createGame(startedRoom);
        this.activeGames.set(context.roomCode, game);
        this.ensureGameLoop(context.roomCode);
        this.broadcastRoomSnapshot(context.roomCode);
        this.broadcastGameSnapshot(context.roomCode);
      } catch (error) {
        if (error instanceof RoomNotFoundError || error instanceof RoomAccessError || error instanceof RoomStartError) {
          this.send(context.socket, {type: 'error', error: error.message});
          return;
        }
        throw error;
      }
      return;
    }

    if (event.type === 'leave_room') {
      this.leaveUser(context.user.id);
      return;
    }

    if (event.type === 'player_input') {
      const game = this.activeGames.get(context.roomCode);
      if (!game) {
        this.send(context.socket, {type: 'error', error: 'Game has not started.'});
        return;
      }
      this.gameService.setPlayerDirection(game, context.user.id, event.direction);
      this.broadcastGameSnapshot(context.roomCode);
    }
  }

  private ensureGameLoop(roomCode: string) {
    if (this.gameIntervals.has(roomCode)) {
      return;
    }

    const interval = setInterval(() => {
      const game = this.activeGames.get(roomCode);
      if (!game) {
        clearInterval(interval);
        this.gameIntervals.delete(roomCode);
        return;
      }

      this.gameService.tick(game, 0.1, Date.now());
      this.broadcastGameSnapshot(roomCode);
      if (game.phase === 'complete') {
        saveCompletedMultiplayerGame(game);
        clearInterval(interval);
        this.gameIntervals.delete(roomCode);
      }
    }, 100);

    this.gameIntervals.set(roomCode, interval);
  }

  private resolveUser(request: IncomingMessage) {
    const cookieValue = getCookieValue(request.headers.cookie, config.sessionCookieName);
    return resolveSessionUserFromSignedCookie(cookieValue, (value) => this.app.unsignCookie(value));
  }

  private resolveConnectionMetadata(user: ConnectedUser, requestedToken?: string): ConnectionMetadata {
    this.pruneReconnectRecords();

    if (requestedToken) {
      const liveContext = this.findLiveContextByReconnectToken(user.id, requestedToken);
      if (liveContext) {
        liveContext.suppressDisconnect = true;
        liveContext.socket.close();
        return {
          user,
          reconnectToken: requestedToken,
          reconnected: true,
          roomCode: liveContext.roomCode
        };
      }

      const record = this.reconnectRecords.get(requestedToken);
      if (record && record.user.id === user.id && record.expiresAt > Date.now()) {
        this.reconnectRecords.delete(requestedToken);
        return {
          user,
          reconnectToken: requestedToken,
          reconnected: true,
          roomCode: record.roomCode
        };
      }
    }

    return {
      user,
      reconnectToken: randomUUID(),
      reconnected: false,
      roomCode: null
    };
  }

  private findLiveContextByReconnectToken(userId: number, reconnectToken: string) {
    for (const context of this.connections.values()) {
      if (context.user.id === userId && context.reconnectToken === reconnectToken) {
        return context;
      }
    }
    return null;
  }

  private pruneReconnectRecords() {
    const now = Date.now();
    for (const [token, record] of this.reconnectRecords.entries()) {
      if (record.expiresAt <= now) {
        this.reconnectRecords.delete(token);
      }
    }
  }

  private send(socket: WebSocket, payload: unknown) {
    if (socket.readyState !== socket.OPEN) {
      return;
    }
    const safePayload = multiplayerServerEventSchema.parse(payload);
    socket.send(JSON.stringify(safePayload));
  }
}

function getCookieValue(header: string | undefined, cookieName: string) {
  if (!header) {
    return undefined;
  }

  const segments = header.split(';');
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator);
    if (key === cookieName) {
      return trimmed.slice(separator + 1);
    }
  }

  return undefined;
}
