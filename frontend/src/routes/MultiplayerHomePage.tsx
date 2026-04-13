import { FormEvent, useState } from "react";

import type { CreateRoomPayload, QuickJoinPayload, RoomOptions } from "../lib/multiplayerClient";
import { copy } from "../content/copy";

type Props = {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<void> | void;
  onJoinByCode: (roomCode: string) => Promise<void> | void;
  onQuickJoin: (payload: QuickJoinPayload) => Promise<void> | void;
  onBack: () => void;
};

const defaultOptions: RoomOptions = {
  difficulty: "normal",
  visibility: "public",
  bodyBlock: false,
  debuffTier: 2,
};

export function MultiplayerHomePage({ onCreateRoom, onJoinByCode, onQuickJoin, onBack }: Props) {
  const [roomCode, setRoomCode] = useState("");
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [options, setOptions] = useState<RoomOptions>(defaultOptions);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoinByCode(roomCode.trim());
  }

  return (
    <section className="menu-screen multiplayer-home-screen">
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-home-card multiplayer-home-card--stitch">
        <div className="multiplayer-screen-heading">
          <div>
            <p className="panel-kicker">{copy.multiplayer.entry}</p>
            <h1 className="home-card__title">{copy.multiplayer.homeTitle}</h1>
            <p className="home-card__meta">빠른 입장은 공개방 즉시 입장, 방 만들기는 옵션 설정 후 개설, 코드 입장은 친구방 참가용입니다.</p>
          </div>
          <button className="ghost-button subtle-button" onClick={onBack}>{copy.records.back}</button>
        </div>

        <div className="matchmaking-grid">
          <article className="matchmaking-card matchmaking-card--highlight matchmaking-card--heroic">
            <span className="info-card__label">FAST MATCH</span>
            <strong>{copy.multiplayer.quickJoin}</strong>
            <p>{copy.multiplayer.quickJoinHint}</p>
            <div className="matchmaking-card__chips">
              <span className="home-status-chip">{copy.multiplayer.publicRoom}</span>
              <span className="home-status-chip">8인 대기열</span>
            </div>
            <button className="home-start-button home-start-button--hero" onClick={() => onQuickJoin({})}>{copy.multiplayer.quickJoin}</button>
          </article>
          <article className="matchmaking-card matchmaking-card--heroic">
            <span className="info-card__label">ROOM HOST</span>
            <strong>{copy.multiplayer.createRoom}</strong>
            <p>{copy.multiplayer.createRoomHint}</p>
            <div className="matchmaking-card__chips">
              <span className="home-status-chip">{options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</span>
              <span className="home-status-chip">{options.bodyBlock ? "길막 ON" : "길막 OFF"}</span>
            </div>
            <button className="ghost-button subtle-button" onClick={() => setShowCreateSetup(true)}>{copy.multiplayer.createRoom}</button>
          </article>
        </div>

        <form className="multiplayer-code-form multiplayer-code-form--card multiplayer-code-form--heroic" onSubmit={handleSubmit}>
          <label>
            <span>{copy.multiplayer.roomCode}</span>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder={copy.multiplayer.joinPlaceholder} />
          </label>
          <button className="ghost-button subtle-button" type="submit" disabled={roomCode.trim().length < 6}>{copy.multiplayer.joinByCode}</button>
        </form>

        {showCreateSetup ? (
          <div className="menu-selection-sheet" role="dialog" aria-label={copy.multiplayer.createRoomSetup}>
            <div className="menu-selection-sheet__scrim" onClick={() => setShowCreateSetup(false)} />
            <div className="menu-selection-sheet__panel multiplayer-create-sheet">
              <p className="panel-kicker">{copy.multiplayer.createRoomSetup}</p>
              <div className="multiplayer-home-options multiplayer-home-options--refined multiplayer-home-options--heroic">
                <label>
                  <span>{copy.multiplayer.visibility}</span>
                  <select value={options.visibility} onChange={(event) => setOptions((current) => ({ ...current, visibility: event.target.value as RoomOptions["visibility"] }))}>
                    <option value="public">{copy.multiplayer.publicRoom}</option>
                    <option value="private">{copy.multiplayer.privateRoom}</option>
                  </select>
                </label>
                <label>
                  <span>{copy.multiplayer.difficulty}</span>
                  <select value={options.difficulty} onChange={(event) => setOptions((current) => ({ ...current, difficulty: event.target.value as RoomOptions["difficulty"] }))}>
                    <option value="normal">{copy.multiplayer.difficultyNormal}</option>
                    <option value="hard">{copy.multiplayer.difficultyHard}</option>
                  </select>
                </label>
                <label>
                  <span>{copy.multiplayer.debuffTier}</span>
                  <select value={options.debuffTier} onChange={(event) => setOptions((current) => ({ ...current, debuffTier: Number(event.target.value) as RoomOptions["debuffTier"] }))}>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <label className="multiplayer-home-toggle">
                  <span>{copy.multiplayer.bodyBlock}</span>
                  <input type="checkbox" checked={options.bodyBlock} onChange={(event) => setOptions((current) => ({ ...current, bodyBlock: event.target.checked }))} />
                </label>
                <p className="home-card__meta multiplayer-option-note">{copy.multiplayer.jumpHint}</p>
              </div>
              <button className="home-start-button home-start-button--hero" onClick={() => onCreateRoom({ options })}>{copy.multiplayer.createRoom}</button>
              <button className="ghost-button subtle-button menu-close-button" onClick={() => setShowCreateSetup(false)}>{copy.records.back}</button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
