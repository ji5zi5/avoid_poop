import { useEffect, useState } from "react";

import type { RecordsResponse } from "../../../shared/src/contracts/index";
import { copy, translateErrorMessage } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";

type Props = {
  onBack: () => void;
  onSessionExpired: () => void;
};

export function RecordsPage({ onBack, onSessionExpired }: Props) {
  const [records, setRecords] = useState<RecordsResponse | null>(null);
  const [error, setError] = useState("");

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
            <div className="records-board">
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
