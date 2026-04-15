import type {
  MultiplayerLeaderboardEntry,
  RecordsResponse,
  RunResultPayload,
  SingleLeaderboardEntry,
} from '../../../../shared/src/contracts/records.js';
import {getMultiplayerRecordsForUser} from '../multiplayer/results.service.js';
import {listMultiplayerLeaderboard, type DbMultiplayerLeaderboardEntry} from '../multiplayer/results.repository.js';
import {createRecord, findBestRecordByMode, getSinglePlayerProfile, listRecentRecords, listSingleLeaderboard, type DbSingleLeaderboardEntry} from './records.repository.js';

export async function saveRunResult(userId: number, payload: RunResultPayload) {
  return createRecord({
    userId,
    mode: payload.mode,
    score: payload.score,
    reachedRound: payload.reachedRound,
    survivalTime: payload.survivalTime,
    clear: payload.clear
  });
}

function rankSingle(entries: DbSingleLeaderboardEntry[]) {
  return entries.map((entry, index) => ({
    rank: index + 1,
    ...entry
  })) satisfies SingleLeaderboardEntry[];
}

function rankMultiplayer(entries: DbMultiplayerLeaderboardEntry[]) {
  return entries.map((entry, index) => ({
    rank: index + 1,
    ...entry
  })) satisfies MultiplayerLeaderboardEntry[];
}

export async function getRecordsForUser(userId: number): Promise<RecordsResponse> {
  const [profile, normalBest, hardBest, recent, multiplayer, normalLeaderboard, hardLeaderboard, multiplayerLeaderboard] = await Promise.all([
    getSinglePlayerProfile(userId),
    findBestRecordByMode(userId, 'normal'),
    findBestRecordByMode(userId, 'hard'),
    listRecentRecords(userId),
    getMultiplayerRecordsForUser(userId),
    listSingleLeaderboard('normal'),
    listSingleLeaderboard('hard'),
    listMultiplayerLeaderboard(),
  ]);

  return {
    profile,
    best: {
      normal: normalBest ?? undefined,
      hard: hardBest ?? undefined
    },
    recent,
    multiplayer,
    leaderboard: {
      normal: rankSingle(normalLeaderboard),
      hard: rankSingle(hardLeaderboard),
      multiplayer: rankMultiplayer(multiplayerLeaderboard)
    }
  };
}
