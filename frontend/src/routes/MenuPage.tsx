import { useState } from "react";

import type { AuthUser } from "../../../shared/src/contracts/index";
import type { GameMode } from "../../../shared/src/contracts/index";
import { copy } from "../content/copy";

type Props = {
  user: AuthUser;
  sessionSaveCount: number;
  onOpenMultiplayer: () => void;
  onPlay: (mode: GameMode) => void;
  onViewRecords: () => void;
  onLogout: () => void;
};

export function MenuPage({ user, sessionSaveCount, onOpenMultiplayer, onPlay, onViewRecords, onLogout }: Props) {
  const [selectedMode, setSelectedMode] = useState<GameMode>("normal");

  return (
    <section className="menu-screen">
      <div className="console-panel console-panel--primary console-panel--compact home-card home-card--hero">
        <div className="home-hero">
          <div className="home-hero__badge-row">
            <span className="results-badge">{copy.menu.heroBadge}</span>
            <span className="home-card__meta">기록 저장 {sessionSaveCount}회</span>
          </div>
          <div className="home-hero__headline">
            <p className="home-card__subtitle">{copy.menu.heroLine}</p>
            <h1 className="home-card__title">{copy.app.title}</h1>
            <p className="home-hero__tagline">{copy.menu.welcome(user.username)}</p>
          </div>
        </div>

        <div className="home-action-panel">
          <div className="segmented-switch home-mode-switch" role="tablist" aria-label={copy.menu.modeLabel}>
            <button type="button" className={selectedMode === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setSelectedMode("normal")}>{copy.menu.modeShort.normal}</button>
            <button type="button" className={selectedMode === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setSelectedMode("hard")}>{copy.menu.modeShort.hard}</button>
          </div>
          <div className="home-mode-summary">{selectedMode === "normal" ? copy.menu.normalSummary : copy.menu.hardSummary}</div>
          <button className="home-start-button" onClick={() => onPlay(selectedMode)}>{copy.menu.start}</button>
          <button className="ghost-button subtle-button" onClick={onOpenMultiplayer}>{copy.multiplayer.entry}</button>
          <div className="action-row home-secondary-actions">
            <button className="ghost-button subtle-button" onClick={onViewRecords}>{copy.menu.records}</button>
            <button className="ghost-button subtle-button" onClick={onLogout}>{copy.menu.logout}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
