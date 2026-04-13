import type {RoomSummary} from "../lib/multiplayerClient";
import {copy} from "../content/copy";

type Props = {
  canStart: boolean;
  connected: boolean;
  onLeave: () => void;
  onSetReady: (ready: boolean) => void;
  onStart: () => void;
  room: RoomSummary;
  userId: number;
};

export function MultiplayerLobbyPage({canStart, connected, onLeave, onSetReady, onStart, room, userId}: Props) {
  const currentPlayer = room.players.find((player) => player.userId === userId);
  const isReady = currentPlayer?.ready ?? false;

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
          <span>{copy.multiplayer.bodyBlock}: {room.options.bodyBlock ? 'ON' : 'OFF'}</span>
          <span>{copy.multiplayer.debuffTier}: {room.options.debuffTier}</span>
        </div>

        <ul className="multiplayer-player-list">
          {room.players.map((player) => (
            <li key={player.userId} className="multiplayer-player-row">
              <span>{player.username}{player.isHost ? ' · HOST' : ''}</span>
              <strong>{player.ready ? copy.multiplayer.ready : copy.multiplayer.waitingRoom}</strong>
            </li>
          ))}
        </ul>

        <div className="multiplayer-lobby-actions">
          <button className="ghost-button subtle-button" onClick={() => onSetReady(!isReady)}>
            {isReady ? copy.multiplayer.cancelReady : copy.multiplayer.ready}
          </button>
          <button className="home-start-button" onClick={onStart} disabled={!canStart}>{copy.multiplayer.start}</button>
        </div>

        <button className="ghost-button subtle-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
      </div>
    </section>
  );
}
