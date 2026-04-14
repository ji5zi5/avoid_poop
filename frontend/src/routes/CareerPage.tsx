import { useEffect, useMemo, useState } from "react";

import type { RecordsResponse } from "../../../shared/src/contracts/index";
import { copy, formatSecondsLabel, translateErrorMessage } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";

type Props = {
  onBack: () => void;
  onSessionExpired: () => void;
};

const CAREER_FEED_LIMIT = 4;

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function CareerPage({ onBack, onSessionExpired }: Props) {
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

  const summaryCards = useMemo(() => {
    if (!records) {
      return [];
    }

    const clearRate = records.profile.totalRuns > 0
      ? (records.profile.totalClears / records.profile.totalRuns) * 100
      : 0;
    const averageScore = records.profile.totalRuns > 0
      ? Math.round(records.profile.totalScore / records.profile.totalRuns)
      : 0;
    const multiplayerWinRate = records.multiplayer.stats.matchesPlayed > 0
      ? (records.multiplayer.stats.wins / records.multiplayer.stats.matchesPlayed) * 100
      : 0;

    return [
      {
        label: copy.records.totalRuns,
        value: records.profile.totalRuns.toString(),
        meta: `${copy.records.totalClears} ${records.profile.totalClears}`,
      },
      {
        label: copy.records.careerScore,
        value: records.profile.totalScore.toString(),
        meta: `${copy.records.averageScore} ${averageScore}`,
      },
      {
        label: copy.records.clearRate,
        value: formatPercent(clearRate),
        meta: records.best.normal
          ? copy.records.roundEntry(records.best.normal.score, records.best.normal.reachedRound)
          : copy.records.none,
      },
      {
        label: copy.records.multiplayerWins,
        value: records.multiplayer.stats.wins.toString(),
        meta: `${copy.records.winRate} ${formatPercent(multiplayerWinRate)}`,
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
    ];
  }, [records]);

  const recentSingleEntries = records?.recent.slice(0, CAREER_FEED_LIMIT) ?? [];
  const recentMultiplayerEntries = records?.multiplayer.recent.slice(0, CAREER_FEED_LIMIT) ?? [];

  return (
    <section className="records-screen">
      <div className="console-panel console-panel--primary console-panel--compact records-hub">
        <div className="panel-heading records-heading">
          <span className="records-badge">{copy.career.badge}</span>
          <h2>{copy.career.title}</h2>
          <span className="records-meta">{copy.career.meta}</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {records ? (
          <>
            <div className="records-summary-grid career-summary-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className="records-stat-card">
                  <span className="records-stat-card__label">{card.label}</span>
                  <strong className="records-stat-card__value">{card.value}</strong>
                  <span className="records-stat-card__meta">{card.meta}</span>
                </article>
              ))}
            </div>

            <div className="records-split-grid">
              <section className="records-section records-feed">
                <div className="records-section-heading">
                  <div>
                    <h3>{copy.career.recentSingle}</h3>
                    <p className="records-section__subcopy">{copy.records.recentSingleMeta} · 최근 {CAREER_FEED_LIMIT}개</p>
                  </div>
                </div>

                {recentSingleEntries.length > 0 ? (
                  <div className="records-feed-list career-feed-list">
                    {recentSingleEntries.map((entry) => (
                      <article key={entry.id} className="records-feed-card career-feed-card">
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
                    <h3>{copy.career.recentMultiplayer}</h3>
                    <p className="records-section__subcopy">{copy.records.recentMultiplayerMeta} · 최근 {CAREER_FEED_LIMIT}개</p>
                  </div>
                </div>

                {recentMultiplayerEntries.length > 0 ? (
                  <div className="records-feed-list career-feed-list">
                    {recentMultiplayerEntries.map((entry) => (
                      <article key={`${entry.matchId}-${entry.createdAt}`} className="records-feed-card career-feed-card">
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
          {copy.career.backToRanking}
        </button>
      </div>
    </section>
  );
}
