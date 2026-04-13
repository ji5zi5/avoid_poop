import {FormEvent, useState} from "react";

import {copy} from "../content/copy";

type Props = {
  onCreateRoom: () => Promise<void> | void;
  onJoinByCode: (roomCode: string) => Promise<void> | void;
  onQuickJoin: () => Promise<void> | void;
  onBack: () => void;
};

export function MultiplayerHomePage({onCreateRoom, onJoinByCode, onQuickJoin, onBack}: Props) {
  const [roomCode, setRoomCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoinByCode(roomCode.trim());
  }

  return (
    <section className="menu-screen multiplayer-home-screen">
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-home-card">
        <h1 className="home-card__title">{copy.multiplayer.homeTitle}</h1>
        <div className="multiplayer-home-actions">
          <button className="home-start-button" onClick={() => onQuickJoin()}>
            {copy.multiplayer.quickJoin}
          </button>
          <button className="ghost-button subtle-button" onClick={() => onCreateRoom()}>
            {copy.multiplayer.createRoom}
          </button>
        </div>
        <form className="multiplayer-code-form" onSubmit={handleSubmit}>
          <label>
            <span>{copy.multiplayer.roomCode}</span>
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder={copy.multiplayer.joinPlaceholder} />
          </label>
          <button className="ghost-button subtle-button" type="submit" disabled={roomCode.trim().length < 6}>
            {copy.multiplayer.joinByCode}
          </button>
        </form>
        <button className="ghost-button subtle-button" onClick={onBack}>{copy.records.back}</button>
      </div>
    </section>
  );
}
