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
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-home-card">
        <div className="multiplayer-screen-heading">
          <div>
            <p className="panel-kicker">{copy.multiplayer.entry}</p>
            <h1 className="home-card__title">{copy.multiplayer.homeTitle}</h1>
            <p className="home-card__meta">옵션을 고르고 바로 합류하거나, 방을 만든 뒤 친구를 초대하세요.</p>
          </div>
          <button className="ghost-button subtle-button" onClick={onBack}>{copy.records.back}</button>
        </div>

        <div className="matchmaking-grid">
          <article className="matchmaking-card matchmaking-card--highlight">
            <span className="info-card__label">FAST MATCH</span>
            <strong>{copy.multiplayer.quickJoin}</strong>
            <p>같은 조건 방이 있으면 즉시 입장하고, 없으면 현재 옵션으로 새 방을 엽니다.</p>
            <button className="home-start-button home-start-button--hero" onClick={() => onQuickJoin({ options })}>{copy.multiplayer.quickJoin}</button>
          </article>
          <article className="matchmaking-card">
            <span className="info-card__label">PRIVATE ROOM</span>
            <strong>{copy.multiplayer.createRoom}</strong>
            <p>방 코드를 만들고 준비 상태를 맞춘 뒤 시작합니다.</p>
            <button className="ghost-button subtle-button" onClick={() => onCreateRoom({ options })}>{copy.multiplayer.createRoom}</button>
          </article>
        </div>

        <div className="multiplayer-home-options multiplayer-home-options--refined">
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
          <p className="home-card__meta">{copy.multiplayer.jumpHint}</p>
        </div>

        <form className="multiplayer-code-form multiplayer-code-form--card" onSubmit={handleSubmit}>
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
