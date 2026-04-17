import { copy } from "../../content/copy.js";
import { BOSS_DURATION, ROUND_DURATION } from "../state.js";
import type { GameState } from "../state.js";
import { getBossThemeLabel, hasBossSequenceRemaining, initializeBossEncounter } from "./bossPatterns.js";
import { showToast, triggerScreenShake } from "./items.js";
import { syncWaveDirectorForRound } from "./spawn.js";

const PHASE_ANNOUNCEMENT_DURATION = 1.4;

function currentRoundDuration(state: GameState) {
  if (state.mode === "nightmare") {
    return ROUND_DURATION - 1.5;
  }
  return state.mode === "hard" ? ROUND_DURATION : ROUND_DURATION + 2;
}

function currentBossDuration(state: GameState) {
  return Math.max(BOSS_DURATION, state.bossEncounterDuration);
}

function shouldEnterBoss(state: GameState, nextRound: number) {
  if (state.mode === "nightmare") {
    return nextRound >= 2;
  }
  return state.mode === "hard" ? nextRound >= 2 && nextRound % 2 === 0 : nextRound >= 3 && nextRound % 3 === 0;
}

function hasActiveBossHazards(state: GameState) {
  return state.hazards.some((hazard) => hazard.owner === "boss");
}

function resetBossRuntime(state: GameState) {
  state.bossThemeId = null;
  state.bossPatternQueue = [];
  state.bossPatternIndex = 0;
  state.bossPatternActiveId = null;
  state.bossPatternPhase = "idle";
  state.bossPatternStepTimer = 0;
  state.bossPatternShots = 0;
  state.bossPatternTimer = 0;
  state.bossTelegraphText = "";
  state.bossTelegraphTimer = 0;
}

function exitBossPhase(state: GameState) {
  state.currentPhase = "wave";
  state.elapsedInPhase = 0;
  state.spawnTimer = 0;
  state.pendingBossClearAnnouncement = hasActiveBossHazards(state);
  resetBossRuntime(state);

  if (!state.pendingBossClearAnnouncement) {
    state.phaseAnnouncementTimer = PHASE_ANNOUNCEMENT_DURATION;
    state.phaseAnnouncementText = copy.transitions.bossCleared;
    showToast(state, copy.game.alerts.bossCleared, "reward", 0.95);
  }
}

export function updateRounds(state: GameState) {
  if (state.pendingBossClearAnnouncement && hasActiveBossHazards(state) === false) {
    state.pendingBossClearAnnouncement = false;
    state.phaseAnnouncementTimer = PHASE_ANNOUNCEMENT_DURATION;
    state.phaseAnnouncementText = copy.transitions.bossCleared;
    showToast(state, copy.game.alerts.bossCleared, "reward", 0.95);
  }

  if (state.currentPhase === "wave" && state.pendingBossClearAnnouncement === false && state.elapsedInPhase >= currentRoundDuration(state)) {
    const nextRound = state.round + 1;
    const previousLives = state.player.lives;
    state.round = nextRound;
    state.reachedRound = Math.max(state.reachedRound, state.round);
    if (state.mode !== "nightmare") {
      state.player.lives = Math.min(3, state.player.lives + 1);
    }
    state.elapsedInPhase = 0;
    state.spawnTimer = 0;
    state.pendingBossClearAnnouncement = false;
    syncWaveDirectorForRound(state, nextRound);

    if (shouldEnterBoss(state, nextRound)) {
      state.currentPhase = "boss";
      initializeBossEncounter(state);
      state.phaseAnnouncementTimer = PHASE_ANNOUNCEMENT_DURATION;
      state.phaseAnnouncementText = `${copy.transitions.bossIncoming} · ${getBossThemeLabel(state.bossThemeId)}`;
      showToast(state, copy.game.alerts.bossIncoming, "boss", 1.15);
      triggerScreenShake(state, 0.5);
    } else {
      state.currentPhase = "wave";
      state.phaseAnnouncementTimer = PHASE_ANNOUNCEMENT_DURATION;
      state.phaseAnnouncementText = copy.transitions.nextRound(state.round);
      resetBossRuntime(state);
    }

    if (state.player.lives > previousLives) {
      showToast(state, copy.game.alerts.roundRecovered, "reward", 1.05);
    }
  }

  if (state.currentPhase === "boss") {
    const bossSequenceFinished = hasBossSequenceRemaining(state) === false;
    const bossTimedOut = state.elapsedInPhase >= currentBossDuration(state);
    if (bossSequenceFinished || bossTimedOut) {
      exitBossPhase(state);
    }
  }
}
