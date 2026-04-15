import { copy } from "../../content/copy.js";
import type { GameState, ItemType, ToastTone } from "../state.js";

const itemToastMap: Record<ItemType, string> = {
  invincibility: copy.game.itemToast.invincibility,
  speed: copy.game.itemToast.speed,
  heal: copy.game.itemToast.heal,
  slow: copy.game.itemToast.slow,
  clear: copy.game.itemToast.clear,
};

const itemToastToneMap: Record<ItemType, ToastTone> = {
  invincibility: "neutral",
  speed: "reward",
  heal: "reward",
  slow: "neutral",
  clear: "reward",
};

export function showToast(state: GameState, text: string, tone: ToastTone = "neutral", duration = 1.25) {
  state.itemToastText = text;
  state.itemToastTimer = duration;
  state.itemToastTone = tone;
}

export function triggerScreenShake(state: GameState, duration = 0.35) {
  state.screenShakeTimer = Math.max(state.screenShakeTimer, duration);
}

export function triggerDamageFlash(state: GameState, duration = 0.4) {
  state.damageFlashTimer = Math.max(state.damageFlashTimer, duration);
}

function triggerItemBurst(state: GameState, type: ItemType) {
  state.effectBurstTimer = 0.42;
  state.effectBurstType = type;
}

function showItemToast(state: GameState, type: ItemType) {
  showToast(state, itemToastMap[type], itemToastToneMap[type], 1.15);
}

export function applyItemEffect(state: GameState, type: ItemType) {
  showItemToast(state, type);
  triggerItemBurst(state, type);
  if (type === "clear") {
    triggerScreenShake(state, 0.14);
  }

  switch (type) {
    case "invincibility":
      state.invincibilityTimer = 4;
      break;
    case "speed":
      state.speedBoostTimer = 4;
      break;
    case "heal":
      state.player.lives = Math.min(3, state.player.lives + 1);
      break;
    case "slow":
      state.slowMotionTimer = 4;
      break;
    case "clear":
      state.hazards = [];
      break;
  }
}
