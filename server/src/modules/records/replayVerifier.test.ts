import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameEngine, updateGame } from '../../../../frontend/src/game/engine.js';
import { replayVerifiedSinglePlayerRun } from './replayVerifier.js';

test('replay verification reproduces a simple completed run', () => {
  const state = createGameEngine('normal', { waveSeed: 123, bossSeed: 456 });
  const replayFrames = [];
  while (!state.gameOver && replayFrames.length < 5000) {
    replayFrames.push({ deltaMs: 16.6, direction: 0 as const });
    updateGame(state, 0.0166, 0);
  }

  const result = replayVerifiedSinglePlayerRun({
    mode: 'normal',
    waveSeed: 123,
    bossSeed: 456,
    wallClockElapsedMs: replayFrames.reduce((sum, frame) => sum + frame.deltaMs, 0) + 1000,
    replayFrames,
  });

  assert.equal(result !== null, true);
  assert.equal(result?.mode, 'normal');
  assert.ok((result?.score ?? 0) > 0);
  assert.ok((result?.reachedRound ?? 0) >= 1);
  assert.ok((result?.survivalTime ?? 0) > 0);
});
