// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RoomSummary } from "../lib/multiplayerClient";
import { MultiplayerLobbyPage } from "./MultiplayerLobbyPage";

function createRoom(overrides?: Partial<RoomSummary>): RoomSummary {
  return {
    roomCode: "ABC123",
    hostUserId: 1,
    status: "waiting",
    maxPlayers: 8,
    playerCount: 2,
    options: {
      bodyBlock: true,
      debuffTier: 3,
    },
    players: [
      { userId: 1, username: "host", isHost: true, ready: true },
      { userId: 2, username: "guest", isHost: false, ready: false },
    ],
    ...overrides,
  };
}

describe("MultiplayerLobbyPage", () => {
  it("shows room details and lets the local player toggle ready", () => {
    const onSetReady = vi.fn();

    render(
      <MultiplayerLobbyPage
        room={createRoom()}
        localUserId={2}
        connectionStatus="connected"
        statusMessage=""
        error=""
        onSetReady={onSetReady}
        onStartGame={vi.fn()}
        onBackToMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("바디 블록")).toBeInTheDocument();
    expect(screen.getByText("디버프 티어 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "준비 완료" }));
    expect(onSetReady).toHaveBeenCalledWith(true);
  });

  it("keeps the host start button disabled until enough ready players are present", () => {
    const onStartGame = vi.fn();
    const { rerender } = render(
      <MultiplayerLobbyPage
        room={createRoom()}
        localUserId={1}
        connectionStatus="connected"
        statusMessage=""
        error=""
        onSetReady={vi.fn()}
        onStartGame={onStartGame}
        onBackToMenu={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "매치 시작" })).toBeDisabled();

    rerender(
      <MultiplayerLobbyPage
        room={createRoom({
          players: [
            { userId: 1, username: "host", isHost: true, ready: true },
            { userId: 2, username: "guest", isHost: false, ready: true },
          ],
        })}
        localUserId={1}
        connectionStatus="connected"
        statusMessage=""
        error=""
        onSetReady={vi.fn()}
        onStartGame={onStartGame}
        onBackToMenu={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "매치 시작" }));
    expect(onStartGame).toHaveBeenCalledTimes(1);
  });
});
