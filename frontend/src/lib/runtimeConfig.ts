const DEFAULT_WS_PATH = "/api/multiplayer/ws";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readEnvValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? trimTrailingSlash(normalized) : null;
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
