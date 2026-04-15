import { randomUUID } from 'node:crypto';

import type {
  MultiplayerLeaderboardEntry,
  RecordsResponse,
  RunResultPayload,
  SingleLeaderboardEntry,
  SinglePlayerRunSession,
} from '../../../../shared/src/contracts/records.js';
import { config } from '../../config.js';
import {getMultiplayerRecordsForUser} from '../multiplayer/results.service.js';
import {listMultiplayerLeaderboard, type DbMultiplayerLeaderboardEntry} from '../multiplayer/results.repository.js';
import {
  consumeSinglePlayerRunSession,
  createRecord,
  createSinglePlayerRunSession,
  findBestRecordByMode,
  getSinglePlayerProfile,
  getSinglePlayerRunSession,
  listRecentRecords,
  listSingleLeaderboard,
  touchSinglePlayerRunSession,
  type DbSingleLeaderboardEntry,
} from './records.repository.js';

const RUN_SESSION_TTL_MS = 1000 * 60 * 60;
const MAX_RUN_SEED = 2147483646;
const HEARTBEAT_INTERVAL_SECONDS = 5;

type SaveRunResultInput = RunResultPayload & {
  runSessionId?: string;
};

function createRunSeed() {
  return Math.floor(Math.random() * MAX_RUN_SEED) + 1;
}

function estimateMaxReachableRound(mode: RunResultPayload['mode'], survivalTime: number) {
  let round = 1;
  let elapsed = 0;
  const waveDuration = mode === 'hard' ? 9 : 11;
  const bossDuration = 12;

  while (elapsed <= survivalTime + 0.001) {
    elapsed += waveDuration;
    if (elapsed > survivalTime) {
      return round;
    }
    const nextRound = round + 1;
    round = nextRound;

    const entersBoss = mode === 'hard'
      ? nextRound >= 2 && nextRound % 2 === 0
      : nextRound >= 3 && nextRound % 3 === 0;

    if (!entersBoss) {
      continue;
    }

    elapsed += bossDuration;
    if (elapsed > survivalTime) {
      return round;
    }
  }

  return round;
}

function estimateMaxReasonableScore(payload: RunResultPayload) {
  const passiveRate = payload.mode === 'hard' ? 30 : 24;
  const optimisticHazardBonus = payload.survivalTime * (payload.mode === 'hard' ? 26 : 20);
  const optimisticItemBonus = Math.ceil(payload.survivalTime / 6) * 40;
  const clearBonus = payload.clear ? 400 : 0;
  return Math.ceil(payload.survivalTime * passiveRate + optimisticHazardBonus + optimisticItemBonus + clearBonus);
}

function isVerifiedRunPayload(runSession: Awaited<ReturnType<typeof getSinglePlayerRunSession>>, payload: RunResultPayload) {
  if (!runSession) {
    return false;
  }

  if (config.isTest) {
    return true;
  }

  const startedAtMs = new Date(runSession.startedAt).getTime();
  const expiresAtMs = new Date(runSession.expiresAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
    return false;
  }

  const elapsedSeconds = Math.max(0, (now - startedAtMs) / 1000);
  if (payload.survivalTime > elapsedSeconds + 3) {
    return false;
  }

  const requiredHeartbeats = Math.max(0, Math.floor(payload.survivalTime / HEARTBEAT_INTERVAL_SECONDS) - 1);
  if (runSession.heartbeatCount < requiredHeartbeats) {
    return false;
  }

  if (payload.reachedRound > estimateMaxReachableRound(payload.mode, payload.survivalTime)) {
    return false;
  }

  if (payload.score > estimateMaxReasonableScore(payload)) {
    return false;
  }

  return true;
}

export async function createVerifiedRunSession(userId: number, mode: RunResultPayload['mode']): Promise<SinglePlayerRunSession> {
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RUN_SESSION_TTL_MS).toISOString();
  return createSinglePlayerRunSession({
    id: randomUUID(),
    userId,
    mode,
    waveSeed: createRunSeed(),
    bossSeed: createRunSeed(),
    startedAt,
    expiresAt,
  });
}

export async function heartbeatVerifiedRunSession(userId: number, runSessionId: string) {
  return touchSinglePlayerRunSession(runSessionId, userId);
}

export async function saveRunResult(userId: number, payload: SaveRunResultInput) {
  const runSession = payload.runSessionId ? await getSinglePlayerRunSession(payload.runSessionId) : null;
  const verified = !!(
    runSession
    && runSession.userId === userId
    && runSession.mode === payload.mode
    && !runSession.consumedAt
    && isVerifiedRunPayload(runSession, payload)
  );

  if (payload.runSessionId && runSession?.userId === userId && !runSession.consumedAt) {
    await consumeSinglePlayerRunSession(payload.runSessionId, userId, new Date().toISOString());
  }

  return createRecord({
    userId,
    mode: payload.mode,
    score: payload.score,
    reachedRound: payload.reachedRound,
    survivalTime: payload.survivalTime,
    clear: payload.clear,
    verified,
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
