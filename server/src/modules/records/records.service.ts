import {RecordsResponse, RunResultPayload} from '../../../../shared/src/contracts/records.js';
import {createRecord, findBestRecordByMode, listRecentRecords} from './records.repository.js';

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

export function getRecordsForUser(userId: number): RecordsResponse {
  return {
    best: {
      normal: findBestRecordByMode(userId, 'normal') ?? undefined,
      hard: findBestRecordByMode(userId, 'hard') ?? undefined
    },
    recent: listRecentRecords(userId)
  };
}
