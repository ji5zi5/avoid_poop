import { FormEvent, useEffect, useState } from "react";

import type { CreateRoomPayload, QuickJoinPayload, RoomOptions, RoomSummary } from "../lib/multiplayerClient";
import { copy } from "../content/copy";

type Props = {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<void> | void;
  onJoinPublicRoom: (roomCode: string) => Promise<void> | void;
  onJoinPrivateRoom: (privatePassword: string) => Promise<void> | void;
  onQuickJoin: (payload: QuickJoinPayload) => Promise<void> | void;
  loadPublicRooms: () => Promise<RoomSummary[]>;
  onBack: () => void;
};

const defaultOptions: RoomOptions = {
  difficulty: "normal",
  visibility: "public",
  bodyBlock: false,
  debuffTier: 2,
};

function debuffTierLabel(debuffTier: RoomOptions["debuffTier"]) {
  return debuffTier === 3 ? copy.multiplayer.debuffTierStrong : copy.multiplayer.debuffTierWeak;
}

export function MultiplayerHomePage({ onCreateRoom, onJoinPublicRoom, onJoinPrivateRoom, onQuickJoin, loadPublicRooms, onBack }: Props) {
  const [privatePassword, setPrivatePassword] = useState("");
  const [createPrivatePassword, setCreatePrivatePassword] = useState("");
  const [publicRooms, setPublicRooms] = useState<RoomSummary[]>([]);
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [options, setOptions] = useState<RoomOptions>(defaultOptions);
  const [loadingRooms, setLoadingRooms] = useState(false);

  async function refreshPublicRooms() {
    setLoadingRooms(true);
    try {
      setPublicRooms(await loadPublicRooms());
    } finally {
      setLoadingRooms(false);
    }
  }

  useEffect(() => {
    void refreshPublicRooms();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoinPrivateRoom(privatePassword.trim());
  }

  return (
    <section className="menu-screen multiplayer-home-screen">
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-home-card multiplayer-home-card--stitch">
        <div className="multiplayer-screen-heading">
          <div>
            <p className="panel-kicker">{copy.multiplayer.entry}</p>
            <h1 className="home-card__title">{copy.multiplayer.homeTitle}</h1>
            <p className="home-card__meta">빠른 입장은 공개방 즉시 입장, 공개방 목록은 골라 들어가고, 비공개방은 비밀번호로 참가합니다.</p>
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

        <article className="matchmaking-card">
          <div className="multiplayer-screen-heading">
            <div>
              <span className="info-card__label">{copy.multiplayer.publicRooms}</span>
              <strong>{copy.multiplayer.publicRooms}</strong>
              <p>{copy.multiplayer.publicRoomsHint}</p>
            </div>
            <button className="ghost-button subtle-button" type="button" onClick={() => void refreshPublicRooms()}>{copy.multiplayer.refreshRooms}</button>
          </div>
          {loadingRooms ? <p>{copy.records.loading}</p> : null}
          {publicRooms.length > 0 ? (
            <div className="multiplayer-public-room-list">
              {publicRooms.map((room) => (
                <article key={room.roomCode} className="multiplayer-public-room-card">
                  <div>
                    <strong>{room.players[0]?.username ?? "HOST"} · HOST</strong>
                    <p>{copy.multiplayer.players} {room.playerCount}/8 · {room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</p>
                  </div>
                  <div className="matchmaking-card__chips">
                    <span className="home-status-chip">{room.options.bodyBlock ? "길막 ON" : "길막 OFF"}</span>
                    <span className="home-status-chip">{copy.multiplayer.debuffTier} {debuffTierLabel(room.options.debuffTier)}</span>
                  </div>
                  <button className="ghost-button subtle-button" type="button" onClick={() => onJoinPublicRoom(room.roomCode)}>입장</button>
                </article>
              ))}
            </div>
          ) : (
            !loadingRooms ? <p>{copy.multiplayer.noPublicRooms}</p> : null
          )}
        </article>

        <form className="multiplayer-code-form multiplayer-code-form--card multiplayer-code-form--heroic" onSubmit={handleSubmit}>
          <label>
            <span>{copy.multiplayer.privatePassword}</span>
            <input value={privatePassword} onChange={(event) => setPrivatePassword(event.target.value)} placeholder={copy.multiplayer.passwordPlaceholder} />
          </label>
          <button className="ghost-button subtle-button" type="submit" disabled={privatePassword.trim().length < 4}>{copy.multiplayer.joinPrivate}</button>
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
                    <option value={2}>{copy.multiplayer.debuffTierWeak}</option>
                    <option value={3}>{copy.multiplayer.debuffTierStrong}</option>
                  </select>
                </label>
                <label className="multiplayer-home-toggle">
                  <span>{copy.multiplayer.bodyBlock}</span>
                  <input type="checkbox" checked={options.bodyBlock} onChange={(event) => setOptions((current) => ({ ...current, bodyBlock: event.target.checked }))} />
                </label>
                {options.visibility === "private" ? (
                  <label>
                    <span>{copy.multiplayer.privatePassword}</span>
                    <input value={createPrivatePassword} onChange={(event) => setCreatePrivatePassword(event.target.value)} placeholder={copy.multiplayer.passwordPlaceholder} />
                  </label>
                ) : null}
                <p className="home-card__meta multiplayer-option-note">{copy.multiplayer.jumpHint}</p>
              </div>
              <button className="home-start-button home-start-button--hero" onClick={() => onCreateRoom({ options, privatePassword: options.visibility === "private" ? createPrivatePassword.trim() : undefined })} disabled={options.visibility === "private" && createPrivatePassword.trim().length < 4}>{copy.multiplayer.createRoom}</button>
              <button className="ghost-button subtle-button menu-close-button" onClick={() => setShowCreateSetup(false)}>{copy.records.back}</button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
