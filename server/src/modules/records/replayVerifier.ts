import type { RankedRunSubmission } from '../../../../shared/src/contracts/records.js';
import { createGameEngine, updateGame } from '../../../../frontend/src/game/engine.js';
import { toRunResult } from '../../../../frontend/src/game/state.js';

type ReplayVerificationInput = {
  bossSeed: number;
  mode: RankedRunSubmission['mode'];
  replayFrames: NonNullable<RankedRunSubmission['replayFrames']>;
  wallClockElapsedMs: number;
  waveSeed: number;
};

const MAX_WALLCLOCK_DRIFT_MS = 5_000;

export function replayVerifiedSinglePlayerRun(input: ReplayVerificationInput) {
  const state = createGameEngine(input.mode, {
    waveSeed: input.waveSeed,
    bossSeed: input.bossSeed,
  });

  let elapsedMs = 0;
  for (const frame of input.replayFrames) {
    elapsedMs += frame.deltaMs;
    updateGame(state, frame.deltaMs / 1000, frame.direction);
    if (state.gameOver) {
      break;
    }
  }

  if (!state.gameOver) {
    return null;
  }

  if (elapsedMs > input.wallClockElapsedMs + MAX_WALLCLOCK_DRIFT_MS) {
    return null;
  }

  return toRunResult(state);
}
