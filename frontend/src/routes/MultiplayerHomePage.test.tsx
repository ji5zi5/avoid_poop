// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiplayerHomePage } from "./MultiplayerHomePage";

const listedRooms = [
  {
    roomId: "7f9fb622-2b24-4271-b086-b8484ccd7f16",
    status: "waiting" as const,
    hostUsername: "alpha",
    maxPlayers: 8,
    playerCount: 2,
    options: { difficulty: "normal" as const, visibility: "public" as const, bodyBlock: false, debuffTier: 2 as const },
  },
  {
    roomId: "973ebca7-f10a-4718-88c6-eb501f9c0af0",
    status: "waiting" as const,
    hostUsername: "gamma",
    maxPlayers: 8,
    playerCount: 1,
    options: { difficulty: "hard" as const, visibility: "private" as const, bodyBlock: true, debuffTier: 3 as const },
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
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByLabelText("부딪힘").tagName).toBe("SELECT");
  });

  it("renders public and private rooms in one list and joins the selected room correctly", async () => {
    const onJoinRoom = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinRoom={onJoinRoom} loadRooms={vi.fn().mockResolvedValue(listedRooms)} onQuickJoin={vi.fn()} />);

    expect(await screen.findByText("alpha · HOST")).toBeTruthy();
    expect(screen.getByText("gamma · HOST")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "바로 입장" }));
    expect(onJoinRoom).toHaveBeenCalledWith({ roomId: "7f9fb622-2b24-4271-b086-b8484ccd7f16" });

    const passwordInput = screen.getByLabelText("비밀번호");
    fireEvent.change(passwordInput, { target: { value: "secret-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 입장" }));
    expect(onJoinRoom).toHaveBeenCalledWith({ roomId: "973ebca7-f10a-4718-88c6-eb501f9c0af0", privatePassword: "secret-pass" });
  });
});
