import { getDb } from '../../db/client.js';
import { toIsoTimestamp } from '../../utils/timestamps.js';

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

export type DbMultiplayerLeaderboardEntry = {
  userId: number;
  username: string;
  wins: number;
  matchesPlayed: number;
  bestPlacement: number | null;
  bestReachedRound: number | null;
};

function normalizeCreatedAtRow<T extends { createdAt: string | Date }>(row: T) {
  return {
    ...row,
    createdAt: toIsoTimestamp(row.createdAt),
  };
}

export async function createMultiplayerMatch(input: CreateMultiplayerMatchInput) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const insertMatch = db.db.prepare(
      `INSERT INTO multiplayer_matches (room_code, winner_user_id, total_players, reached_round)
       VALUES (?, ?, ?, ?)
       RETURNING id, created_at AS createdAt`,
    );
    const match = insertMatch.get(input.roomCode, input.winnerUserId, input.totalPlayers, input.reachedRound) as { id: number; createdAt: string };

    const insertParticipant = db.db.prepare(
      `INSERT INTO multiplayer_participants (match_id, user_id, placement, total_players, reached_round, won)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    for (const placement of input.placements) {
      insertParticipant.run(
        match.id,
        placement.userId,
        placement.placement,
        placement.totalPlayers,
        placement.reachedRound,
        placement.won ? 1 : 0,
      );
    }

    return match;
  }

  return db.sql.begin(async (sql) => {
    const [match] = await sql<{ id: number; createdAt: string }[]>`
      INSERT INTO multiplayer_matches (room_code, winner_user_id, total_players, reached_round)
      VALUES (${input.roomCode}, ${input.winnerUserId}, ${input.totalPlayers}, ${input.reachedRound})
      RETURNING id, created_at AS "createdAt"
    `;

    for (const placement of input.placements) {
      await sql`
        INSERT INTO multiplayer_participants (match_id, user_id, placement, total_players, reached_round, won)
        VALUES (${match.id}, ${placement.userId}, ${placement.placement}, ${placement.totalPlayers}, ${placement.reachedRound}, ${placement.won})
      `;
    }

    return normalizeCreatedAtRow(match);
  });
}

export async function getMultiplayerStats(userId: number) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    const row = db.db.prepare(
      `SELECT
         COUNT(*) AS matchesPlayed,
         COALESCE(SUM(won), 0) AS wins,
         MIN(placement) AS bestPlacement
       FROM multiplayer_participants
       WHERE user_id = ?`,
    ).get(userId) as { matchesPlayed: number; wins: number; bestPlacement: number | null };

    return {
      matchesPlayed: row.matchesPlayed,
      wins: row.wins,
      bestPlacement: row.bestPlacement,
    };
  }

  const [row] = await db.sql<{ matchesPlayed: number; wins: number; bestPlacement: number | null }[]>`
    SELECT
      COUNT(*)::int AS "matchesPlayed",
      COALESCE(SUM(won::int), 0)::int AS wins,
      MIN(placement) AS "bestPlacement"
    FROM multiplayer_participants
    WHERE user_id = ${userId}
  `;

  return row;
}

export async function listRecentMultiplayerRecords(userId: number) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    return db.db.prepare(
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
       LIMIT 10`,
    ).all(userId).map((row) => ({
      ...(row as {
        matchId: number;
        placement: number;
        totalPlayers: number;
        reachedRound: number;
        won: number;
        createdAt: string;
      }),
      won: Boolean((row as { won: number }).won),
    }));
  }

  const rows = await db.sql<Array<{
    matchId: number;
    placement: number;
    totalPlayers: number;
    reachedRound: number;
    won: boolean;
    createdAt: string;
  }>>`
    SELECT
      match_id AS "matchId",
      placement,
      total_players AS "totalPlayers",
      reached_round AS "reachedRound",
      won,
      created_at AS "createdAt"
    FROM multiplayer_participants
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `;

  return rows.map(normalizeCreatedAtRow);
}

export async function listMultiplayerLeaderboard(limit = 20) {
  const db = await getDb();
  if (db.provider === 'sqlite') {
    return db.db.prepare(
      `SELECT
         p.user_id AS userId,
         u.username AS username,
         COALESCE(SUM(p.won), 0) AS wins,
         COUNT(*) AS matchesPlayed,
         MIN(p.placement) AS bestPlacement,
         MAX(p.reached_round) AS bestReachedRound
       FROM multiplayer_participants p
       JOIN users u ON u.id = p.user_id
       GROUP BY p.user_id, u.username
       ORDER BY wins DESC, bestPlacement ASC, bestReachedRound DESC, matchesPlayed DESC, username ASC
       LIMIT ?`,
    ).all(limit) as DbMultiplayerLeaderboardEntry[];
  }

  return db.sql<DbMultiplayerLeaderboardEntry[]>`
    SELECT
      p.user_id AS "userId",
      u.username AS username,
      COALESCE(SUM(p.won::int), 0)::int AS wins,
      COUNT(*)::int AS "matchesPlayed",
      MIN(p.placement) AS "bestPlacement",
      MAX(p.reached_round) AS "bestReachedRound"
    FROM multiplayer_participants p
    JOIN users u ON u.id = p.user_id
    GROUP BY p.user_id, u.username
    ORDER BY wins DESC, "bestPlacement" ASC, "bestReachedRound" DESC, "matchesPlayed" DESC, username ASC
    LIMIT ${limit}
  `;
}
