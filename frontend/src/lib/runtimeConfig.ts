const DEFAULT_WS_PATH = "/api/multiplayer/ws";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeHostedBase(rawValue: string) {
  try {
    const nextUrl = new URL(rawValue);
    if (nextUrl.hostname.endsWith("-api.onrender.com")) {
      nextUrl.hostname = nextUrl.hostname.replace(/-api\.onrender\.com$/, ".onrender.com");
      return trimTrailingSlash(nextUrl.toString());
    }
  } catch {
    return rawValue;
  }

  return rawValue;
}

function readEnvValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalizeHostedBase(trimTrailingSlash(normalized)) : null;
}

export function getApiBaseUrl() {
  return readEnvValue(import.meta.env.VITE_API_BASE_URL);
}

export function getApiUrl(path: string) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return path;
  }
  return new URL(path, `${apiBaseUrl}/`).toString();
}

export function getWebSocketUrl(reconnectToken: string | null | undefined) {
  const configuredBase = readEnvValue(import.meta.env.VITE_WS_BASE_URL);
  const fallbackBase = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${DEFAULT_WS_PATH}`;
  const socketBase = configuredBase
    ? configuredBase.endsWith(DEFAULT_WS_PATH)
      ? configuredBase
      : `${configuredBase}${DEFAULT_WS_PATH}`
    : fallbackBase;

  const nextUrl = new URL(socketBase);
  if (reconnectToken) {
    nextUrl.searchParams.set("reconnectToken", reconnectToken);
  }
  return nextUrl.toString();
}
