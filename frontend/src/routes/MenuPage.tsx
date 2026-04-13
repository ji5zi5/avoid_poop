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
              <strong>{selectedMode === "hard" ? "82,400 pts" : "58,200 pts"}</strong>
            </div>
            <svg className="menu-hero-illustration" viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="heroBg" x1="180" y1="18" x2="180" y2="220" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFF8F2" />
                  <stop offset="1" stopColor="#F3E2D2" />
                </linearGradient>
                <linearGradient id="floorGrad" x1="180" y1="184" x2="180" y2="212" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#D8C0A8" />
                  <stop offset="1" stopColor="#C5A88A" />
                </linearGradient>
                <linearGradient id="bodyGrad" x1="180" y1="116" x2="180" y2="182" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#D88B73" />
                  <stop offset="1" stopColor="#C5664F" />
                </linearGradient>
                <linearGradient id="headGrad" x1="180" y1="72" x2="180" y2="126" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFF9F3" />
                  <stop offset="1" stopColor="#F2E1D0" />
                </linearGradient>
                <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#D88B73" />
                  <stop offset="1" stopColor="#B95F49" />
                </linearGradient>
              </defs>
              <rect x="18" y="18" width="324" height="166" rx="28" fill="url(#heroBg)" />
              <path d="M42 188C84 168 130 162 180 162C230 162 276 168 318 188V208H42V188Z" fill="url(#floorGrad)" />
              <path d="M76 82C70 92 66 98 66 106C66 118 75 128 88 128C101 128 110 118 110 106C110 98 105 91 98 82C95 78 91 70 88 62C85 70 81 78 76 82Z" fill="url(#dropGrad)" />
              <path d="M263 96C257 106 252 112 252 120C252 132 261 142 274 142C287 142 296 132 296 120C296 112 291 105 284 96C281 92 277 84 274 76C271 84 268 91 263 96Z" fill="url(#dropGrad)" />
              <path d="M226 58C222 66 218 72 218 78C218 88 225 96 234 96C244 96 251 88 251 78C251 72 247 66 242 58C239 54 236 48 234 42C232 48 229 54 226 58Z" fill="url(#dropGrad)" opacity="0.92" />
              <path d="M126 122C122 129 119 134 119 140C119 149 126 156 134 156C143 156 150 149 150 140C150 134 147 129 143 122C140 118 137 112 134 106C132 112 129 118 126 122Z" fill="url(#dropGrad)" opacity="0.84" />
              <ellipse cx="180" cy="196" rx="54" ry="12" fill="#B88D72" opacity="0.22" />
              <rect x="129" y="114" width="102" height="66" rx="30" fill="url(#bodyGrad)" stroke="#A75642" strokeWidth="2" />
              <rect x="146" y="68" width="68" height="56" rx="24" fill="url(#headGrad)" stroke="#DCC2AD" strokeWidth="2" />
              <ellipse cx="168" cy="94" rx="5" ry="7" fill="#2B1E12" />
              <ellipse cx="192" cy="94" rx="5" ry="7" fill="#2B1E12" />
              <ellipse cx="157" cy="106" rx="9" ry="4" fill="#E9A397" opacity="0.8" />
              <ellipse cx="203" cy="106" rx="9" ry="4" fill="#E9A397" opacity="0.8" />
              <path d="M167 112C171 116 176 118 180 118C184 118 189 116 193 112" stroke="#8F4B38" strokeWidth="3" strokeLinecap="round" />
              <rect x="153" y="178" width="18" height="12" rx="6" fill="#8A6A49" opacity="0.42" />
              <rect x="189" y="178" width="18" height="12" rx="6" fill="#8A6A49" opacity="0.42" />
            </svg>
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
