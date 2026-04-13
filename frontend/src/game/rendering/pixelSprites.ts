export type PixelSprite = {
  pixelSize: number;
  pattern: readonly string[];
};

export const playerSprite: PixelSprite = {
  pixelSize: 4,
  pattern: [
    "000111000",
    "001111100",
    "011111110",
    "111111111",
    "011111110",
    "001111100",
  ],
};

export const smallPoopSprite: PixelSprite = {
  pixelSize: 4,
  pattern: [
    "0110",
    "1111",
    "1111",
    "0110",
  ],
};

export const mediumPoopSprite: PixelSprite = {
  pixelSize: 4,
  pattern: [
    "01110",
    "11111",
    "11111",
    "11111",
    "01110",
  ],
};

export const largePoopSprite: PixelSprite = {
  pixelSize: 4,
  pattern: [
    "001100",
    "011110",
    "111111",
    "111111",
    "111111",
    "011110",
  ],
};

export const bossPoopSprite: PixelSprite = {
  pixelSize: 4,
  pattern: [
    "0001100",
    "0011110",
    "0111111",
    "1111111",
    "1111111",
    "1111111",
    "0111110",
  ],
};

export const itemSprites = {
  invincibility: {
    pixelSize: 2,
    pattern: [
      "0001000",
      "0011100",
      "0111110",
      "1111111",
      "0111110",
      "0011100",
      "0001000",
    ],
  },
  speed: {
    pixelSize: 2,
    pattern: [
      "1000001",
      "1100011",
      "1110111",
      "0111110",
      "1110111",
      "1100011",
      "1000001",
    ],
  },
  heal: {
    pixelSize: 2,
    pattern: [
      "0001000",
      "0001000",
      "0001000",
      "1111111",
      "0001000",
      "0001000",
      "0001000",
    ],
  },
  slow: {
    pixelSize: 2,
    pattern: [
      "1111111",
      "1000001",
      "1001101",
      "1010011",
      "1011001",
      "1000001",
      "1111111",
    ],
  },
  clear: {
    pixelSize: 2,
    pattern: [
      "1000001",
      "0100010",
      "0010100",
      "0001000",
      "0010100",
      "0100010",
      "1000001",
    ],
  },
} as const;

export function getHazardSprite(size: number) {
  if (size >= 28) {
    return bossPoopSprite;
  }
  if (size >= 24) {
    return largePoopSprite;
  }
  if (size >= 20) {
    return mediumPoopSprite;
  }
  return smallPoopSprite;
}

export function spriteWidth(sprite: PixelSprite) {
  return sprite.pattern[0].length * sprite.pixelSize;
}

export function spriteHeight(sprite: PixelSprite) {
  return sprite.pattern.length * sprite.pixelSize;
}
