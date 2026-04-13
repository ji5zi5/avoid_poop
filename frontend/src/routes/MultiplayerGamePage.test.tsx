// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MultiplayerGameSnapshot, RoomSummary } from "../lib/multiplayerClient";
import { MultiplayerGamePage } from "./MultiplayerGamePage";

vi.mock("../game/multiplayer/renderMultiplayerGame", () => ({
  renderMultiplayerGame: vi.fn(),
}));

function createRoom(): RoomSummary {
  return {
    roomCode: "ABC123",
    hostUserId: 1,
    status: "in_progress",
    maxPlayers: 8,
    playerCount: 2,
    options: {
      bodyBlock: false,
      debuffTier: 2,
    },
    players: [
      { userId: 1, username: "host", isHost: true, ready: true },
      { userId: 2, username: "guest", isHost: false, ready: true },
    ],
  };
}

function createGame(overrides?: Partial<MultiplayerGameSnapshot>): MultiplayerGameSnapshot {
  return {
    roomCode: "ABC123",
    phase: "wave",
    round: 2,
    elapsedInPhase: 3,
    options: {
      bodyBlock: false,
      debuffTier: 2,
    },
    winnerUserId: null,
    players: [
      {
        userId: 1,
        username: "host",
        x: 40,
        y: 420,
        width: 36,
        height: 24,
        direction: 0,
        lives: 2,
        status: "alive",
        disconnectDeadlineAt: null,
        activeDebuffs: [],
      },
      {
        userId: 2,
        username: "guest",
        x: 160,
        y: 420,
        width: 36,
        height: 24,
        direction: 0,
        lives: 1,
        status: "alive",
        disconnectDeadlineAt: null,
        activeDebuffs: [],
      },
    ],
    hazards: [{ id: 1, owner: "wave", x: 44, y: 10, width: 20, height: 20, speed: 180 }],
    items: [],
    ...overrides,
  };
}

describe("MultiplayerGamePage", () => {
  it("shows the live hud and sends local controls while the player is alive", () => {
    const onSendDirection = vi.fn();

    render(
      <MultiplayerGamePage
        room={createRoom()}
        game={createGame()}
        localUserId={1}
        connectionStatus="connected"
        statusMessage=""
        error=""
        onSendDirection={onSendDirection}
        onBackToMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("남은 인원")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("host")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyUp(window, { key: "ArrowLeft" });

    expect(onSendDirection).toHaveBeenNthCalledWith(1, -1);
    expect(onSendDirection).toHaveBeenNthCalledWith(2, 0);
  });

  it("switches to spectator messaging and reconnect status when the local player is out", () => {
    const onSendDirection = vi.fn();

    render(
      <MultiplayerGamePage
        room={createRoom()}
        game={createGame({
          players: [
            {
              userId: 1,
              username: "host",
              x: 40,
              y: 420,
              width: 36,
              height: 24,
              direction: 0,
              lives: 0,
              status: "spectator",
              disconnectDeadlineAt: null,
              activeDebuffs: [],
            },
            {
              userId: 2,
              username: "guest",
              x: 160,
              y: 420,
              width: 36,
              height: 24,
              direction: 0,
              lives: 1,
              status: "alive",
              disconnectDeadlineAt: null,
              activeDebuffs: [],
            },
          ],
        })}
        localUserId={1}
        connectionStatus="reconnecting"
        statusMessage="재연결 시도 중..."
        error=""
        onSendDirection={onSendDirection}
        onBackToMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("관전 모드")).toBeInTheDocument();
    expect(screen.getByText("재연결 시도 중...")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onSendDirection).not.toHaveBeenCalled();
  });
});
