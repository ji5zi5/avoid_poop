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
  bodyBlock: false,
  debuffTier: 2,
};

export function MultiplayerHomePage({ onCreateRoom, onJoinByCode, onQuickJoin, onBack }: Props) {
  const [roomCode, setRoomCode] = useState("");
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
            <p className="home-card__meta">랜덤 매치든 친구방이든, 방 옵션을 먼저 맞추고 깔끔하게 입장하세요.</p>
          </div>
          <button className="ghost-button subtle-button" onClick={onBack}>{copy.records.back}</button>
        </div>

        <div className="multiplayer-hero-band" aria-hidden="true">
          <span className="home-status-chip">8인 실시간</span>
          <span className="home-status-chip">랜덤 디버프</span>
          <span className="home-status-chip">라운드 + 보스</span>
        </div>

        <div className="matchmaking-grid">
          <article className="matchmaking-card matchmaking-card--highlight matchmaking-card--heroic">
            <span className="info-card__label">FAST MATCH</span>
            <strong>{copy.multiplayer.quickJoin}</strong>
            <p>같은 옵션 방이 있으면 바로 합류하고, 없으면 지금 고른 세팅으로 새 방을 엽니다.</p>
            <div className="matchmaking-card__chips">
              <span className="home-status-chip">{options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
              <span className="home-status-chip">{copy.multiplayer.debuffTier} {options.debuffTier}</span>
            </div>
            <button className="home-start-button home-start-button--hero" onClick={() => onQuickJoin({ options })}>{copy.multiplayer.quickJoin}</button>
          </article>
          <article className="matchmaking-card matchmaking-card--heroic">
            <span className="info-card__label">PRIVATE ROOM</span>
            <strong>{copy.multiplayer.createRoom}</strong>
            <p>친구와 코드로 들어오게 하고, 전원 준비 상태가 맞으면 방장이 시작합니다.</p>
            <div className="matchmaking-card__chips">
              <span className="home-status-chip">{options.bodyBlock ? "길막 ON" : "길막 OFF"}</span>
              <span className="home-status-chip">코드 초대</span>
            </div>
            <button className="ghost-button subtle-button" onClick={() => onCreateRoom({ options })}>{copy.multiplayer.createRoom}</button>
          </article>
        </div>

        <div className="multiplayer-home-options multiplayer-home-options--refined multiplayer-home-options--heroic">
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

        <form className="multiplayer-code-form multiplayer-code-form--card multiplayer-code-form--heroic" onSubmit={handleSubmit}>
          <label>
            <span>{copy.multiplayer.roomCode}</span>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder={copy.multiplayer.joinPlaceholder} />
          </label>
          <button className="ghost-button subtle-button" type="submit" disabled={roomCode.trim().length < 6}>{copy.multiplayer.joinByCode}</button>
        </form>
      </div>
    </section>
  );
}
