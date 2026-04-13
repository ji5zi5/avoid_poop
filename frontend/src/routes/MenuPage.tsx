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
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>("normal");

  return (
    <section className="menu-screen simple-menu-screen">
      <div className="console-panel console-panel--primary console-panel--compact simple-home-card">
        <div className="home-hero__headline">
          <p className="home-card__subtitle">{copy.menu.heroLine}</p>
          <h1 className="home-card__title">{copy.app.title}</h1>
          <p className="home-hero__tagline">{copy.menu.welcome(user.username)}</p>
        </div>

        {!selectionOpen ? <button className="home-start-button" onClick={() => setSelectionOpen(true)}>{copy.menu.start}</button> : null}

        {selectionOpen ? (
          <div className="multiplayer-home-actions simple-mode-chooser">
            {!singleOpen ? (
              <>
                <button className="home-start-button" onClick={() => setSingleOpen(true)}>{copy.menu.chooseSingle}</button>
                <button className="ghost-button subtle-button" onClick={onOpenMultiplayer}>{copy.menu.chooseMulti}</button>
              </>
            ) : (
              <>
                <div className="segmented-switch home-mode-switch" role="tablist" aria-label={copy.menu.modeLabel}>
                  <button type="button" className={selectedMode === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setSelectedMode("normal")}>{copy.menu.modeShort.normal}</button>
                  <button type="button" className={selectedMode === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setSelectedMode("hard")}>{copy.menu.modeShort.hard}</button>
                </div>
                <div className="home-mode-summary">{selectedMode === "normal" ? copy.menu.normalSummary : copy.menu.hardSummary}</div>
                <button className="home-start-button" onClick={() => onPlay(selectedMode)}>{copy.menu.start}</button>
                <button className="ghost-button subtle-button" onClick={() => setSingleOpen(false)}>{copy.records.back}</button>
              </>
            )}
          </div>
        ) : null}

        <div className="action-row home-secondary-actions">
          <button className="ghost-button subtle-button" onClick={onViewRecords}>{copy.menu.records}</button>
          <button className="ghost-button subtle-button" onClick={onLogout}>{copy.menu.logout}</button>
          <span className="home-card__meta">기록 저장 {sessionSaveCount}회</span>
        </div>
      </div>
    </section>
  );
}
