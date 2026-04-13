import type { GameMode } from "../../../shared/src/contracts/index";

import { createInitialState } from "./state";
import type { GameState } from "./state";
import { resolveCollisions } from "./systems/collision";
import { runBossPattern } from "./systems/bossPatterns";
import { updateRounds } from "./systems/rounds";
import { maybeSpawnItem, spawnHazard } from "./systems/spawn";

function wavePressure(state: GameState) {
  return Math.min(state.mode === "hard" ? 14 : 13, Math.max(0, state.round - 1));
}

export function updateGame(state: GameState, delta: number, direction: number) {
  if (state.gameOver) {
    return state;
  }

  const isBossDrain = state.pendingBossClearAnnouncement;
  const allowRunEconomy = !isBossDrain;

  state.phaseAnnouncementTimer = Math.max(0, state.phaseAnnouncementTimer - delta);
  if (state.phaseAnnouncementTimer === 0 && state.phaseAnnouncementText) {
    state.phaseAnnouncementText = "";
  }
  state.itemToastTimer = Math.max(0, state.itemToastTimer - delta);
  if (state.itemToastTimer === 0 && state.itemToastText) {
    state.itemToastText = "";
    state.itemToastTone = "neutral";
  }
  state.effectBurstTimer = Math.max(0, state.effectBurstTimer - delta);
  if (state.effectBurstTimer === 0) {
    state.effectBurstType = null;
  }
  state.screenShakeTimer = Math.max(0, state.screenShakeTimer - delta);
  state.damageFlashTimer = Math.max(0, state.damageFlashTimer - delta);
  if (allowRunEconomy) {
    state.survivalTime += delta;
  }
  if (state.currentPhase === "boss") {
    state.elapsedInPhase += delta;
    state.spawnTimer = 0;
  } else if (state.pendingBossClearAnnouncement) {
    state.spawnTimer = 0;
  } else {
    state.elapsedInPhase += delta;
    state.spawnTimer += delta;
  }
  if (allowRunEconomy) {
    state.itemTimer += delta;
  }
  state.invincibilityTimer = Math.max(0, state.invincibilityTimer - delta);
  state.speedBoostTimer = Math.max(0, state.speedBoostTimer - delta);
  state.slowMotionTimer = Math.max(0, state.slowMotionTimer - delta);

  const speedMultiplier = state.speedBoostTimer > 0 ? 1.6 : 1;
  state.player.x = Math.max(
    0,
    Math.min(state.width - state.player.width, state.player.x + direction * state.player.speed * speedMultiplier * delta),
  );

  if (state.currentPhase === "boss") {
    runBossPattern(state, delta);
  } else if (state.pendingBossClearAnnouncement === false) {
    const pressure = wavePressure(state);
    const waveSpawnBase = state.mode === "hard" ? 0.88 : 0.98;
    const waveSpawnFloor = state.mode === "hard" ? 0.14 : 0.2;
    const waveDecay = state.mode === "hard" ? 0.072 : 0.066;
    const spawnThreshold = Math.max(waveSpawnFloor, waveSpawnBase - pressure * waveDecay);
    if (state.spawnTimer >= spawnThreshold) {
      state.spawnTimer = 0;
      spawnHazard(state);
    }
  }

  if (allowRunEconomy) {
    maybeSpawnItem(state);
  }

  const hazardMultiplier = state.slowMotionTimer > 0 ? 0.5 : 1;
  state.hazards.forEach((hazard) => {
    hazard.y += hazard.speed * hazardMultiplier * delta;
  });
  state.items.forEach((item) => {
    item.y += item.speed * delta;
  });

  resolveCollisions(state);
  updateRounds(state);
  if (allowRunEconomy) {
    state.score += delta * (state.currentPhase === "boss" ? (state.mode === "hard" ? 30 : 24) : state.mode === "hard" ? 17 : 14);
  }
  return state;
}

export function createGameEngine(mode: GameMode) {
  return createInitialState(mode);
}
