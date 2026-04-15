export type MultiplayerColorToken = {
  accent: string;
  soft: string;
  ink: string;
};

const PLAYER_COLOR_PALETTE: MultiplayerColorToken[] = [
  { accent: "#ce7a63", soft: "rgba(206, 122, 99, 0.18)", ink: "#8b4835" },
  { accent: "#6f87d6", soft: "rgba(111, 135, 214, 0.18)", ink: "#3b4f93" },
  { accent: "#6fa86f", soft: "rgba(111, 168, 111, 0.18)", ink: "#3c6f3c" },
  { accent: "#b07ad8", soft: "rgba(176, 122, 216, 0.18)", ink: "#74479c" },
  { accent: "#d49b47", soft: "rgba(212, 155, 71, 0.18)", ink: "#8d6322" },
  { accent: "#5eb4b2", soft: "rgba(94, 180, 178, 0.18)", ink: "#2d7674" },
  { accent: "#d56f8f", soft: "rgba(213, 111, 143, 0.18)", ink: "#8a3f59" },
  { accent: "#8c7a63", soft: "rgba(140, 122, 99, 0.18)", ink: "#584936" },
];

export function getMultiplayerColorMap<T extends { userId: number }>(players: T[]) {
  const uniqueUserIds = [...new Set(players.map((player) => player.userId))];
  return new Map<number, MultiplayerColorToken>(
    uniqueUserIds.map((userId, index) => [userId, PLAYER_COLOR_PALETTE[index % PLAYER_COLOR_PALETTE.length]]),
  );
}
