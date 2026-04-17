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

type RankingTab = "normal" | "hard" | "nightmare" | "multiplayer";
type BoardEntry = SingleLeaderboardEntry | MultiplayerLeaderboardEntry;

function isMultiplayerEntry(entry: BoardEntry): entry is MultiplayerLeaderboardEntry {
  return "wins" in entry;
}

function formatLeaderSummary(entry: BoardEntry | null) {
  if (!entry) {
    return copy.records.none;
  }
  if (isMultiplayerEntry(entry)) {
    return `${copy.records.multiplayerWins} ${entry.wins} · ${entry.matchesPlayed}판`;
  }
  return `${entry.score}점 · ${entry.reachedRound}R`;
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
    const remainingEntries = selectedEntries.slice(3);
    const boardLabel = rankingTab === "multiplayer"
      ? "멀티"
      : rankingTab === "nightmare"
        ? copy.records.nightmare
      : rankingTab === "hard"
        ? copy.records.hard
        : copy.records.normal;

    return {
      boardLabel,
      selectedEntries,
      leader,
      podium,
      remainingEntries,
    };
  }, [rankingTab, records]);

  return (
    <section className="records-screen">
      <div className={`console-panel console-panel--primary console-panel--compact records-hub ${rankingTab === "nightmare" ? "is-nightmare" : ""}`}>
        <div className="panel-heading records-heading">
          <span className="records-badge">{copy.records.badge}</span>
          <h2>{copy.records.title}</h2>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {records && boardState ? (
          <>
            <div className="records-toolbar">
              <div>
                <h3>{copy.records.leaderboardPulse(boardState.boardLabel)}</h3>
              </div>
              <div className="records-toolbar__actions">
                <div className="segmented-switch records-tabs" role="tablist" aria-label={copy.records.playerRanking}>
                  <button type="button" className={rankingTab === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("normal")}>{copy.records.normal}</button>
                  <button type="button" className={rankingTab === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("hard")}>{copy.records.hard}</button>
                  <button type="button" className={rankingTab === "nightmare" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("nightmare")}>{copy.records.nightmare}</button>
                  <button type="button" className={rankingTab === "multiplayer" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("multiplayer")}>멀티</button>
                </div>
                <button className="ghost-button subtle-button" type="button" onClick={onOpenCareer}>{copy.records.viewCareer}</button>
              </div>
            </div>

            <section className={`records-hero-band ${rankingTab === "nightmare" ? "is-nightmare" : ""}`}>
              <div className="records-hero-copy records-hero-copy--full">
                <div>
                  <span className="panel-kicker">{copy.records.spotlight}</span>
                  <h3>{boardState.leader?.username ?? copy.records.none}</h3>
                  <p>{formatLeaderSummary(boardState.leader)}</p>
                </div>
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
                  {boardState.leader && isMultiplayerEntry(boardState.leader) ? (
                    <span className="records-pill">최고 라운드 {boardState.leader.bestReachedRound ?? "--"}</span>
                  ) : null}
                  {boardState.leader && !isMultiplayerEntry(boardState.leader) ? (
                    <span className="records-pill">{copy.records.survivalLabel} {formatSecondsLabel(boardState.leader.survivalTime)}</span>
                  ) : null}
                </div>
              </div>

              <div className="records-podium-shell records-podium-shell--full">
                <span className="panel-kicker">TOP 3</span>
                <div className="records-podium records-podium--balanced" aria-label={copy.records.playerRanking}>
                  {boardState.podium.length > 0 ? (
                    boardState.podium.map((entry, index) => (
                      <article
                        key={`${rankingTab}-${entry.userId}`}
                        className={[
                          "records-podium__card",
                          index === 0 ? "records-podium__card--leader" : "",
                          index === 0 ? "records-podium__card--first" : "",
                          index === 1 ? "records-podium__card--second" : "",
                          index === 2 ? "records-podium__card--third" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <span className="records-podium__rank">#{entry.rank}</span>
                        <strong>{entry.username}</strong>
                        {isMultiplayerEntry(entry) ? (
                          <>
                            <span>{entry.wins}승 · {copy.records.topPlacement(entry.bestPlacement)}</span>
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
              </div>
            </section>

            {boardState.remainingEntries.length > 0 ? (
              <section className="records-section">
                <div className="records-section-heading">
                  <div>
                    <h3>나머지 순위</h3>
                    <p className="records-section__subcopy">{copy.records.boardWindow(boardState.remainingEntries.length)}</p>
                  </div>
                </div>
                <div className="records-leaderboard">
                  {boardState.remainingEntries.map((entry) => (
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
              </section>
            ) : null}

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
