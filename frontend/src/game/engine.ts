import type { GameMode } from "../../../shared/src/contracts/index.js";

import { createInitialState } from "./state.js";
import type { GameState, Hazard, Item } from "./state.js";
import { resolveCollisions } from "./systems/collision.js";
import { runBossPattern } from "./systems/bossPatterns.js";
import { updateRounds } from "./systems/rounds.js";
import { createCustomHazard, maybeSpawnItem, spawnWavePattern } from "./systems/spawn.js";

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
    const waveSpawnBase = state.mode === "hard" ? 0.82 : 0.93;
    const waveSpawnFloor = state.mode === "hard" ? 0.12 : 0.17;
    const waveDecay = state.mode === "hard" ? 0.076 : 0.07;
    const spawnThreshold = Math.max(waveSpawnFloor, waveSpawnBase - pressure * waveDecay);
    if (state.spawnTimer >= spawnThreshold) {
      state.spawnTimer = 0;
      spawnWavePattern(state);
    }
  }

  if (allowRunEconomy) {
    maybeSpawnItem(state);
  }

  const hazardMultiplier = state.slowMotionTimer > 0 ? 0.5 : 1;
  const groundY = state.height - 32;

  state.hazards.forEach((hazard: Hazard) => {
    const motionDelta = delta * hazardMultiplier;
    hazard.x += (hazard.velocityX ?? 0) * motionDelta;
    hazard.y += hazard.speed * motionDelta;
    if (hazard.gravity) {
      hazard.speed += hazard.gravity * motionDelta;
    }

    if (hazard.behavior === "split" && !hazard.triggered && hazard.splitAtY !== undefined && hazard.y >= hazard.splitAtY) {
      hazard.triggered = true;
      hazard.pendingRemoval = true;
      hazard.awardOnExit = false;

      const childSize = hazard.splitChildSize ?? 14;
      const childSpeed = hazard.splitChildSpeed ?? Math.max(150, hazard.speed * 0.84);
      const childSpread = hazard.splitChildSpread ?? 64;
      const childY = Math.max(0, hazard.y - childSize * 0.4);

      const leftChild = createCustomHazard(state, {
        x: hazard.x - childSize * 0.2,
        size: childSize,
        speed: childSpeed,
        owner: hazard.owner,
        variant: childSize >= 20 ? "medium" : "small",
        velocityX: -childSpread,
        gravity: 220,
      });
      leftChild.y = childY;

      const rightChild = createCustomHazard(state, {
        x: hazard.x + hazard.width - childSize * 0.8,
        size: childSize,
        speed: childSpeed,
        owner: hazard.owner,
        variant: childSize >= 20 ? "medium" : "small",
        velocityX: childSpread,
        gravity: 220,
      });
      rightChild.y = childY;
      return;
    }

    if (hazard.behavior === "bounce") {
      const floorContactY = groundY - hazard.height;
      if ((hazard.bouncesRemaining ?? 0) > 0 && hazard.y >= floorContactY) {
        hazard.y = floorContactY;
        hazard.bouncesRemaining = (hazard.bouncesRemaining ?? 1) - 1;
        hazard.triggered = true;
        hazard.speed = -Math.max(230, Math.abs(hazard.speed) * 0.94);
        hazard.gravity = 390;
        hazard.velocityX = hazard.x + hazard.width / 2 < state.width / 2
          ? state.mode === "hard" ? 110 : 74
          : state.mode === "hard" ? -110 : -74;
        return;
      }

      if ((hazard.bouncesRemaining ?? 0) === 0 && hazard.triggered && hazard.speed > 0 && hazard.y >= floorContactY) {
        hazard.pendingRemoval = true;
        hazard.awardOnExit = false;
      }
    }
  });

  state.items.forEach((item: Item) => {
    item.y += item.speed * delta;
  });

  resolveCollisions(state);
  updateRounds(state);
  if (allowRunEconomy) {
    state.score += delta * (state.currentPhase === "boss" ? (state.mode === "hard" ? 30 : 24) : state.mode === "hard" ? 17 : 14);
  }
  return state;
}

export function createGameEngine(
  mode: GameMode,
  seedOverrides?: {
    waveSeed?: number;
    bossSeed?: number;
  },
) {
  return createInitialState(mode, seedOverrides);
}
