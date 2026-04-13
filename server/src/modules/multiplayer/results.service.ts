import type {MultiplayerRecordEntry, MultiplayerStats} from '../../../../shared/src/contracts/records.js';

import type {MultiplayerGameState} from './game.types.js';
import {createMultiplayerMatch, getMultiplayerStats, listRecentMultiplayerRecords} from './results.repository.js';

export function saveCompletedMultiplayerGame(game: MultiplayerGameState) {
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

export function getMultiplayerRecordsForUser(userId: number): {stats: MultiplayerStats; recent: MultiplayerRecordEntry[]} {
  return {
    stats: getMultiplayerStats(userId),
    recent: listRecentMultiplayerRecords(userId) as MultiplayerRecordEntry[]
  };
}
