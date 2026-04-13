import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createApp } from '../../app.js';
import { resetDbForTests } from '../../db/client.js';
import { MultiplayerGameService } from '../multiplayer/game.service.js';
import { saveCompletedMultiplayerGame } from '../multiplayer/results.service.js';

const dbPath = path.join(process.cwd(), 'data', 'avoid-poop-records-leaderboard-test.sqlite');
process.env.DB_PATH = dbPath;

test.afterEach(() => {
  resetDbForTests();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test('records endpoint ranks multiplayer leaderboard by public-facing standings', async () => {
  const app = await createApp();

  const alpha = await signup(app, 'records_alpha');
  const beta = await signup(app, 'records_beta');
  const gamma = await signup(app, 'records_gamma');

  persistCompletedGame({
    roomCode: 'ROOMA1',
    round: 7,
    players: [alpha.user, beta.user, gamma.user],
    eliminatedUserIds: [gamma.user.id, beta.user.id],
  });
  persistCompletedGame({
    roomCode: 'ROOMB1',
    round: 6,
    players: [beta.user, alpha.user, gamma.user],
    eliminatedUserIds: [gamma.user.id, alpha.user.id],
  });
  persistCompletedGame({
    roomCode: 'ROOMC1',
    round: 8,
    players: [beta.user, alpha.user],
    eliminatedUserIds: [alpha.user.id],
  });

  const records = await app.inject({
    method: 'GET',
    url: '/api/records',
    cookies: {
      avoid_poop_session: alpha.cookie,
    },
  });

  assert.equal(records.statusCode, 200);
  const body = records.json();

  assert.deepEqual(
    body.leaderboard.multiplayer.map((entry: { rank: number; username: string; wins: number; matchesPlayed: number; bestPlacement: number | null; bestReachedRound: number | null }) => ({
      rank: entry.rank,
      username: entry.username,
      wins: entry.wins,
      matchesPlayed: entry.matchesPlayed,
      bestPlacement: entry.bestPlacement,
      bestReachedRound: entry.bestReachedRound,
    })),
    [
      {
        rank: 1,
        username: 'records_beta',
        wins: 2,
        matchesPlayed: 3,
        bestPlacement: 1,
        bestReachedRound: 8,
      },
      {
        rank: 2,
        username: 'records_alpha',
        wins: 1,
        matchesPlayed: 3,
        bestPlacement: 1,
        bestReachedRound: 8,
      },
      {
        rank: 3,
        username: 'records_gamma',
        wins: 0,
        matchesPlayed: 2,
        bestPlacement: 3,
        bestReachedRound: 7,
      },
    ],
  );

  assert.equal(body.multiplayer.stats.matchesPlayed, 3);
  assert.equal(body.multiplayer.stats.wins, 1);
  assert.equal(body.multiplayer.stats.bestPlacement, 1);
  await app.close();
});

type SignedUpUser = {
  cookie: string;
  user: {
    id: number;
    username: string;
  };
};

async function signup(app: Awaited<ReturnType<typeof createApp>>, username: string): Promise<SignedUpUser> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      username,
      password: 'secret123',
    },
  });

  assert.equal(response.statusCode, 200);
  return {
    cookie: response.cookies[0]!.value,
    user: response.json().user,
  };
}

function persistCompletedGame(input: {
  roomCode: string;
  round: number;
  players: Array<{ id: number; username: string }>;
  eliminatedUserIds: number[];
}) {
  const gameService = new MultiplayerGameService();
  const game = gameService.createGame({
    roomCode: input.roomCode,
    hostUserId: input.players[0]!.id,
    status: 'in_progress',
    maxPlayers: 8,
    playerCount: input.players.length,
    players: input.players.map((player, index) => ({
      userId: player.id,
      username: player.username,
      isHost: index === 0,
      ready: true,
    })),
    options: {
      difficulty: 'normal',
      visibility: 'public',
      bodyBlock: false,
      debuffTier: 2,
    },
    chatMessages: [],
  });

  game.round = input.round;
  for (const userId of input.eliminatedUserIds) {
    gameService.applyPlayerHit(game, userId, 3);
  }

  saveCompletedMultiplayerGame(game);
}
