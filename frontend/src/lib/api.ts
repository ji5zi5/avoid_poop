import type {
  AuthCredentials,
  AuthResponse,
  AuthSession,
  RecordEntry,
  RecordsResponse,
  RunResultPayload,
} from "../../../shared/src/contracts/index";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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
  signup: (payload: AuthCredentials) =>
    request<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: AuthCredentials) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  records: () => request<RecordsResponse>("/api/records"),
  saveRecord: (payload: RunResultPayload) =>
    request<RecordEntry>("/api/records", { method: "POST", body: JSON.stringify(payload) }),
};
