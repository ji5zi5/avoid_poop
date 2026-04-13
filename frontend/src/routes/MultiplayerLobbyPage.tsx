import { FormEvent, useState } from "react";

import type { RoomSummary } from "../lib/multiplayerClient";
import { copy } from "../content/copy";

type Props = {
  canStart: boolean;
  connected: boolean;
  onLeave: () => void;
  onSendChat: (message: string) => void;
  onSetReady: (ready: boolean) => void;
  onStart: () => void;
  room: RoomSummary;
  userId: number;
};

export function MultiplayerLobbyPage({ canStart, connected, onLeave, onSendChat, onSetReady, onStart, room, userId }: Props) {
  const currentPlayer = room.players.find((player) => player.userId === userId);
  const isReady = currentPlayer?.ready ?? false;
  const [message, setMessage] = useState("");
  const enoughPlayers = room.playerCount >= 2;
  const allReady = room.players.every((player) => player.ready);
  const canActuallyStart = canStart && enoughPlayers && allReady;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    onSendChat(message.trim());
    setMessage("");
  }

  return (
    <section className="menu-screen multiplayer-lobby-screen">
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-lobby-card">
        <div className="multiplayer-lobby-header">
          <div>
            <h1 className="home-card__title">{copy.multiplayer.lobbyTitle}</h1>
            <p className="home-card__subtitle">{copy.multiplayer.roomCode} {room.roomCode}</p>
          </div>
          <strong>{connected ? copy.multiplayer.statusConnected : copy.multiplayer.statusConnecting}</strong>
        </div>

        <div className="multiplayer-lobby-options">
          <span>{copy.multiplayer.difficulty}: {room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
          <span>{copy.multiplayer.bodyBlock}: {room.options.bodyBlock ? "ON" : "OFF"}</span>
          <span>{copy.multiplayer.debuffTier}: {room.options.debuffTier}</span>
        </div>

        <ul className="multiplayer-player-list">
          {room.players.map((player) => (
            <li key={player.userId} className="multiplayer-player-row">
              <span>{player.username}{player.isHost ? " · HOST" : ""}</span>
              <strong>{player.ready ? copy.multiplayer.ready : copy.multiplayer.waitingRoom}</strong>
            </li>
          ))}
        </ul>

        <div className="multiplayer-lobby-actions">
          <button className="ghost-button subtle-button" onClick={() => onSetReady(!isReady)}>{isReady ? copy.multiplayer.cancelReady : copy.multiplayer.ready}</button>
          <button className="home-start-button" onClick={onStart} disabled={!canActuallyStart}>{copy.multiplayer.start}</button>
        </div>

        {!enoughPlayers ? <p className="home-card__meta">{copy.multiplayer.startNeedPlayers}</p> : null}
        {enoughPlayers && !allReady ? <p className="home-card__meta">{copy.multiplayer.startNeedReady}</p> : null}
        {canStart ? <p className="home-card__meta">{copy.multiplayer.startHint}</p> : null}

        <div className="multiplayer-chat-panel">
          <h2>{copy.multiplayer.chat}</h2>
          <ul className="multiplayer-chat-log">
            {room.chatMessages.length > 0 ? room.chatMessages.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.username}</strong>
                <span>{entry.message}</span>
              </li>
            )) : <li><span>{copy.records.none}</span></li>}
          </ul>
          <form className="multiplayer-chat-form" onSubmit={handleSubmit}>
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} placeholder={copy.multiplayer.chat} />
            <button className="ghost-button subtle-button" type="submit">{copy.multiplayer.sendChat}</button>
          </form>
        </div>

        <button className="ghost-button subtle-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
      </div>
    </section>
  );
}
