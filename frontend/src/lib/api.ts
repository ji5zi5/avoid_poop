import type {
  AuthCredentials,
  AuthResponse,
  AuthSession,
  AuthWebSocketTicket,
  RecordEntry,
  RecordsResponse,
  RankedRunSubmission,
  RunResultPayload,
  SinglePlayerRunSession,
} from "../../../shared/src/contracts/index";
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  QuickJoinPayload,
  RoomListEntry,
  RoomSummary,
} from "./multiplayerClient";
import { getApiUrl } from "./runtimeConfig";

const SESSION_TOKEN_KEY = "avoid-poop-session-token";

function readSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

function writeSessionToken(sessionToken: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!sessionToken) {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
}

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init.body !== null;
  const sessionToken = readSessionToken();
  if (hasBody) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  } else {
    headers.delete("Content-Type");
  }
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  const response = await fetch(getApiUrl(path), {
    credentials: "include",
    headers,
    ...init,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
    throw new ApiRequestError(data.error ?? "Request failed", response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<AuthSession>("/api/auth/me"),
  signup: async (payload: AuthCredentials) => {
    const response = await request<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
    writeSessionToken(response.sessionToken);
    return response;
  },
  login: async (payload: AuthCredentials) => {
    const response = await request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    writeSessionToken(response.sessionToken);
    return response;
  },
  logout: async () => {
    const response = await request<{ ok: true }>("/api/auth/logout", { method: "POST" });
    writeSessionToken(null);
    return response;
  },
  createWebSocketTicket: () => request<AuthWebSocketTicket>("/api/auth/ws-ticket", { method: "POST" }),
  records: () => request<RecordsResponse>("/api/records"),
  createRunSession: (mode: RunResultPayload["mode"]) =>
    request<SinglePlayerRunSession>("/api/records/run-session", { method: "POST", body: JSON.stringify({ mode }) }),
  heartbeatRunSession: (runSessionId: string) =>
    request<{ ok: true }>(`/api/records/run-session/${encodeURIComponent(runSessionId)}/heartbeat`, { method: "POST" }),
  saveRecord: (payload: RankedRunSubmission) =>
    request<RecordEntry>("/api/records", { method: "POST", body: JSON.stringify(payload) }),
  createRoom: (payload?: CreateRoomPayload) =>
    request<RoomSummary>("/api/multiplayer/rooms", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),
  listRooms: () => request<RoomListEntry[]>("/api/multiplayer/rooms"),
  joinRoom: (payload: JoinRoomPayload) =>
    request<RoomSummary>("/api/multiplayer/join", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  quickJoin: (payload?: QuickJoinPayload) =>
    request<RoomSummary>("/api/multiplayer/quick-join", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),
  getRoom: (roomCode: string) => request<RoomSummary>(`/api/multiplayer/rooms/${encodeURIComponent(roomCode)}`),
  leaveRoom: () => request<{ ok: true }>("/api/multiplayer/leave", { method: "POST" }),
};

export function clearStoredSessionToken() {
  writeSessionToken(null);
}
