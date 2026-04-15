// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiUrl, getWebSocketUrl } from "./runtimeConfig";

describe("runtimeConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes mistaken Render api hosts in API URLs", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://avoid-poop-api.onrender.com");

    expect(getApiUrl("/api/auth/me")).toBe("https://avoid-poop.onrender.com/api/auth/me");
  });

  it("normalizes mistaken Render api hosts in websocket URLs", () => {
    vi.stubEnv("VITE_WS_BASE_URL", "wss://avoid-poop-api.onrender.com");

    expect(getWebSocketUrl(null)).toBe("wss://avoid-poop.onrender.com/api/multiplayer/ws");
  });
});
