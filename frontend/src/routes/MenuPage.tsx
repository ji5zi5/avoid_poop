import { useEffect, useMemo, useState } from "react";

import type { AuthUser } from "../../../shared/src/contracts/index";
import type { GameMode } from "../../../shared/src/contracts/index";
import { copy } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";
import { MenuHeroCanvas } from "./MenuHeroCanvas";

type Props = {
  user: AuthUser;
  sessionSaveCount: number;
  onOpenMultiplayer: () => void;
  onPlay: (mode: GameMode) => void;
  onViewRecords: () => void;
  onLogout: () => void;
  onSessionExpired: () => void;
};

export function MenuPage({ user, sessionSaveCount, onOpenMultiplayer, onPlay, onViewRecords, onLogout, onSessionExpired }: Props) {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>("normal");
  const [bestScores, setBestScores] = useState<{ normal: number | null; hard: number | null; nightmare: number | null }>({
    normal: null,
    hard: null,
    nightmare: null,
  });

  useEffect(() => {
    api.records()
      .then((response) => {
        setBestScores({
          normal: response.best.normal?.score ?? null,
          hard: response.best.hard?.score ?? null,
          nightmare: response.best.nightmare?.score ?? null,
        });
      })
      .catch((caught) => {
        if (caught instanceof ApiRequestError && caught.status === 401) {
          onSessionExpired();
        }
      });
  }, [onSessionExpired, sessionSaveCount]);

  const bestScoreLabel = useMemo(() => {
    const score = singleOpen
      ? bestScores[selectedMode]
      : Math.max(bestScores.normal ?? 0, bestScores.hard ?? 0, bestScores.nightmare ?? 0) || null;
    return score === null ? copy.records.none : `${score.toLocaleString()} pts`;
  }, [bestScores, selectedMode, singleOpen]);
  const isNightmareSelected = selectedMode === "nightmare";
  const modeOptions: Array<{
    key: GameMode;
    label: string;
    badge: string;
    summary: string;
    best: number | null;
  }> = [
    {
      key: "normal",
      label: copy.menu.modeBanner.normal,
      badge: copy.menu.modeShort.normal,
      summary: copy.menu.normalSummary,
      best: bestScores.normal,
    },
    {
      key: "hard",
      label: copy.menu.modeBanner.hard,
      badge: copy.menu.modeShort.hard,
      summary: copy.menu.hardSummary,
      best: bestScores.hard,
    },
    {
      key: "nightmare",
      label: copy.menu.modeBanner.nightmare,
      badge: copy.menu.modeShort.nightmare,
      summary: copy.menu.nightmareSummary,
      best: bestScores.nightmare,
    },
  ];

  return (
    <section className="menu-screen simple-menu-screen">
      <div className="simple-home-stage">
        <div className="console-panel console-panel--primary console-panel--compact simple-home-card simple-home-card--heroic">
          <div className="simple-home-topline">
            <div className="simple-home-badges">
              <span className="home-status-chip">{copy.menu.profile}</span>
              <span className="home-status-chip">{user.username}</span>
              <span className="home-status-chip">저장 {sessionSaveCount}</span>
            </div>
          </div>

          <div className="home-hero__headline simple-home-headline">
            <h1 className="home-card__title">{copy.app.title}</h1>
            <p className="home-hero__tagline">하늘에서 떨어지는 위기를 피하세요!</p>
          </div>

          <div className="menu-hero-stage" aria-hidden="true">
            <div className="menu-hero-score-bubble">
              <span className="info-card__label">최고 기록</span>
              <strong>{bestScoreLabel}</strong>
            </div>
            <MenuHeroCanvas />
          </div>

          <button
            className="home-start-button home-start-button--hero"
            onClick={() => {
              setSelectionOpen(true);
              setSingleOpen(false);
            }}
          >
            {copy.menu.start}
          </button>

          <div className="menu-bottom-links menu-bottom-links--compact">
            <button className="ghost-button subtle-button" onClick={onViewRecords}>{copy.menu.records}</button>
            <button className="ghost-button subtle-button" onClick={onLogout}>{copy.menu.logout}</button>
          </div>

          {selectionOpen ? (
            <div className="menu-selection-sheet" role="dialog" aria-label={copy.menu.modeLabel}>
              <div className="menu-selection-sheet__scrim" onClick={() => setSelectionOpen(false)} />
              <div className="menu-selection-sheet__panel">
                {!singleOpen ? (
                  <>
                    <p className="panel-kicker">{copy.menu.modeLabel}</p>
                    <button className="home-start-button home-start-button--hero" onClick={() => setSingleOpen(true)}>{copy.menu.chooseSingle}</button>
                    <button className="ghost-button subtle-button menu-secondary-cta" onClick={onOpenMultiplayer}>{copy.menu.chooseMulti}</button>
                    <button className="ghost-button subtle-button menu-close-button" onClick={() => setSelectionOpen(false)}>{copy.records.back}</button>
                  </>
                ) : (
                  <>
                    <p className="panel-kicker">{copy.menu.modeLabel}</p>
                    <div className="mode-choice-list" role="list" aria-label={copy.menu.modeLabel}>
                      {modeOptions.map((modeOption) => {
                        const selected = selectedMode === modeOption.key;
                        const nightmare = modeOption.key === "nightmare";
                        return (
                          <button
                            key={modeOption.key}
                            type="button"
                            className={`mode-choice-card ${selected ? "is-selected" : ""} ${nightmare ? "is-nightmare" : ""}`}
                            aria-pressed={selected}
                            aria-label={modeOption.label}
                            onClick={() => setSelectedMode(modeOption.key)}
                          >
                            <div className="mode-choice-card__head">
                              <span className={`mode-choice-card__badge ${nightmare ? "is-nightmare" : ""}`}>{modeOption.badge}</span>
                              <strong>{modeOption.label}</strong>
                            </div>
                            <span className="mode-choice-card__summary">{modeOption.summary}</span>
                            <span className="mode-choice-card__meta">
                              최고 기록 {modeOption.best === null ? copy.records.none : `${modeOption.best.toLocaleString()} pts`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button className={`home-start-button home-start-button--hero ${isNightmareSelected ? "is-nightmare" : ""}`} onClick={() => onPlay(selectedMode)}>{copy.menu.start}</button>
                    <button className="ghost-button subtle-button menu-close-button" onClick={() => setSingleOpen(false)}>{copy.records.back}</button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
