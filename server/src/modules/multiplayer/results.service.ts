import type {MultiplayerRecordEntry, MultiplayerStats} from '../../../../shared/src/contracts/records.js';

import type {MultiplayerGameState} from './game.types.js';
import {createMultiplayerMatch, getMultiplayerStats, listRecentMultiplayerRecords} from './results.repository.js';

export async function saveCompletedMultiplayerGame(game: MultiplayerGameState) {
  const totalPlayers = game.players.length;
  const orderedUserIds = [...game.placementOrder];
  const seen = new Set(orderedUserIds);
  for (const player of game.players) {
    if (!seen.has(player.userId)) {
      orderedUserIds.push(player.userId);
    }
  }

  const placements = orderedUserIds.map((userId, index) => ({
    userId,
    placement: totalPlayers - index,
    totalPlayers,
    reachedRound: game.round,
    won: userId === game.winnerUserId
  }));

  return createMultiplayerMatch({
    roomCode: game.roomCode,
    winnerUserId: game.winnerUserId,
    totalPlayers,
    reachedRound: game.round,
    placements
  });
}

export async function getMultiplayerRecordsForUser(userId: number): Promise<{stats: MultiplayerStats; recent: MultiplayerRecordEntry[]}> {
  const [stats, recent] = await Promise.all([
    getMultiplayerStats(userId),
    listRecentMultiplayerRecords(userId),
  ]);

  return {
    stats,
    recent: recent as MultiplayerRecordEntry[]
  };
}
