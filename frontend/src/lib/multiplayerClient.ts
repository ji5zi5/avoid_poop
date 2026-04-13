export type RoomStatus = "waiting" | "in_progress";
export type MultiplayerPhase = "wave" | "boss" | "complete";
export type MultiplayerPlayerStatus = "alive" | "spectator" | "disconnected";
export type MultiplayerDebuffType = "slow" | "reverse" | "input_delay" | "vision_jam" | "item_lock";

export type RoomOptions = {
  bodyBlock: boolean;
  debuffTier: 2 | 3;
};

export type LobbyPlayer = {
  userId: number;
  username: string;
  isHost: boolean;
  ready: boolean;
};

export type RoomSummary = {
  roomCode: string;
  hostUserId: number;
  status: RoomStatus;
  maxPlayers: number;
  playerCount: number;
  players: LobbyPlayer[];
  options: RoomOptions;
};

export type CreateRoomPayload = {
  options?: Partial<RoomOptions>;
};

export type JoinRoomPayload = {
  roomCode: string;
};

export type QuickJoinPayload = {
  options?: Partial<RoomOptions>;
};

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
  | { type: "leave_room" };

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
  | { type: "pong" }
  | { type: "error"; error: string };

type MultiplayerClientOptions = {
  reconnectToken?: string | null;
  url?: string;
  onClose?: () => void;
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
  const pendingMessages: ClientSocketEvent[] = [];
  const listeners = new Set<(event: ServerSocketEvent) => void>();

  if (onEvent) {
    listeners.add(onEvent);
  }

  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return socket;
    }

    socket = new WebSocket(buildSocketUrl(url, activeReconnectToken));
    socket.addEventListener("open", flushPendingMessages);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
    return socket;
  }

  function handleMessage(message: MessageEvent<string>) {
    const parsed = JSON.parse(message.data) as ServerSocketEvent;
    if (parsed.type === "connected") {
      activeReconnectToken = parsed.reconnectToken;
    }
    listeners.forEach((listener) => listener(parsed));
  }

  function handleClose() {
    cleanup();
    onClose?.();
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
      return () => {
        listeners.delete(listener);
      };
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

function buildSocketUrl(url: string | undefined, reconnectToken: string | null | undefined) {
  const socketUrl =
    url ??
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/multiplayer/ws`;
  const nextUrl = new URL(socketUrl);

  if (reconnectToken) {
    nextUrl.searchParams.set("reconnectToken", reconnectToken);
  }

  return nextUrl.toString();
}
