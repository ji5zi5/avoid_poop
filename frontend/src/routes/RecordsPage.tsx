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
  onOpenCareer: () => void;
  onSessionExpired: () => void;
};

type RankingTab = "normal" | "hard" | "multiplayer";
type BoardEntry = SingleLeaderboardEntry | MultiplayerLeaderboardEntry;

function isMultiplayerEntry(entry: BoardEntry): entry is MultiplayerLeaderboardEntry {
  return "wins" in entry;
}

export function RecordsPage({ onBack, onOpenCareer, onSessionExpired }: Props) {
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
    };
  }, [rankingTab, records]);

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
              <div className="records-toolbar__actions">
                <div className="segmented-switch records-tabs" role="tablist" aria-label={copy.records.playerRanking}>
                  <button type="button" className={rankingTab === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("normal")}>{copy.records.normal}</button>
                  <button type="button" className={rankingTab === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("hard")}>{copy.records.hard}</button>
                  <button type="button" className={rankingTab === "multiplayer" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("multiplayer")}>멀티</button>
                </div>
                <button className="ghost-button subtle-button" type="button" onClick={onOpenCareer}>{copy.records.viewCareer}</button>
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
                              : `${copy.records.best} · ${entry.reachedRound}라운드`}
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
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="records-empty">{copy.records.none}</div>
              )}
            </section>

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
