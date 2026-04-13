import { copy } from "../../content/copy";
import type { GameState, Hazard, Item, Player } from "../state";
import { applyItemEffect, showToast, triggerDamageFlash, triggerScreenShake } from "./items";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getPlayerHitbox(player: Player): Rect {
  return {
    x: player.x + 5,
    y: player.y + 4,
    width: player.width - 10,
    height: player.height - 8,
  };
}

export function getHazardHitbox(hazard: Hazard): Rect {
  const inset = hazard.variant === "giant" ? 8 : hazard.variant === "boss" ? 4 : hazard.size >= 24 ? 3 : 2;
  const verticalInset = hazard.variant === "giant" ? 6 : inset;
  return {
    x: hazard.x + inset,
    y: hazard.y + verticalInset,
    width: Math.max(8, hazard.width - inset * 2),
    height: Math.max(8, hazard.height - verticalInset * 2),
  };
}

function getItemHitbox(item: Item): Rect {
  return {
    x: item.x + 1,
    y: item.y + 1,
    width: item.size - 2,
    height: item.size - 2,
  };
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function resolveCollisions(state: GameState) {
  const playerHitbox = getPlayerHitbox(state.player);

  state.items = state.items.filter((item) => {
    if (overlaps(playerHitbox, getItemHitbox(item))) {
      applyItemEffect(state, item.type);
      state.score += 40;
      return false;
    }

    return item.y < state.height + item.size;
  });

  state.hazards = state.hazards.filter((hazard) => {
    if (hazard.y >= state.height + hazard.height) {
      state.score += 5;
      return false;
    }

    if (overlaps(playerHitbox, getHazardHitbox(hazard))) {
      if (state.invincibilityTimer <= 0) {
        state.player.lives -= 1;
        state.invincibilityTimer = 1.2;
        showToast(state, copy.game.alerts.lifeLost(state.player.lives), "danger", 1.05);
        triggerDamageFlash(state);
        triggerScreenShake(state, 0.28);
      }
      return false;
    }

    return true;
  });

  if (state.player.lives <= 0) {
    state.gameOver = true;
    showToast(state, copy.game.alerts.gameOver, "danger", 1.3);
    triggerScreenShake(state, 0.42);
    triggerDamageFlash(state, 0.65);
  }
}
