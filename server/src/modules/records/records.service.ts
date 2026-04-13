import type {
  MultiplayerLeaderboardEntry,
  RecordsResponse,
  RunResultPayload,
  SingleLeaderboardEntry,
} from '../../../../shared/src/contracts/records.js';
import {getMultiplayerRecordsForUser} from '../multiplayer/results.service.js';
import {listMultiplayerLeaderboard} from '../multiplayer/results.repository.js';
import {createRecord, findBestRecordByMode, getSinglePlayerProfile, listRecentRecords, listSingleLeaderboard} from './records.repository.js';

export function saveRunResult(userId: number, payload: RunResultPayload) {
  return createRecord({
    userId,
    mode: payload.mode,
    score: payload.score,
    reachedRound: payload.reachedRound,
    survivalTime: payload.survivalTime,
    clear: payload.clear
  });
}

function rankSingle(entries: ReturnType<typeof listSingleLeaderboard>) {
  return entries.map((entry, index) => ({
    rank: index + 1,
    ...entry
  })) satisfies SingleLeaderboardEntry[];
}

function rankMultiplayer(entries: ReturnType<typeof listMultiplayerLeaderboard>) {
  return entries.map((entry, index) => ({
    rank: index + 1,
    ...entry
  })) satisfies MultiplayerLeaderboardEntry[];
}

export function getRecordsForUser(userId: number): RecordsResponse {
  return {
    profile: getSinglePlayerProfile(userId),
    best: {
      normal: findBestRecordByMode(userId, 'normal') ?? undefined,
      hard: findBestRecordByMode(userId, 'hard') ?? undefined
    },
    recent: listRecentRecords(userId),
    multiplayer: getMultiplayerRecordsForUser(userId),
    leaderboard: {
      normal: rankSingle(listSingleLeaderboard('normal')),
      hard: rankSingle(listSingleLeaderboard('hard')),
      multiplayer: rankMultiplayer(listMultiplayerLeaderboard())
    }
  };
}
