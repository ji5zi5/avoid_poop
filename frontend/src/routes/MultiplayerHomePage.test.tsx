// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiplayerHomePage } from "./MultiplayerHomePage";

const listedRooms = [
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
  {
    roomCode: "ROOM77",
    hostUserId: 3,
    status: "waiting" as const,
    maxPlayers: 8,
    playerCount: 1,
    players: [
      { userId: 3, username: "gamma", isHost: true, ready: false },
    ],
    options: { difficulty: "hard" as const, visibility: "private" as const, bodyBlock: true, debuffTier: 3 as const },
    chatMessages: [],
  },
];

describe("MultiplayerHomePage", () => {
  it("uses quick join without exposing room settings", () => {
    const onQuickJoin = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} loadRooms={vi.fn().mockResolvedValue([])} onQuickJoin={onQuickJoin} />);

    fireEvent.click(screen.getByRole("button", { name: "빠른 입장" }));

    expect(onQuickJoin).toHaveBeenCalledWith({});
    expect(screen.queryByText("방 만들기 설정")).toBeNull();
  });

  it("opens room settings only when creating a room", () => {
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={vi.fn()} loadRooms={vi.fn().mockResolvedValue([])} onQuickJoin={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "방 만들기" }).at(-1)!);

    expect(screen.getByRole("dialog", { name: "방 만들기 설정" })).toBeTruthy();
    expect(screen.getAllByText("공개방").length).toBeGreaterThan(0);
    expect(screen.getAllByText("비공개방").length).toBeGreaterThan(0);
  });

  it("renders public and private rooms in one list and joins the selected room correctly", async () => {
    const onJoinRoom = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={onJoinRoom} loadRooms={vi.fn().mockResolvedValue(listedRooms)} onQuickJoin={vi.fn()} />);

    expect(await screen.findByText("alpha · HOST")).toBeTruthy();
    expect(screen.getByText("gamma · HOST")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "바로 입장" }));
    expect(onJoinRoom).toHaveBeenCalledWith({ roomCode: "ROOM42" });

    const passwordInput = screen.getByLabelText("비밀번호");
    fireEvent.change(passwordInput, { target: { value: "secret-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 입장" }));
    expect(onJoinRoom).toHaveBeenCalledWith({ roomCode: "ROOM77", privatePassword: "secret-pass" });
  });
});
