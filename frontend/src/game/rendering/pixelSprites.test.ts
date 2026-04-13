import { describe, expect, it } from "vitest";

import {
  bossPoopSprite,
  getHazardSprite,
  itemSprites,
  largePoopSprite,
  mediumPoopSprite,
  playerSprite,
  smallPoopSprite,
  spriteHeight,
  spriteWidth,
} from "./pixelSprites";

describe("pixel sprite dimensions", () => {
  it("matches the player logical box", () => {
    expect(spriteWidth(playerSprite)).toBe(36);
    expect(spriteHeight(playerSprite)).toBe(24);
  });

  it("matches hazard logical sizes", () => {
    expect(spriteWidth(smallPoopSprite)).toBe(16);
    expect(spriteHeight(smallPoopSprite)).toBe(16);
    expect(spriteWidth(mediumPoopSprite)).toBe(20);
    expect(spriteHeight(mediumPoopSprite)).toBe(20);
    expect(spriteWidth(largePoopSprite)).toBe(24);
    expect(spriteHeight(largePoopSprite)).toBe(24);
    expect(spriteWidth(bossPoopSprite)).toBe(28);
    expect(spriteHeight(bossPoopSprite)).toBe(28);
  });

  it("selects symmetric hazard sprites by size", () => {
    expect(getHazardSprite(16)).toBe(smallPoopSprite);
    expect(getHazardSprite(20)).toBe(mediumPoopSprite);
    expect(getHazardSprite(24)).toBe(largePoopSprite);
    expect(getHazardSprite(28)).toBe(bossPoopSprite);
  });

  it("matches item logical size", () => {
    Object.values(itemSprites).forEach((sprite) => {
      expect(spriteWidth(sprite)).toBe(14);
      expect(spriteHeight(sprite)).toBe(14);
    });
  });
});
