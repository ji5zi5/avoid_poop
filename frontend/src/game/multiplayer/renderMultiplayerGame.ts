import type {MultiplayerGameSnapshot} from '../../lib/multiplayerClient';
import { getMultiplayerColorMap } from '../../lib/multiplayerColors';

function drawHazard(ctx: CanvasRenderingContext2D, hazard: MultiplayerGameSnapshot["hazards"][number]) {
  ctx.fillStyle = hazard.owner === 'boss' ? '#463f1a' : '#60492c';
  ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);

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

export function renderMultiplayerGame(
  ctx: CanvasRenderingContext2D,
  snapshot: MultiplayerGameSnapshot,
  currentUserId: number
) {
  const playerColors = getMultiplayerColorMap(snapshot.players);
  ctx.clearRect(0, 0, 360, 520);
  ctx.fillStyle = '#f9ebe0';
  ctx.fillRect(0, 0, 360, 520);
  ctx.fillStyle = '#c7b39c';
  ctx.fillRect(0, 488, 360, 32);

  ctx.fillStyle = 'rgba(96, 73, 44, 0.12)';
  for (let y = 0; y < 520; y += 32) {
    ctx.fillRect(0, y, 360, 1);
  }

  for (const hazard of snapshot.hazards) {
    drawHazard(ctx, hazard);
  }

  for (const item of snapshot.items) {
    ctx.fillStyle = '#d79f58';
    ctx.fillRect(item.x, item.y, item.width, item.height);
  }

  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';

  for (const player of snapshot.players) {
    const isSelf = player.userId === currentUserId;
    const color = playerColors.get(player.userId);
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

    ctx.fillStyle = color?.accent ?? (isSelf ? '#ce7a63' : '#60492c');
    ctx.fillRect(player.x, drawY, player.width, player.height);
    ctx.fillStyle = color?.ink ?? '#463f1a';
    ctx.fillText(player.username, player.x + player.width / 2, drawY - 8);
  }

  ctx.globalAlpha = 1;
}
