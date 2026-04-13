import { useEffect, useRef } from "react";

import { largePoopSprite, mediumPoopSprite, playerSprite, spriteHeight, spriteWidth } from "../game/rendering/pixelSprites";
import { palette } from "../game/rendering/spriteAtlas";

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

export function MenuHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FFF8F2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridTop = 20;
    const gridLeft = 18;
    const gridWidth = canvas.width - gridLeft * 2;
    const gridHeight = canvas.height - 58;

    ctx.fillStyle = "rgba(213, 167, 91, 0.08)";
    for (let x = gridLeft; x <= gridLeft + gridWidth; x += 28) {
      ctx.fillRect(x, gridTop, 1, gridHeight);
    }
    for (let y = gridTop; y <= gridTop + gridHeight; y += 28) {
      ctx.fillRect(gridLeft, y, gridWidth, 1);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(gridLeft, gridTop, gridWidth, gridHeight);

    ctx.fillStyle = "rgba(43, 30, 18, 0.12)";
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height - 20, 74, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const playerPixel = 10;
    const playerWidth = (playerSprite.pattern[0]?.length ?? 0) * playerPixel;
    const playerHeight = playerSprite.pattern.length * playerPixel;
    const playerX = Math.round((canvas.width - playerWidth) / 2);
    const playerY = canvas.height - playerHeight - 36;

    ctx.fillStyle = "rgba(70, 63, 26, 0.16)";
    ctx.fillRect(playerX + 10, playerY + playerHeight + 8, playerWidth - 20, 8);

    drawPixelShape(ctx, playerSprite.pattern, playerX, playerY, playerPixel, palette.player);
    ctx.fillStyle = palette.playerOutline;
    ctx.fillRect(playerX + 28, playerY + 40, 10, 10);
    ctx.fillRect(playerX + 52, playerY + 40, 10, 10);

    const drops = [
      { sprite: largePoopSprite, x: 54, y: 62, pixel: 8, color: palette.poop },
      { sprite: largePoopSprite, x: 252, y: 94, pixel: 8, color: palette.poop },
      { sprite: mediumPoopSprite, x: 224, y: 42, pixel: 8, color: palette.poop },
      { sprite: mediumPoopSprite, x: 118, y: 118, pixel: 8, color: palette.poopHighlight },
    ];

    for (const drop of drops) {
      drawPixelShape(ctx, drop.sprite.pattern, drop.x, drop.y, drop.pixel, drop.color);
    }

    ctx.fillStyle = "rgba(199, 179, 156, 0.95)";
    ctx.fillRect(18, canvas.height - 30, canvas.width - 36, 24);
    ctx.fillStyle = "rgba(96, 73, 44, 0.08)";
    ctx.fillRect(18, canvas.height - 30, canvas.width - 36, 4);
  }, []);

  return <canvas ref={canvasRef} className="menu-hero-canvas" width={360} height={240} />;
}
