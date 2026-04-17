import type {MultiplayerGameSnapshot} from '../../lib/multiplayerClient';
import { getMultiplayerColorMap } from '../../lib/multiplayerColors';
import { getHazardSprite, itemSprites, playerSprite } from '../rendering/pixelSprites.js';
import { palette } from '../rendering/spriteAtlas.js';

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
    row.split('').forEach((cell, colIndex) => {
      if (cell === '1') {
        ctx.fillRect(x + colIndex * pixelSize, y + rowIndex * pixelSize, pixelSize, pixelSize);
      }
    });
  });
}

function drawBackgroundDetail(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = palette.cloud;
  ctx.fillRect(32, 42, 70, 10);
  ctx.fillRect(220, 70, 88, 12);
  ctx.fillStyle = palette.line;
  for (let y = 0; y < 520; y += 32) {
    ctx.fillRect(0, y, 360, 1);
  }
}

function drawGiantHazard(ctx: CanvasRenderingContext2D, hazard: MultiplayerGameSnapshot['hazards'][number]) {
  const block = 4;
  const x = Math.floor(hazard.x / block) * block;
  const y = Math.floor(hazard.y / block) * block;
  const width = Math.floor(hazard.width / block) * block;
  const height = Math.floor(hazard.height / block) * block;
  const centerX = x + width / 2;

  ctx.fillStyle = 'rgba(70, 63, 26, 0.18)';
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

function drawBounceMarker(ctx: CanvasRenderingContext2D, hazard: MultiplayerGameSnapshot['hazards'][number]) {
  const markerX = hazard.x + hazard.width / 2;
  const markerY = hazard.y + hazard.height + 4;
  const markerRadius = Math.max(8, hazard.width * 0.36);

  ctx.strokeStyle = 'rgba(70, 63, 26, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(markerX, markerY, markerRadius, 0, Math.PI);
  ctx.stroke();

  if ((hazard.bouncesRemaining ?? 0) < 2) {
    return;
  }

  ctx.strokeStyle = 'rgba(255, 248, 241, 0.92)';
  ctx.beginPath();
  ctx.arc(markerX, markerY - 6, Math.max(5, markerRadius - 4), 0, Math.PI);
  ctx.stroke();

  if ((hazard.bouncesRemaining ?? 0) >= 3) {
    ctx.fillStyle = 'rgba(255, 248, 241, 0.92)';
    ctx.fillRect(markerX - 5, markerY - 12, 10, 2);
  }
}

function drawHazard(ctx: CanvasRenderingContext2D, hazard: MultiplayerGameSnapshot['hazards'][number]) {
  if (hazard.variant === 'giant') {
    drawGiantHazard(ctx, hazard);
    return;
  }

  const sprite = getHazardSprite(Math.max(hazard.width, hazard.height));
  const color = hazard.variant === 'boss' ? palette.boss : palette.poop;
  drawPixelShape(ctx, sprite.pattern, hazard.x, hazard.y, sprite.pixelSize, color);

  if (hazard.behavior === 'split') {
    ctx.fillStyle = 'rgba(255, 248, 241, 0.92)';
    ctx.fillRect(hazard.x + hazard.width / 2 - 2, hazard.y + 2, 4, 6);
    ctx.fillRect(hazard.x + hazard.width / 2 - 6, hazard.y + 6, 12, 2);
  } else if (hazard.behavior === 'bounce') {
    drawBounceMarker(ctx, hazard);
  }
}

function drawItem(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const sprite = itemSprites.clear;
  drawPixelShape(ctx, sprite.pattern, x, y, sprite.pixelSize, palette.clear);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: MultiplayerGameSnapshot['players'][number],
  currentUserId: number,
  accent: string,
  ink: string,
) {
  const isSelf = player.userId === currentUserId;
  const drawY = player.airborneUntil ? player.y - 18 : player.y;

  if (player.status === 'spectator') {
    ctx.globalAlpha = 0.45;
  } else if (player.status === 'disconnected') {
    ctx.globalAlpha = 0.6;
  } else {
    ctx.globalAlpha = 1;
  }

  if (player.airborneUntil) {
    ctx.fillStyle = 'rgba(70, 63, 26, 0.16)';
    ctx.fillRect(player.x + 4, player.y + player.height, player.width - 8, 4);
  }

  ctx.fillStyle = 'rgba(70, 63, 26, 0.18)';
  ctx.fillRect(player.x + 4, drawY + 22, 28, 6);
  drawPixelShape(ctx, playerSprite.pattern, player.x, drawY, playerSprite.pixelSize, accent);

  if (isSelf) {
    ctx.fillStyle = palette.playerMarker;
    ctx.fillRect(player.x + 16, drawY - 10, 4, 6);
    ctx.fillRect(player.x + 12, drawY - 4, 12, 4);
  }

  ctx.fillStyle = ink;
  ctx.fillRect(player.x + 12, drawY + 12, 4, 4);
  ctx.fillRect(player.x + 20, drawY + 12, 4, 4);

  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.fillText(player.username, player.x + player.width / 2, drawY - 8);
  ctx.globalAlpha = 1;
}

export function renderMultiplayerGame(
  ctx: CanvasRenderingContext2D,
  snapshot: MultiplayerGameSnapshot,
  currentUserId: number,
) {
  const playerColors = getMultiplayerColorMap(snapshot.players);
  ctx.clearRect(0, 0, 360, 520);
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, 360, 520);
  drawBackgroundDetail(ctx);
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 488, 360, 32);

  for (const hazard of snapshot.hazards) {
    drawHazard(ctx, hazard);
  }

  for (const item of snapshot.items) {
    drawItem(ctx, item.x, item.y);
  }

  for (const player of snapshot.players) {
    const color = playerColors.get(player.userId);
    drawPlayer(
      ctx,
      player,
      currentUserId,
      color?.accent ?? palette.player,
      color?.ink ?? palette.playerOutline,
    );
  }
}
