import {getDb} from '../../db/client.js';

export type CreateMultiplayerMatchInput = {
  placements: Array<{
    placement: number;
    reachedRound: number;
    totalPlayers: number;
    userId: number;
    won: boolean;
  }>;
  reachedRound: number;
  roomCode: string;
  totalPlayers: number;
  winnerUserId: number | null;
};

export function createMultiplayerMatch(input: CreateMultiplayerMatchInput) {
  const db = getDb();
  const insertMatch = db.prepare(
    `INSERT INTO multiplayer_matches (room_code, winner_user_id, total_players, reached_round)
     VALUES (?, ?, ?, ?)
     RETURNING id, created_at AS createdAt`
  );
  const match = insertMatch.get(input.roomCode, input.winnerUserId, input.totalPlayers, input.reachedRound) as {id: number; createdAt: string};

  const insertParticipant = db.prepare(
    `INSERT INTO multiplayer_participants (match_id, user_id, placement, total_players, reached_round, won)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const placement of input.placements) {
    insertParticipant.run(
      match.id,
      placement.userId,
      placement.placement,
      placement.totalPlayers,
      placement.reachedRound,
      placement.won ? 1 : 0
    );
  }

  return match;
}

export function getMultiplayerStats(userId: number) {
  const db = getDb();
  const row = db.prepare(
    `SELECT
       COUNT(*) AS matchesPlayed,
       COALESCE(SUM(won), 0) AS wins,
       MIN(placement) AS bestPlacement
     FROM multiplayer_participants
     WHERE user_id = ?`
  ).get(userId) as {matchesPlayed: number; wins: number; bestPlacement: number | null};

  return {
    matchesPlayed: row.matchesPlayed,
    wins: row.wins,
    bestPlacement: row.bestPlacement
  };
}

export function listRecentMultiplayerRecords(userId: number) {
  const db = getDb();
  return db.prepare(
    `SELECT
       match_id AS matchId,
       placement,
       total_players AS totalPlayers,
       reached_round AS reachedRound,
       won,
       created_at AS createdAt
     FROM multiplayer_participants
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 10`
  ).all(userId).map((row) => ({
    ...(row as {
      matchId: number;
      placement: number;
      totalPlayers: number;
      reachedRound: number;
      won: number;
      createdAt: string;
    }),
    won: Boolean((row as {won: number}).won)
  }));
}
