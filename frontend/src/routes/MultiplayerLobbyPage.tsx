import { FormEvent, useEffect, useRef, useState } from "react";

import type { RoomSummary } from "../lib/multiplayerClient";
import { copy } from "../content/copy";
import { getMultiplayerColorMap } from "../lib/multiplayerColors";

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
  const playerColors = getMultiplayerColorMap(room.players);
  const isReady = currentPlayer?.ready ?? false;
  const [message, setMessage] = useState("");
  const chatLogRef = useRef<HTMLUListElement | null>(null);
  const enoughPlayers = room.playerCount >= 2;
  const allReady = room.players.every((player) => player.ready);
  const canActuallyStart = canStart && enoughPlayers && allReady;
  const readyCount = room.players.filter((player) => player.ready).length;
  const lobbyStateLabel = !enoughPlayers
    ? copy.multiplayer.startNeedPlayers
    : !allReady
      ? copy.multiplayer.startNeedReady
      : copy.multiplayer.startHint;

  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (!chatLog) {
      return;
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }, [room.chatMessages.length]);

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
            <div className="room-code-chip">{room.options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</div>
          </div>
          <strong className={`room-status-chip ${connected ? "is-live" : ""}`}>{connected ? copy.multiplayer.statusConnected : copy.multiplayer.statusConnecting}</strong>
        </div>

        <div className="lobby-summary-strip">
          <span className="home-status-chip">{copy.multiplayer.players} {room.playerCount}/8</span>
          <span className="home-status-chip">{room.options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</span>
          <span className="home-status-chip">{room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
          <span className="home-status-chip">{debuffTierLabel(room.options.debuffTier)}</span>
          <span className="home-status-chip">{room.options.bodyBlock ? "부딪힘 ON" : "부딪힘 OFF"}</span>
        </div>

        <div className="multiplayer-lobby-shell">
          <div className="multiplayer-lobby-main">
            <section className="multiplayer-lobby-roster">
              <div className="multiplayer-lobby-section-heading">
                <div>
                  <span className="panel-kicker">PLAYERS</span>
                  <h2>플레이어</h2>
                </div>
                <span className="room-status-chip">{readyCount}/{room.playerCount} 준비</span>
              </div>

              <ul className="multiplayer-player-list multiplayer-player-list--cards">
                {room.players.map((player) => (
                  <li
                    key={player.userId}
                    className="multiplayer-player-row multiplayer-player-row--card"
                    data-testid={`lobby-player-${player.userId}`}
                    style={{
                      "--player-accent": playerColors.get(player.userId)?.accent,
                      "--player-soft": playerColors.get(player.userId)?.soft,
                      "--player-ink": playerColors.get(player.userId)?.ink,
                    } as React.CSSProperties}
                  >
                    <div className="lobby-player-identity">
                      <span className="lobby-player-avatar">{player.username.slice(0, 1).toUpperCase()}</span>
                      <div className="lobby-player-copy">
                        <span>{player.username}{player.isHost ? " · HOST" : ""}</span>
                        <small>{player.userId === userId ? "내 자리" : player.ready ? "준비 완료" : "대기 중"}</small>
                      </div>
                    </div>
                    <strong className={`room-status-chip ${player.ready ? "is-live" : ""}`}>{player.ready ? copy.multiplayer.ready : copy.multiplayer.waitingRoom}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="multiplayer-chat-panel multiplayer-chat-panel--heroic">
            <div className="multiplayer-chat-heading">
              <div>
                <span className="panel-kicker">CHAT</span>
                <h2>{copy.multiplayer.chat}</h2>
              </div>
              <span className="home-card__meta">{room.chatMessages.length > 0 ? `${room.chatMessages.length}개` : connected ? "연결됨" : "복구 중"}</span>
            </div>
            <ul ref={chatLogRef} className="multiplayer-chat-log">
              {room.chatMessages.length > 0 ? room.chatMessages.map((entry) => (
                <li key={entry.id} className={`multiplayer-chat-message ${entry.userId === userId ? "is-self" : ""}`}>
                  <strong className="multiplayer-chat-message__author">{entry.username}</strong>
                  <span className="multiplayer-chat-message__body">{entry.message}</span>
                </li>
              )) : <li className="multiplayer-chat-log__empty"><span>아직 채팅이 없습니다</span></li>}
            </ul>
            <form className="multiplayer-chat-form" onSubmit={handleSubmit}>
              <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} placeholder={copy.multiplayer.chat} />
              <button className="ghost-button subtle-button" type="submit">{copy.multiplayer.sendChat}</button>
            </form>
          </div>
        </div>

        <div className="multiplayer-lobby-actions multiplayer-lobby-actions--heroic">
          {canStart ? (
            <button className="home-start-button home-start-button--hero" onClick={onStart} disabled={!canActuallyStart}>{copy.multiplayer.start}</button>
          ) : (
            <button className="home-start-button home-start-button--hero" onClick={() => onSetReady(!isReady)}>
              {isReady ? copy.multiplayer.cancelReady : copy.multiplayer.ready}
            </button>
          )}
        </div>

        <p className="home-card__meta">{lobbyStateLabel}</p>

        <button className="ghost-button subtle-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
      </div>
    </section>
  );
}
