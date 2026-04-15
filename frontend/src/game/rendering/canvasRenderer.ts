import type { GameState, Hazard, ItemType } from "../state.js";
import { getHazardSprite, itemSprites, playerSprite } from "./pixelSprites.js";
import { palette } from "./spriteAtlas.js";

const itemColorMap = {
  invincibility: palette.invincibility,
  speed: palette.speed,
  heal: palette.heal,
  slow: palette.slow,
  clear: palette.clear,
};

const effectFlashColorMap: Record<ItemType, string> = {
  invincibility: "rgba(255, 233, 134, 0.18)",
  speed: "rgba(255, 177, 91, 0.16)",
  heal: "rgba(241, 127, 112, 0.16)",
  slow: "rgba(139, 173, 232, 0.16)",
  clear: "rgba(255, 255, 255, 0.24)",
};

function drawPixelShape(
  ctx: CanvasRenderingContext2D,
  pattern: readonly string[],
  x: number,
  y: number,
  pixelSize: number,
  color: string,
) {
  ctx.fillStyle = color;
  pattern.forEach((row, rowIndex) => {
    row.split("").forEach((cell, colIndex) => {
      if (cell === "1") {
        ctx.fillRect(x + colIndex * pixelSize, y + rowIndex * pixelSize, pixelSize, pixelSize);
      }
    });
  });
}

function drawBackgroundDetail(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = palette.cloud;
  ctx.fillRect(32, 42, 70, 10);
  ctx.fillRect(220, 70, 88, 12);
  ctx.fillStyle = palette.line;
  for (let y = 0; y < state.height; y += 32) {
    ctx.fillRect(0, y, state.width, 1);
  }
}

function drawPlayerAura(ctx: CanvasRenderingContext2D, state: GameState) {
  let aura: string | null = null;
  if (state.invincibilityTimer > 0) {
    aura = "rgba(255, 233, 134, 0.28)";
  } else if (state.speedBoostTimer > 0) {
    aura = "rgba(255, 177, 91, 0.22)";
  } else if (state.slowMotionTimer > 0) {
    aura = "rgba(139, 173, 232, 0.22)";
  }

  if (!aura) {
    return;
  }

  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.ellipse(state.player.x + 18, state.player.y + 14, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBurstFlash(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.effectBurstType || state.effectBurstTimer <= 0) {
    return;
  }

  const intensity = state.effectBurstTimer / 0.42;
  const color = effectFlashColorMap[state.effectBurstType];
  if (state.effectBurstType === "clear") {
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.min(0.7, intensity);
    ctx.fillRect(0, 0, state.width, state.height);
  }

  ctx.strokeStyle = color.replace(/0\.[0-9]+\)/, "0.88)");
  ctx.lineWidth = state.effectBurstType === "clear" ? 4 : 3;
  ctx.globalAlpha = Math.min(0.95, intensity);
  ctx.beginPath();
  ctx.arc(state.player.x + 18, state.player.y + 12, 18 + (1 - intensity) * 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  drawPlayerAura(ctx, state);

  ctx.fillStyle = "rgba(70, 63, 26, 0.18)";
  ctx.fillRect(state.player.x + 4, state.player.y + 22, 28, 6);
  drawPixelShape(ctx, playerSprite.pattern, state.player.x, state.player.y, playerSprite.pixelSize, palette.player);

  ctx.fillStyle = palette.playerMarker;
  ctx.fillRect(state.player.x + 16, state.player.y - 10, 4, 6);
  ctx.fillRect(state.player.x + 12, state.player.y - 4, 12, 4);

  ctx.fillStyle = palette.playerOutline;
  ctx.fillRect(state.player.x + 12, state.player.y + 12, 4, 4);
  ctx.fillRect(state.player.x + 20, state.player.y + 12, 4, 4);
}

function drawGiantHazard(ctx: CanvasRenderingContext2D, hazard: Hazard) {
  const block = 4;
  const x = Math.floor(hazard.x / block) * block;
  const y = Math.floor(hazard.y / block) * block;
  const width = Math.floor(hazard.width / block) * block;
  const height = Math.floor(hazard.height / block) * block;
  const centerX = x + width / 2;

  ctx.fillStyle = "rgba(70, 63, 26, 0.18)";
  ctx.fillRect(x + 6, y + height - 6, Math.max(12, width - 12), 8);

  ctx.fillStyle = palette.boss;
  ctx.fillRect(x + block, y + block * 3, width - block * 2, height - block * 4);
  ctx.fillRect(x + block * 2, y + block * 2, width - block * 4, block);
  ctx.fillRect(x + block * 3, y + block, width - block * 6, block);

  ctx.fillRect(x + block * 2, y + block * 2, block * 2, block * 2);
  ctx.fillRect(centerX - block * 3, y, block * 6, block * 2);
  ctx.fillRect(x + width - block * 4, y + block * 2, block * 2, block * 2);

  ctx.fillStyle = palette.poopHighlight;
  ctx.fillRect(x + block * 3, y + block * 2, Math.max(block * 4, width * 0.2), block);
  ctx.fillRect(x + block * 5, y + block * 4, Math.max(block * 3, width * 0.16), block);
  ctx.fillRect(centerX - block * 2, y + block * 6, block * 2, block);
}

function drawHazard(ctx: CanvasRenderingContext2D, hazard: Hazard) {
  if (hazard.variant === "giant") {
    drawGiantHazard(ctx, hazard);
    return;
  }

  const sprite = getHazardSprite(hazard.size);
  const color = hazard.variant === "boss" ? palette.boss : palette.poop;
  drawPixelShape(ctx, sprite.pattern, hazard.x, hazard.y, sprite.pixelSize, color);

  if (hazard.behavior === "split") {
    ctx.fillStyle = "rgba(255, 248, 241, 0.92)";
    ctx.fillRect(hazard.x + hazard.width / 2 - 2, hazard.y + 2, 4, 6);
    ctx.fillRect(hazard.x + hazard.width / 2 - 6, hazard.y + 6, 12, 2);
  } else if (hazard.behavior === "bounce") {
    ctx.strokeStyle = "rgba(70, 63, 26, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hazard.x + hazard.width / 2, hazard.y + hazard.height + 4, Math.max(8, hazard.width * 0.36), 0, Math.PI);
    ctx.stroke();
  }
}

function drawItem(ctx: CanvasRenderingContext2D, type: keyof typeof itemColorMap, x: number, y: number) {
  const sprite = itemSprites[type];
  drawPixelShape(ctx, sprite.pattern, x, y, sprite.pixelSize, itemColorMap[type]);
}

function getShakeOffset(state: GameState) {
  if (state.screenShakeTimer <= 0) {
    return { x: 0, y: 0 };
  }

  const phase = Math.max(1, Math.round(state.screenShakeTimer * 60));
  return {
    x: phase % 2 === 0 ? 5 : -5,
    y: 0,
  };
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, state.width, state.height);
  drawBackgroundDetail(ctx, state);
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, state.height - 32, state.width, 32);

  drawBurstFlash(ctx, state);

  const shake = getShakeOffset(state);
  ctx.save();
  ctx.translate(shake.x, shake.y);

  drawPlayer(ctx, state);

  for (const hazard of state.hazards) {
    drawHazard(ctx, hazard);
  }

  for (const item of state.items) {
    drawItem(ctx, item.type, item.x, item.y);
  }

  ctx.restore();
}
