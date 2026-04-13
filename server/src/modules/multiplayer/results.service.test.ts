import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {hashPassword} from '../../utils/password.js';
import {createUser} from '../auth/auth.repository.js';
import {MultiplayerGameService} from './game.service.js';
import {getMultiplayerRecordsForUser, saveCompletedMultiplayerGame} from './results.service.js';
import {resetDbForTests} from '../../db/client.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-results-test.sqlite');
process.env.DB_PATH = dbPath;

test.afterEach(() => {
  resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('completed multiplayer games are persisted and exposed as stats/recent records', () => {
  const alpha = createUser('mp_alpha', hashPassword('secret123'));
  const beta = createUser('mp_beta', hashPassword('secret123'));
  const gamma = createUser('mp_gamma', hashPassword('secret123'));

  const gameService = new MultiplayerGameService();
  const game = gameService.createGame({
    roomCode: 'ROOM42',
    hostUserId: alpha.id,
    status: 'in_progress',
    maxPlayers: 8,
    playerCount: 3,
    players: [
      {userId: alpha.id, username: alpha.username, isHost: true, ready: true},
      {userId: beta.id, username: beta.username, isHost: false, ready: true},
      {userId: gamma.id, username: gamma.username, isHost: false, ready: true}
    ],
    options: {difficulty: 'normal', bodyBlock: false, debuffTier: 2},
    chatMessages: []
  });

  gameService.applyPlayerHit(game, gamma.id, 3);
  gameService.applyPlayerHit(game, beta.id, 3);
  saveCompletedMultiplayerGame(game);

  const alphaRecords = getMultiplayerRecordsForUser(alpha.id);
  const gammaRecords = getMultiplayerRecordsForUser(gamma.id);

  assert.equal(alphaRecords.stats.matchesPlayed, 1);
  assert.equal(alphaRecords.stats.wins, 1);
  assert.equal(alphaRecords.stats.bestPlacement, 1);
  assert.equal(alphaRecords.recent[0]?.placement, 1);
  assert.equal(alphaRecords.recent[0]?.won, true);

  assert.equal(gammaRecords.stats.bestPlacement, 3);
  assert.equal(gammaRecords.recent[0]?.placement, 3);
  assert.equal(gammaRecords.recent[0]?.won, false);
});
