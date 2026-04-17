import type { GameMode } from "../../../shared/src/contracts/index.js";
import { getSharedWaveSpawnThreshold } from "../../../shared/src/index.js";

import { createInitialState } from "./state.js";
import type { GameState, Hazard, Item } from "./state.js";
import { resolveCollisions } from "./systems/collision.js";
import { runBossPattern } from "./systems/bossPatterns.js";
import { updateRounds } from "./systems/rounds.js";
import { createCustomHazard, maybeSpawnItem, spawnWavePattern } from "./systems/spawn.js";

function buildSplitVelocityProfile(count: number) {
  if (count <= 1) {
    return [0];
  }

  const midpoint = (count - 1) / 2;
  const maxOffset = Math.max(0.5, midpoint);
  return Array.from({ length: count }, (_, index) => (index - midpoint) / maxOffset);
}

function isNightmareMode(state: GameState) {
  return state.mode === "nightmare";
}

function isHardOrAbove(state: GameState) {
  return state.mode !== "normal";
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
    const spawnThreshold = getSharedWaveSpawnThreshold(state.mode, state.round);
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

      const childCount = Math.max(2, hazard.splitChildCount ?? 2);
      const childSize = hazard.splitChildSize ?? 14;
      const childSpeed = hazard.splitChildSpeed ?? Math.max(150, hazard.speed * 0.84);
      const childSpread = hazard.splitChildSpread ?? 64;
      const childY = Math.max(0, hazard.y - childSize * 0.4);
      const hazardCenter = hazard.x + hazard.width / 2;
      const spawnOffset = Math.max(childSize * 0.95, hazard.width * 0.42);
      const velocityProfile = buildSplitVelocityProfile(childCount);

      velocityProfile.forEach((velocityFactor) => {
        const child = createCustomHazard(state, {
          x: hazardCenter + velocityFactor * spawnOffset - childSize / 2,
          size: childSize,
          speed: childSpeed,
          owner: hazard.owner,
          variant: childSize >= 20 ? "medium" : "small",
          velocityX: childSpread * velocityFactor,
          gravity: 220,
        });
        child.y = childY;
      });
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
          ? isNightmareMode(state) ? 132 : isHardOrAbove(state) ? 110 : 74
          : isNightmareMode(state) ? -132 : isHardOrAbove(state) ? -110 : -74;
        return;
      }

      if ((hazard.bouncesRemaining ?? 0) === 0 && hazard.triggered && hazard.speed > 0 && hazard.y >= floorContactY) {
        hazard.pendingRemoval = true;
        hazard.awardOnExit = false;
      }
    }

    if (hazard.behavior === "ricochet") {
      const hitLeftWall = hazard.x <= 0 && (hazard.velocityX ?? 0) < 0;
      const hitRightWall = hazard.x + hazard.width >= state.width && (hazard.velocityX ?? 0) > 0;
      if ((hazard.bouncesRemaining ?? 0) > 0 && (hitLeftWall || hitRightWall)) {
        hazard.x = Math.max(0, Math.min(state.width - hazard.width, hazard.x));
        hazard.velocityX = -(hazard.velocityX ?? 0);
        hazard.bouncesRemaining = (hazard.bouncesRemaining ?? 1) - 1;
        hazard.triggered = true;
        return;
      }
      if ((hazard.bouncesRemaining ?? 0) === 0 && (hitLeftWall || hitRightWall)) {
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
    state.score += delta * (
      state.currentPhase === "boss"
        ? isNightmareMode(state) ? 38 : isHardOrAbove(state) ? 30 : 24
        : isNightmareMode(state) ? 22 : isHardOrAbove(state) ? 17 : 14
    );
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
