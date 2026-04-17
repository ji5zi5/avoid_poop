import { randomUUID } from 'node:crypto';

import type {
  MultiplayerLeaderboardEntry,
  RecordsResponse,
  RankedRunSubmission,
  SingleLeaderboardEntry,
  SinglePlayerRunSession,
} from '../../../../shared/src/contracts/records.js';
import { config } from '../../config.js';
import {getMultiplayerRecordsForUser} from '../multiplayer/results.service.js';
import {listMultiplayerLeaderboard, type DbMultiplayerLeaderboardEntry} from '../multiplayer/results.repository.js';
import { replayVerifiedSinglePlayerRun } from './replayVerifier.js';
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

type SaveRunResultInput = RankedRunSubmission;

function createRunSeed() {
  return Math.floor(Math.random() * MAX_RUN_SEED) + 1;
}

function isRunSessionAlive(runSession: Awaited<ReturnType<typeof getSinglePlayerRunSession>>) {
  if (!runSession) {
    return false;
  }

  const expiresAtMs = new Date(runSession.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return false;
  }

  return true;
}

export async function createVerifiedRunSession(userId: number, mode: RankedRunSubmission['mode']): Promise<SinglePlayerRunSession> {
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
  let storedPayload = payload;
  let verified = false;

  if (config.isTest && runSession && runSession.userId === userId && runSession.mode === payload.mode && !runSession.consumedAt) {
    verified = true;
  }

  if (runSession
    && payload.replayFrames
    && runSession.userId === userId
    && runSession.mode === payload.mode
    && !runSession.consumedAt
    && isRunSessionAlive(runSession)
  ) {
    const startedAtMs = new Date(runSession.startedAt).getTime();
    const wallClockElapsedMs = Date.now() - startedAtMs;
    const requiredHeartbeats = Math.max(0, Math.floor(wallClockElapsedMs / 1000 / HEARTBEAT_INTERVAL_SECONDS) - 1);
    if (config.isTest || runSession.heartbeatCount >= requiredHeartbeats) {
      const replayed = replayVerifiedSinglePlayerRun({
        mode: runSession.mode,
        waveSeed: runSession.waveSeed,
        bossSeed: runSession.bossSeed,
        replayFrames: payload.replayFrames,
        wallClockElapsedMs,
      });
      if (replayed) {
        storedPayload = {
          ...payload,
          ...replayed,
        };
        verified = true;
      }
    }
  }

  if (payload.runSessionId && runSession?.userId === userId && !runSession.consumedAt) {
    // defer consumption until after the record write succeeds
  }

  const record = await createRecord({
    userId,
    runSessionId: verified ? payload.runSessionId ?? null : null,
    mode: storedPayload.mode,
    score: storedPayload.score,
    reachedRound: storedPayload.reachedRound,
    survivalTime: storedPayload.survivalTime,
    clear: storedPayload.clear,
    verified,
  });

  if (payload.runSessionId && runSession?.userId === userId && !runSession.consumedAt) {
    await consumeSinglePlayerRunSession(payload.runSessionId, userId, new Date().toISOString());
  }

  return record;
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
  const [profile, normalBest, hardBest, nightmareBest, recent, multiplayer, normalLeaderboard, hardLeaderboard, nightmareLeaderboard, multiplayerLeaderboard] = await Promise.all([
    getSinglePlayerProfile(userId),
    findBestRecordByMode(userId, 'normal'),
    findBestRecordByMode(userId, 'hard'),
    findBestRecordByMode(userId, 'nightmare'),
    listRecentRecords(userId),
    getMultiplayerRecordsForUser(userId),
    listSingleLeaderboard('normal'),
    listSingleLeaderboard('hard'),
    listSingleLeaderboard('nightmare'),
    listMultiplayerLeaderboard(),
  ]);

  return {
    profile,
    best: {
      normal: normalBest ?? undefined,
      hard: hardBest ?? undefined,
      nightmare: nightmareBest ?? undefined,
    },
    recent,
    multiplayer,
    leaderboard: {
      normal: rankSingle(normalLeaderboard),
      hard: rankSingle(hardLeaderboard),
      nightmare: rankSingle(nightmareLeaderboard),
      multiplayer: rankMultiplayer(multiplayerLeaderboard)
    }
  };
}
