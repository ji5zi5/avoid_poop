import { describe, expect, it } from "vitest";

import { getMultiplayerColorMap } from "./multiplayerColors";

describe("multiplayerColors", () => {
  it("assigns unique colors to each player in a room-sized roster", () => {
    const players = Array.from({ length: 8 }, (_, index) => ({ userId: index + 1 }));
    const colors = [...getMultiplayerColorMap(players).values()];

    expect(new Set(colors.map((color) => color.accent)).size).toBe(8);
  });
});
