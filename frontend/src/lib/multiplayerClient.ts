import { api } from "./api";
import { getWebSocketUrl } from "./runtimeConfig";

export type RoomStatus = "waiting" | "in_progress";
export type RoomDifficulty = "normal" | "hard";
export type RoomVisibility = "public" | "private";
export type MultiplayerPhase = "wave" | "boss" | "complete";
export type MultiplayerPlayerStatus = "alive" | "spectator" | "disconnected";
export type MultiplayerDebuffType = "slow" | "reverse" | "input_delay" | "vision_jam" | "item_lock";

export type RoomOptions = {
  difficulty: RoomDifficulty;
  visibility: RoomVisibility;
  bodyBlock: boolean;
  debuffTier: 2 | 3;
};

export type LobbyPlayer = {
  userId: number;
  username: string;
  isHost: boolean;
  ready: boolean;
};

export type RoomChatMessage = {
  id: string;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
};

export type RoomSummary = {
  roomCode: string;
  hostUserId: number;
  status: RoomStatus;
  maxPlayers: number;
  playerCount: number;
  players: LobbyPlayer[];
  options: RoomOptions;
  chatMessages: RoomChatMessage[];
};

export type RoomListEntry = {
  roomId: string;
  hostUsername: string;
  status: RoomStatus;
  maxPlayers: number;
  playerCount: number;
  options: RoomOptions;
};

export type CreateRoomPayload = {
  options?: Partial<RoomOptions>;
  maxPlayers?: number;
  privatePassword?: string;
};

export type JoinRoomPayload = {
  roomCode?: string;
  roomId?: string;
  privatePassword?: string;
};

export type QuickJoinPayload = Record<string, never>;

export type MultiplayerActiveDebuff = {
  expiresAt: number;
  type: MultiplayerDebuffType;
};

export type MultiplayerPlayerSnapshot = {
  userId: number;
  username: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: -1 | 0 | 1;
  lives: number;
  status: MultiplayerPlayerStatus;
  disconnectDeadlineAt: number | null;
  airborneUntil: number | null;
  activeDebuffs: MultiplayerActiveDebuff[];
};

export type MultiplayerHazardSnapshot = {
  id: number;
  owner: "wave" | "boss";
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
};

export type MultiplayerItemSnapshot = {
  id: number;
  type: "debuff";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MultiplayerGameSnapshot = {
  roomCode: string;
  phase: MultiplayerPhase;
  round: number;
  elapsedInPhase: number;
  options: RoomOptions;
  players: MultiplayerPlayerSnapshot[];
  hazards: MultiplayerHazardSnapshot[];
  items: MultiplayerItemSnapshot[];
  winnerUserId: number | null;
};

export type ClientSocketEvent =
  | { type: "subscribe_room"; roomCode: string }
  | { type: "ping" }
  | { type: "set_ready"; ready: boolean }
  | { type: "start_game" }
  | { type: "player_input"; direction: -1 | 0 | 1 }
  | { type: "jump" }
  | { type: "leave_room" }
  | { type: "send_chat"; message: string }
  | { type: "kick_player"; targetUserId: number }
  | { type: "transfer_host"; targetUserId: number };

export type ServerSocketEvent =
  | {
      type: "connected";
      reconnectToken: string;
      reconnectGraceMs: number;
      user: {
        id: number;
        username: string;
      };
      reconnected: boolean;
    }
  | { type: "room_snapshot"; room: RoomSummary }
  | { type: "game_snapshot"; game: MultiplayerGameSnapshot }
  | { type: "chat_message"; roomCode: string; chatMessage: RoomChatMessage }
  | { type: "room_departed"; roomCode: string; reason: "kicked"; message: string }
  | { type: "pong" }
  | { type: "error"; error: string };

type MultiplayerClientOptions = {
  reconnectToken?: string | null;
  url?: string;
  onClose?: (details: { wasConnected: boolean; code: number; reason: string }) => void;
  onError?: (event: Event) => void;
  onEvent?: (event: ServerSocketEvent) => void;
};

export function createMultiplayerClient({
  reconnectToken,
  url,
  onClose,
  onError,
  onEvent,
}: MultiplayerClientOptions) {
  let socket: WebSocket | null = null;
  let activeReconnectToken = reconnectToken;
  let didConnect = false;
  let connectPromise: Promise<WebSocket | null> | null = null;
  const pendingMessages: ClientSocketEvent[] = [];
  const listeners = new Set<(event: ServerSocketEvent) => void>();

  if (onEvent) {
    listeners.add(onEvent);
  }

  async function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return socket;
    }
    if (connectPromise) {
      return connectPromise;
    }

    connectPromise = (async () => {
      let wsToken: string | null = null;
      try {
        wsToken = (await api.createWebSocketTicket()).token;
      } catch {
        connectPromise = null;
        return null;
      }

      socket = new WebSocket(buildSocketUrl(url, activeReconnectToken, wsToken));
      socket.addEventListener("open", flushPendingMessages);
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("close", handleClose);
      socket.addEventListener("error", handleError);
      connectPromise = null;
      return socket;
    })();

    return connectPromise;
  }

  function handleMessage(message: MessageEvent<string>) {
    const parsed = JSON.parse(message.data) as ServerSocketEvent;
    if (parsed.type === "connected") {
      activeReconnectToken = parsed.reconnectToken;
      didConnect = true;
    }
    listeners.forEach((listener) => listener(parsed));
  }

  function handleClose(event: CloseEvent) {
    const wasConnected = didConnect;
    cleanup();
    onClose?.({
      wasConnected,
      code: event.code,
      reason: event.reason,
    });
  }

  function handleError(event: Event) {
    onError?.(event);
  }

  function send(event: ClientSocketEvent) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingMessages.push(event);
      return;
    }
    socket.send(JSON.stringify(event));
  }

  function flushPendingMessages() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pendingMessages.length > 0) {
      socket.send(JSON.stringify(pendingMessages.shift()));
    }
  }

  function cleanup() {
    if (!socket) {
      return;
    }
    socket.removeEventListener("open", flushPendingMessages);
    socket.removeEventListener("message", handleMessage);
    socket.removeEventListener("close", handleClose);
    socket.removeEventListener("error", handleError);
    socket = null;
    connectPromise = null;
  }

  return {
    connect,
    disconnect() {
      if (!socket) {
        return;
      }
      const activeSocket = socket;
      cleanup();
      activeSocket.close();
    },
    send,
    subscribe(listener: (event: ServerSocketEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeRoom(roomCode: string) {
      send({ type: "subscribe_room", roomCode });
    },
    ping() {
      send({ type: "ping" });
    },
    setReconnectToken(nextReconnectToken: string | null) {
      activeReconnectToken = nextReconnectToken;
    },
  };
}

function buildSocketUrl(url: string | undefined, reconnectToken: string | null | undefined, wsToken?: string | null) {
  if (url) {
    const nextUrl = new URL(url);
    if (reconnectToken) {
      nextUrl.searchParams.set("reconnectToken", reconnectToken);
    }
    if (wsToken) {
      nextUrl.searchParams.set("wsToken", wsToken);
    }
    return nextUrl.toString();
  }
  return getWebSocketUrl(reconnectToken, wsToken);
}
