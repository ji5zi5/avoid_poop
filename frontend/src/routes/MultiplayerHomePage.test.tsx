// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiplayerHomePage } from "./MultiplayerHomePage";

const publicRooms = [
  {
    roomCode: "ROOM42",
    hostUserId: 1,
    status: "waiting" as const,
    maxPlayers: 8,
    playerCount: 2,
    players: [
      { userId: 1, username: "alpha", isHost: true, ready: false },
      { userId: 2, username: "beta", isHost: false, ready: false },
    ],
    options: { difficulty: "normal" as const, visibility: "public" as const, bodyBlock: false, debuffTier: 2 as const },
    chatMessages: [],
  },
];

describe("MultiplayerHomePage", () => {
  it("uses quick join without exposing room settings", () => {
    const onQuickJoin = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinPublicRoom={vi.fn()} onJoinPrivateRoom={vi.fn()} loadPublicRooms={vi.fn().mockResolvedValue([])} onQuickJoin={onQuickJoin} />);

    fireEvent.click(screen.getAllByRole("button", { name: "빠른 입장" })[0]!);

    expect(onQuickJoin).toHaveBeenCalledWith({});
    expect(screen.queryByText("방 만들기 설정")).toBeNull();
  });

  it("opens room settings only when creating a room", () => {
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinPublicRoom={vi.fn()} onJoinPrivateRoom={vi.fn()} loadPublicRooms={vi.fn().mockResolvedValue([])} onQuickJoin={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "방 만들기" })[0]!);

    expect(screen.getByText((_, node) => node?.textContent === "방 만들기 설정").textContent).toBe("방 만들기 설정");
    expect(screen.getByRole("dialog", { name: "방 만들기 설정" })).toBeTruthy();
    expect(screen.getAllByText("공개방").length).toBeGreaterThan(0);
    expect(screen.getAllByText("비공개방").length).toBeGreaterThan(0);
  });

  it("renders public rooms and joins by clicking a room card", async () => {
    const onJoinPublicRoom = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinPublicRoom={onJoinPublicRoom} onJoinPrivateRoom={vi.fn()} loadPublicRooms={vi.fn().mockResolvedValue(publicRooms)} onQuickJoin={vi.fn()} />);

    expect(await screen.findByText("alpha · HOST")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "입장" }));

    expect(onJoinPublicRoom).toHaveBeenCalledWith("ROOM42");
  });

  it("joins a private room with a password instead of a room code", () => {
    const onJoinPrivateRoom = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinPublicRoom={vi.fn()} onJoinPrivateRoom={onJoinPrivateRoom} loadPublicRooms={vi.fn().mockResolvedValue([])} onQuickJoin={vi.fn()} />);

    const passwordInputs = screen.getAllByPlaceholderText("방 비밀번호");
    fireEvent.change(passwordInputs[passwordInputs.length - 1]!, { target: { value: "secret-pass" } });
    const privateJoinButtons = screen.getAllByRole("button", { name: "비밀번호 입장" });
    fireEvent.click(privateJoinButtons[privateJoinButtons.length - 1]!);

    expect(onJoinPrivateRoom).toHaveBeenCalledWith("secret-pass");
  });
});
