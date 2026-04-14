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

function debuffTierLabel(debuffTier: RoomSummary["options"]["debuffTier"]) {
  return debuffTier === 3 ? copy.multiplayer.debuffTierStrong : copy.multiplayer.debuffTierWeak;
}

export function MultiplayerLobbyPage({ canStart, connected, onLeave, onSendChat, onSetReady, onStart, room, userId }: Props) {
  const currentPlayer = room.players.find((player) => player.userId === userId);
  const isReady = currentPlayer?.ready ?? false;
  const [message, setMessage] = useState("");
  const enoughPlayers = room.playerCount >= 2;
  const allReady = room.players.every((player) => player.ready);
  const canActuallyStart = canStart && enoughPlayers && allReady;
  const readyCount = room.players.filter((player) => player.ready).length;

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
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-lobby-card multiplayer-lobby-card--stitch">
        <div className="multiplayer-lobby-header multiplayer-lobby-header--heroic">
          <div>
            <p className="panel-kicker">{copy.multiplayer.entry}</p>
            <h1 className="home-card__title">{copy.multiplayer.lobbyTitle}</h1>
            <p className="home-card__meta">{connected ? "플레이어 준비 상태를 확인하고 시작 타이밍을 맞추세요." : "연결을 복구하는 동안 대기방 상태를 유지합니다."}</p>
            <div className="room-code-chip">{room.options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</div>
          </div>
          <strong className={`room-status-chip ${connected ? "is-live" : ""}`}>{connected ? copy.multiplayer.statusConnected : copy.multiplayer.statusConnecting}</strong>
        </div>

        <div className="lobby-summary-strip">
          <span className="home-status-chip">{copy.multiplayer.players} {room.playerCount}/8</span>
          <span className="home-status-chip">{room.options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</span>
          <span className="home-status-chip">{room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
          <span className="home-status-chip">{copy.multiplayer.debuffTier} {debuffTierLabel(room.options.debuffTier)}</span>
          <span className="home-status-chip">{copy.multiplayer.bodyBlock} {room.options.bodyBlock ? "ON" : "OFF"}</span>
        </div>

        <div className="multiplayer-lobby-shell">
          <div className="multiplayer-lobby-main">
            <div className="multiplayer-lobby-insights">
              <article className="multiplayer-lobby-insight-card">
                <span className="info-card__label">READY</span>
                <strong>{readyCount}/{room.playerCount}</strong>
                <p>{allReady ? "전원 준비 완료" : "시작 전에 전원 준비가 필요합니다"}</p>
              </article>
              <article className="multiplayer-lobby-insight-card">
                <span className="info-card__label">RULESET</span>
                <strong>{room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</strong>
                <p>{room.options.bodyBlock ? "점프로 부딪힘을 피할 수 있습니다" : "서로 통과 가능한 가벼운 규칙입니다"}</p>
              </article>
            </div>

            <div className="multiplayer-lobby-options multiplayer-lobby-options--heroic">
              <span>{copy.multiplayer.visibility}: {room.options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</span>
              <span>{copy.multiplayer.difficulty}: {room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
              <span>{copy.multiplayer.bodyBlock}: {room.options.bodyBlock ? "ON" : "OFF"}</span>
              <span>{copy.multiplayer.debuffTier}: {debuffTierLabel(room.options.debuffTier)}</span>
            </div>

            <ul className="multiplayer-player-list multiplayer-player-list--cards">
              {room.players.map((player) => (
                <li key={player.userId} className="multiplayer-player-row multiplayer-player-row--card">
                  <div className="lobby-player-identity">
                    <span className="lobby-player-avatar">{player.username.slice(0, 1).toUpperCase()}</span>
                    <div className="lobby-player-copy">
                      <span>{player.username}{player.isHost ? " · HOST" : ""}</span>
                      <small>{player.userId === userId ? "내 자리" : "대기 중"}</small>
                    </div>
                  </div>
                  <strong className={`room-status-chip ${player.ready ? "is-live" : ""}`}>{player.ready ? copy.multiplayer.ready : copy.multiplayer.waitingRoom}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="multiplayer-chat-panel multiplayer-chat-panel--heroic">
            <div className="multiplayer-chat-heading">
              <h2>{copy.multiplayer.chat}</h2>
              <span className="home-card__meta">전원 준비 확인하고 시작 타이밍을 맞추세요.</span>
            </div>
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
        </div>

        <div className="multiplayer-lobby-actions multiplayer-lobby-actions--heroic">
          <button className="ghost-button subtle-button" onClick={() => onSetReady(!isReady)}>{isReady ? copy.multiplayer.cancelReady : copy.multiplayer.ready}</button>
          <button className="home-start-button home-start-button--hero" onClick={onStart} disabled={!canActuallyStart}>{copy.multiplayer.start}</button>
        </div>

        {!enoughPlayers ? <p className="home-card__meta">{copy.multiplayer.startNeedPlayers}</p> : null}
        {enoughPlayers && !allReady ? <p className="home-card__meta">{copy.multiplayer.startNeedReady}</p> : null}
        {canStart ? <p className="home-card__meta">{copy.multiplayer.startHint}</p> : null}

        <button className="ghost-button subtle-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
      </div>
    </section>
  );
}
