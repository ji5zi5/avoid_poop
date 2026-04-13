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
        <h1 className="home-card__title">{copy.multiplayer.homeTitle}</h1>

        <div className="multiplayer-home-options">
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

        <div className="multiplayer-home-actions">
          <button className="home-start-button" onClick={() => onQuickJoin({ options })}>{copy.multiplayer.quickJoin}</button>
          <button className="ghost-button subtle-button" onClick={() => onCreateRoom({ options })}>{copy.multiplayer.createRoom}</button>
        </div>

        <form className="multiplayer-code-form" onSubmit={handleSubmit}>
          <label>
            <span>{copy.multiplayer.roomCode}</span>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder={copy.multiplayer.joinPlaceholder} />
          </label>
          <button className="ghost-button subtle-button" type="submit" disabled={roomCode.trim().length < 6}>{copy.multiplayer.joinByCode}</button>
        </form>

        <button className="ghost-button subtle-button" onClick={onBack}>{copy.records.back}</button>
      </div>
    </section>
  );
}
