// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MultiplayerHomePage } from "./MultiplayerHomePage";

describe("MultiplayerHomePage", () => {
  it("uses quick join without exposing room settings", () => {
    const onQuickJoin = vi.fn();
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinByCode={vi.fn()} onQuickJoin={onQuickJoin} />);

    fireEvent.click(screen.getAllByRole("button", { name: "빠른 입장" })[0]!);

    expect(onQuickJoin).toHaveBeenCalledWith({});
    expect(screen.queryByText("방 만들기 설정")).toBeNull();
  });

  it("opens room settings only when creating a room", () => {
    render(<MultiplayerHomePage onBack={vi.fn()} onCreateRoom={vi.fn()} onJoinByCode={vi.fn()} onQuickJoin={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "방 만들기" })[0]!);

    expect(screen.getByText((_, node) => node?.textContent === "방 만들기 설정").textContent).toBe("방 만들기 설정");
    expect(screen.getByRole("dialog", { name: "방 만들기 설정" })).toBeTruthy();
    expect(screen.getAllByText("공개방").length).toBeGreaterThan(0);
    expect(screen.getAllByText("비공개방").length).toBeGreaterThan(0);
  });
});
