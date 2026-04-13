import { useEffect, useMemo, useState } from "react";

import type {
  MultiplayerLeaderboardEntry,
  RecordsResponse,
  SingleLeaderboardEntry,
} from "../../../shared/src/contracts/index";
import { copy, formatSecondsLabel, translateErrorMessage } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";

type Props = {
  onBack: () => void;
  onSessionExpired: () => void;
};

type RankingTab = "normal" | "hard" | "multiplayer";
type BoardEntry = SingleLeaderboardEntry | MultiplayerLeaderboardEntry;

function isMultiplayerEntry(entry: BoardEntry): entry is MultiplayerLeaderboardEntry {
  return "wins" in entry;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function RecordsPage({ onBack, onSessionExpired }: Props) {
  const [records, setRecords] = useState<RecordsResponse | null>(null);
  const [error, setError] = useState("");
  const [rankingTab, setRankingTab] = useState<RankingTab>("normal");

  useEffect(() => {
    api.records()
      .then((response) => {
        setRecords(response);
        setError("");
      })
      .catch((caught) => {
        if (caught instanceof ApiRequestError && caught.status === 401) {
          onSessionExpired();
          return;
        }
        setError(caught instanceof Error ? translateErrorMessage(caught.message) : copy.records.loading);
      });
  }, [onSessionExpired]);

  const boardState = useMemo(() => {
    if (!records) {
      return null;
    }

    const selectedEntries: BoardEntry[] = rankingTab === "multiplayer"
      ? records.leaderboard.multiplayer
      : records.leaderboard[rankingTab];
    const leader = selectedEntries[0] ?? null;
    const podium = selectedEntries.slice(0, 3);
    const clearRate = records.profile.totalRuns > 0
      ? (records.profile.totalClears / records.profile.totalRuns) * 100
      : 0;
    const averageScore = records.profile.totalRuns > 0
      ? Math.round(records.profile.totalScore / records.profile.totalRuns)
      : 0;
    const multiplayerWinRate = records.multiplayer.stats.matchesPlayed > 0
      ? (records.multiplayer.stats.wins / records.multiplayer.stats.matchesPlayed) * 100
      : 0;
    const boardLabel = rankingTab === "multiplayer"
      ? "멀티"
      : rankingTab === "hard"
        ? copy.records.hard
        : copy.records.normal;

    return {
      boardLabel,
      selectedEntries,
      leader,
      podium,
      clearRate,
      averageScore,
      multiplayerWinRate,
    };
  }, [rankingTab, records]);

  const summaryCards = records && boardState
    ? [
        {
          label: copy.records.totalRuns,
          value: records.profile.totalRuns.toString(),
          meta: `${copy.records.totalClears} ${records.profile.totalClears}`,
        },
        {
          label: copy.records.careerScore,
          value: records.profile.totalScore.toString(),
          meta: `${copy.records.averageScore} ${boardState.averageScore}`,
        },
        {
          label: copy.records.clearRate,
          value: formatPercent(boardState.clearRate),
          meta: records.best.normal
            ? copy.records.roundEntry(records.best.normal.score, records.best.normal.reachedRound)
            : copy.records.none,
        },
        {
          label: copy.records.multiplayerWins,
          value: records.multiplayer.stats.wins.toString(),
          meta: `${copy.records.winRate} ${formatPercent(boardState.multiplayerWinRate)}`,
        },
        {
          label: copy.records.hardBest,
          value: records.best.hard ? records.best.hard.score.toString() : "--",
          meta: records.best.hard
            ? `${copy.records.roundEntry(records.best.hard.score, records.best.hard.reachedRound)} · ${formatSecondsLabel(records.best.hard.survivalTime)}`
            : copy.records.none,
        },
        {
          label: copy.records.multiplayerBest,
          value: records.multiplayer.stats.bestPlacement ? `${records.multiplayer.stats.bestPlacement}등` : "--",
          meta: `${copy.records.multiplayerMatches} ${records.multiplayer.stats.matchesPlayed}`,
        },
      ]
    : [];

  return (
    <section className="records-screen">
      <div className="console-panel console-panel--primary console-panel--compact records-hub">
        <div className="panel-heading records-heading">
          <span className="records-badge">{copy.records.badge}</span>
          <h2>{copy.records.title}</h2>
          <span className="records-meta">{copy.records.meta}</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {records && boardState ? (
          <>
            <div className="records-toolbar">
              <div>
                <span className="panel-kicker">{copy.records.publicBoard}</span>
                <h3>{copy.records.leaderboardPulse(boardState.boardLabel)}</h3>
              </div>
              <div className="segmented-switch records-tabs" role="tablist" aria-label={copy.records.playerRanking}>
                <button type="button" className={rankingTab === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("normal")}>{copy.records.normal}</button>
                <button type="button" className={rankingTab === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("hard")}>{copy.records.hard}</button>
                <button type="button" className={rankingTab === "multiplayer" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("multiplayer")}>멀티</button>
              </div>
            </div>

            <section className="records-hero-band">
              <div className="records-hero-copy">
                <span className="panel-kicker">{copy.records.spotlight}</span>
                <h3>{copy.records.playerRanking}</h3>
                <p>
                  {boardState.leader
                    ? copy.records.leaderboardLead(boardState.leader.username)
                    : copy.records.none}
                </p>
                <div className="records-pill-row">
                  <span className="records-pill">{copy.records.boardWindow(boardState.selectedEntries.length)}</span>
                  {boardState.leader ? (
                    <span className="records-pill">
                      {isMultiplayerEntry(boardState.leader)
                        ? copy.records.topWins(boardState.leader.wins)
                        : copy.records.topScore(boardState.leader.score)}
                    </span>
                  ) : null}
                  {boardState.leader && isMultiplayerEntry(boardState.leader) ? (
                    <span className="records-pill">{copy.records.topPlacement(boardState.leader.bestPlacement)}</span>
                  ) : null}
                </div>
              </div>

              <div className="records-podium" aria-label={copy.records.playerRanking}>
                {boardState.podium.length > 0 ? (
                  boardState.podium.map((entry, index) => (
                    <article
                      key={`${rankingTab}-${entry.userId}`}
                      className={index === 0 ? "records-podium__card records-podium__card--leader" : "records-podium__card"}
                    >
                      <span className="records-podium__rank">#{entry.rank}</span>
                      <strong>{entry.username}</strong>
                      {isMultiplayerEntry(entry) ? (
                        <>
                          <span>{copy.records.multiplayerWins} {entry.wins}</span>
                          <span>{copy.records.topPlacement(entry.bestPlacement)}</span>
                        </>
                      ) : (
                        <>
                          <span>{copy.records.roundEntry(entry.score, entry.reachedRound)}</span>
                          <span>{formatSecondsLabel(entry.survivalTime)}</span>
                        </>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="records-empty">{copy.records.none}</div>
                )}
              </div>
            </section>

            <div className="records-summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className="records-stat-card">
                  <span className="records-stat-card__label">{card.label}</span>
                  <strong className="records-stat-card__value">{card.value}</strong>
                  <span className="records-stat-card__meta">{card.meta}</span>
                </article>
              ))}
            </div>

            <section className="records-section">
              <div className="records-section-heading">
                <div>
                  <h3>{copy.records.playerRanking}</h3>
                  <p className="records-section__subcopy">{copy.records.boardWindow(boardState.selectedEntries.length)}</p>
                </div>
              </div>

              {boardState.selectedEntries.length > 0 ? (
                <div className="records-leaderboard">
                  {boardState.selectedEntries.map((entry) => (
                    <article key={`${rankingTab}-${entry.userId}`} className="records-leaderboard-card">
                      <div className="records-leaderboard-card__header">
                        <span className="records-rank-chip">#{entry.rank}</span>
                        <div>
                          <strong>{entry.username}</strong>
                          <span className="records-leaderboard-card__meta">
                            {isMultiplayerEntry(entry)
                              ? `${copy.records.multiplayerMatches} ${entry.matchesPlayed}`
                              : entry.clear ? copy.results.outcomeClear : copy.results.outcomeFail}
                          </span>
                        </div>
                      </div>

                      {isMultiplayerEntry(entry) ? (
                        <div className="records-chip-row">
                          <span className="records-chip">{copy.records.multiplayerWins} {entry.wins}</span>
                          <span className="records-chip">{copy.records.topPlacement(entry.bestPlacement)}</span>
                          <span className="records-chip">최고 라운드 {entry.bestReachedRound ?? "--"}</span>
                        </div>
                      ) : (
                        <div className="records-chip-row">
                          <span className="records-chip">{copy.records.roundEntry(entry.score, entry.reachedRound)}</span>
                          <span className="records-chip">{formatSecondsLabel(entry.survivalTime)}</span>
                          <span className="records-chip">{entry.clear ? copy.results.outcomeClear : copy.results.outcomeFail}</span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="records-empty">{copy.records.none}</div>
              )}
            </section>

            <div className="records-split-grid">
              <section className="records-section records-feed">
                <div className="records-section-heading">
                  <div>
                    <h3>{copy.records.recentLog}</h3>
                    <p className="records-section__subcopy">{copy.records.recentSingleMeta}</p>
                  </div>
                </div>

                {records.recent.length > 0 ? (
                  <div className="records-feed-list">
                    {records.recent.map((entry) => (
                      <article key={entry.id} className="records-feed-card">
                        <div className="records-feed-card__header">
                          <strong>{entry.mode === "normal" ? copy.records.normal : copy.records.hard}</strong>
                          <span>{entry.clear ? copy.results.outcomeClear : copy.results.outcomeFail}</span>
                        </div>
                        <span>{copy.records.roundEntry(entry.score, entry.reachedRound)}</span>
                        <span>{copy.records.survivalLabel} {formatSecondsLabel(entry.survivalTime)}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="records-empty">{copy.records.none}</div>
                )}
              </section>

              <section className="records-section records-feed">
                <div className="records-section-heading">
                  <div>
                    <h3>{copy.records.multiplayerRecent}</h3>
                    <p className="records-section__subcopy">{copy.records.recentMultiplayerMeta}</p>
                  </div>
                </div>

                {records.multiplayer.recent.length > 0 ? (
                  <div className="records-feed-list">
                    {records.multiplayer.recent.map((entry) => (
                      <article key={`${entry.matchId}-${entry.createdAt}`} className="records-feed-card">
                        <div className="records-feed-card__header">
                          <strong>{entry.won ? copy.records.multiplayerWins : copy.records.multiplayerBest}</strong>
                          <span>{copy.records.placementShort(entry.placement, entry.totalPlayers)}</span>
                        </div>
                        <span>{copy.records.placementEntry(entry.placement, entry.totalPlayers, entry.reachedRound)}</span>
                        <span>{entry.won ? "최종 승리" : `생존 ${entry.reachedRound}라운드`}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="records-empty">{copy.records.none}</div>
                )}
              </section>
            </div>
          </>
        ) : (
          <p>{copy.records.loading}</p>
        )}
        <button className="ghost-button subtle-button" onClick={onBack}>
          {copy.records.back}
        </button>
      </div>
    </section>
  );
}
