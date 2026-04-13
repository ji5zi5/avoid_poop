import { useState } from "react";

import type { AuthUser } from "../../../shared/src/contracts/index";
import type { GameMode } from "../../../shared/src/contracts/index";
import { copy } from "../content/copy";
import stitchMenuReference from "../assets/stitch-menu-reference.png";

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

          <div className="stitch-preview-card" aria-hidden="true">
            <img className="stitch-preview-image" src={stitchMenuReference} alt="" />
            <div className="stitch-preview-badge">
              <span className="info-card__label">최고 기록</span>
              <strong>{selectedMode === "hard" ? "82,400 pts" : "58,200 pts"}</strong>
            </div>
          </div>

          <button className="home-start-button home-start-button--hero" onClick={() => { setSelectionOpen(true); setSingleOpen(false); }}>
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
                    <div className="segmented-switch home-mode-switch" role="tablist" aria-label={copy.menu.modeLabel}>
                      <button type="button" className={selectedMode === "normal" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setSelectedMode("normal")}>{copy.menu.modeShort.normal}</button>
                      <button type="button" className={selectedMode === "hard" ? "segmented-switch__item is-active" : "segmented-switch__item"} onClick={() => setSelectedMode("hard")}>{copy.menu.modeShort.hard}</button>
                    </div>
                    <div className="home-mode-summary">{selectedMode === "normal" ? copy.menu.normalSummary : copy.menu.hardSummary}</div>
                    <button className="home-start-button home-start-button--hero" onClick={() => onPlay(selectedMode)}>{copy.menu.start}</button>
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
