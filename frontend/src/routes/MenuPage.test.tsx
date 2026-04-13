// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MenuPage } from "./MenuPage";

describe("MenuPage", () => {
  it("lets the player choose single-player or multiplayer entry flows", () => {
    const onPlaySingle = vi.fn();
    const onPlayMultiplayer = vi.fn();

    render(
      <MenuPage
        user={{ id: 7, username: "arcade" }}
        sessionSaveCount={2}
        onPlaySingle={onPlaySingle}
        onPlayMultiplayer={onPlayMultiplayer}
        onViewRecords={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "싱글 플레이" }));
    expect(onPlaySingle).toHaveBeenCalledWith("normal");

    fireEvent.click(screen.getByRole("button", { name: "멀티플레이" }));
    expect(onPlayMultiplayer).toHaveBeenCalledTimes(1);
  });
});
