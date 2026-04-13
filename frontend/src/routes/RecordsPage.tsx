import { useEffect, useState } from "react";

import type { RecordsResponse } from "../../../shared/src/contracts/index";
import { copy, translateErrorMessage } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";

type Props = {
  onBack: () => void;
  onSessionExpired: () => void;
};

type RankingTab = "normal" | "hard" | "multiplayer";

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

  const singleLeaderboard = records ? records.leaderboard[rankingTab === "hard" ? "hard" : "normal"] : [];
  const multiplayerLeaderboard = records ? records.leaderboard.multiplayer : [];

  return (
    <section className="records-screen">
      <div className="console-panel console-panel--primary console-panel--compact">
        <div className="panel-heading">
          <span className="records-badge">{copy.records.badge}</span>
          <h2>{copy.records.title}</h2>
          <span className="records-meta">{copy.records.meta}</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {records ? (
          <>
            <div className="records-board records-board--three">
              <div className="score-board">
                <span className="score-board__label">{copy.records.totalRuns}</span>
                <strong>{records.profile.totalRuns}</strong>
                <span>{copy.records.totalClears} {records.profile.totalClears}</span>
              </div>
              <div className="score-board">
                <span className="score-board__label">{copy.records.normalBest}</span>
                <strong>{records.best.normal ? records.best.normal.score : "--"}</strong>
                <span>{records.best.normal ? copy.records.roundEntry(records.best.normal.score, records.best.normal.reachedRound) : copy.records.none}</span>
              </div>
              <div className="score-board">
                <span className="score-board__label">{copy.records.hardBest}</span>
                <strong>{records.best.hard ? records.best.hard.score : "--"}</strong>
                <span>{records.best.hard ? copy.records.roundEntry(records.best.hard.score, records.best.hard.reachedRound) : copy.records.none}</span>
              </div>
              <div className="score-board">
                <span className="score-board__label">{copy.records.multiplayerBest}</span>
                <strong>{records.multiplayer.stats.bestPlacement ? `${records.multiplayer.stats.bestPlacement}등` : "--"}</strong>
                <span>{copy.records.multiplayerWins} {records.multiplayer.stats.wins} · {copy.records.multiplayerMatches} {records.multiplayer.stats.matchesPlayed}</span>
              </div>
            </div>

            <div className="records-section-heading">
              <h3>{copy.records.recentLog}</h3>
            </div>
            {records.recent.length > 0 ? (
              <ul className="log-list">
                {records.recent.map((entry) => (
                  <li key={entry.id} className="log-list__item">
                    <strong>{entry.mode === "normal" ? copy.records.normal : copy.records.hard}</strong>
                    <span>{copy.records.roundEntry(entry.score, entry.reachedRound)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{copy.records.none}</p>
            )}

            <div className="records-section-heading">
              <h3>{copy.records.playerRanking}</h3>
              <div className="segmented-switch records-tabs" role="tablist" aria-label={copy.records.playerRanking}>
                <button type="button" className={rankingTab === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("normal")}>{copy.records.normal}</button>
                <button type="button" className={rankingTab === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("hard")}>{copy.records.hard}</button>
                <button type="button" className={rankingTab === "multiplayer" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setRankingTab("multiplayer")}>멀티</button>
              </div>
            </div>

            {(rankingTab === "multiplayer" ? multiplayerLeaderboard.length : singleLeaderboard.length) > 0 ? (
              <ul className="log-list">
                {rankingTab === "multiplayer"
                  ? multiplayerLeaderboard.map((entry) => (
                      <li key={`multiplayer-${entry.userId}`} className="log-list__item leaderboard-entry">
                        <strong>{entry.rank}. {entry.username}</strong>
                        <span>{copy.records.multiplayerWins} {entry.wins} · {copy.records.multiplayerMatches} {entry.matchesPlayed}</span>
                        <span>{copy.records.multiplayerBest} {entry.bestPlacement ? `${entry.bestPlacement}등` : "--"} · 최고 라운드 {entry.bestReachedRound ?? "--"}</span>
                      </li>
                    ))
                  : singleLeaderboard.map((entry) => (
                      <li key={`${rankingTab}-${entry.userId}`} className="log-list__item leaderboard-entry">
                        <strong>{entry.rank}. {entry.username}</strong>
                        <span>{copy.records.roundEntry(entry.score, entry.reachedRound)}</span>
                        <span>{entry.clear ? copy.results.outcomeClear : copy.results.outcomeFail} · {entry.survivalTime.toFixed(1)}초</span>
                      </li>
                    ))}
              </ul>
            ) : (
              <p>{copy.records.none}</p>
            )}

            <div className="records-section-heading">
              <h3>{copy.records.multiplayerRecent}</h3>
            </div>
            {records.multiplayer.recent.length > 0 ? (
              <ul className="log-list">
                {records.multiplayer.recent.map((entry) => (
                  <li key={`${entry.matchId}-${entry.createdAt}`} className="log-list__item">
                    <strong>{entry.won ? 'WIN' : 'RANK'}</strong>
                    <span>{copy.records.placementEntry(entry.placement, entry.totalPlayers, entry.reachedRound)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{copy.records.none}</p>
            )}
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
