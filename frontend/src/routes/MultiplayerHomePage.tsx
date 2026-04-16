import { FormEvent, useEffect, useMemo, useState } from "react";

import { copy } from "../content/copy";
import type { CreateRoomPayload, JoinRoomPayload, QuickJoinPayload, RoomListEntry, RoomOptions } from "../lib/multiplayerClient";

type Props = {
  onCreateRoom: (payload: CreateRoomPayload) => Promise<void> | void;
  onJoinRoom: (payload: JoinRoomPayload) => Promise<void> | void;
  onQuickJoin: (payload: QuickJoinPayload) => Promise<void> | void;
  loadRooms: () => Promise<RoomListEntry[]>;
  onBack: () => void;
};

const defaultOptions: RoomOptions = {
  difficulty: "normal",
  visibility: "public",
  bodyBlock: false,
  debuffTier: 2,
};

const roomMaxPlayerOptions = [2, 3, 4, 5, 6, 7, 8] as const;

function debuffTierLabel(debuffTier: RoomOptions["debuffTier"]) {
  return debuffTier === 3 ? copy.multiplayer.debuffTierStrong : copy.multiplayer.debuffTierWeak;
}

function formatRoomSubtitle(room: RoomListEntry) {
  return `${copy.multiplayer.players} ${room.playerCount}/${room.maxPlayers} · ${
    room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal
  }`;
}

export function MultiplayerHomePage({ onCreateRoom, onJoinRoom, onQuickJoin, loadRooms, onBack }: Props) {
  const [createPrivatePassword, setCreatePrivatePassword] = useState("");
  const [rooms, setRooms] = useState<RoomListEntry[]>([]);
  const [roomPasswords, setRoomPasswords] = useState<Record<string, string>>({});
  const [showCreateSetup, setShowCreateSetup] = useState(false);
  const [options, setOptions] = useState<RoomOptions>(defaultOptions);
  const [maxPlayers, setMaxPlayers] = useState<number>(8);
  const [loadingRooms, setLoadingRooms] = useState(false);

  async function refreshRooms() {
    setLoadingRooms(true);
    try {
      setRooms(await loadRooms());
    } finally {
      setLoadingRooms(false);
    }
  }

  useEffect(() => {
    void refreshRooms();

    const interval = window.setInterval(() => {
      void refreshRooms();
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const roomGroups = useMemo(() => ({
    publicRooms: rooms.filter((room) => room.options.visibility === "public"),
    privateRooms: rooms.filter((room) => room.options.visibility === "private"),
  }), [rooms]);

  function handlePrivateJoin(event: FormEvent<HTMLFormElement>, roomId: string) {
    event.preventDefault();
    const privatePassword = roomPasswords[roomId]?.trim() ?? "";
    if (privatePassword.length === 0) {
      return;
    }
    onJoinRoom({ roomId, privatePassword });
  }

  return (
    <section className="menu-screen multiplayer-home-screen">
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-home-card multiplayer-home-card--stitch">
        <div className="multiplayer-screen-heading multiplayer-screen-heading--stacked">
          <div>
            <p className="panel-kicker">{copy.multiplayer.entry}</p>
            <h1 className="home-card__title">{copy.multiplayer.homeTitle}</h1>
          </div>
          <button className="ghost-button subtle-button" onClick={onBack}>{copy.records.back}</button>
        </div>

        <section className="multiplayer-feature-band">
          <article className="matchmaking-card matchmaking-card--highlight matchmaking-card--heroic matchmaking-card--stitch">
            <span className="info-card__label">FAST MATCH</span>
            <strong>{copy.multiplayer.quickJoin}</strong>
            <div className="matchmaking-card__chips">
              <span className="home-status-chip">{copy.multiplayer.publicRoom}</span>
              <span className="home-status-chip">{copy.multiplayer.quickJoinMeta}</span>
            </div>
            <button className="home-start-button home-start-button--hero" onClick={() => onQuickJoin({})}>{copy.multiplayer.quickJoin}</button>
          </article>

          <article className="matchmaking-card matchmaking-card--heroic matchmaking-card--stitch">
            <span className="info-card__label">ROOM HOST</span>
            <strong>{copy.multiplayer.createRoom}</strong>
            <div className="matchmaking-card__chips">
              <span className="home-status-chip">{options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</span>
              <span className="home-status-chip">{copy.multiplayer.maxPlayersChip(maxPlayers)}</span>
              <span className="home-status-chip">{copy.multiplayer.bodyBlock} {options.bodyBlock ? "ON" : "OFF"}</span>
              <span className="home-status-chip">{debuffTierLabel(options.debuffTier)}</span>
            </div>
            <button className="ghost-button subtle-button" onClick={() => setShowCreateSetup(true)}>{copy.multiplayer.createRoom}</button>
          </article>
        </section>

        <section className="records-section multiplayer-room-browser">
          <div className="records-section-heading">
            <div>
              <span className="panel-kicker">{copy.multiplayer.roomList}</span>
              <h2>{copy.multiplayer.roomList}</h2>
            </div>
            <button className="ghost-button subtle-button" type="button" onClick={() => void refreshRooms()}>{copy.multiplayer.refreshRooms}</button>
          </div>

          {loadingRooms ? <p>{copy.records.loading}</p> : null}

          {!loadingRooms && rooms.length === 0 ? (
            <div className="records-empty">{copy.multiplayer.noRooms}</div>
          ) : null}

          {roomGroups.publicRooms.length > 0 ? (
            <div className="multiplayer-room-group">
              <div className="multiplayer-room-group__heading">
                <span className="room-visibility-badge">{copy.multiplayer.publicRoom}</span>
              </div>
              <div className="multiplayer-room-list">
                {roomGroups.publicRooms.map((room) => (
                  <article key={room.roomId} className="multiplayer-room-card multiplayer-room-card--public">
                    <div className="multiplayer-room-card__header">
                      <div>
                        <strong>{room.hostUsername} · HOST</strong>
                        <p>{formatRoomSubtitle(room)}</p>
                      </div>
                      <span className="room-visibility-badge room-visibility-badge--public">{copy.multiplayer.publicRoom}</span>
                    </div>

                    <div className="matchmaking-card__chips">
                      <span className="home-status-chip">{room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
                      <span className="home-status-chip">{copy.multiplayer.bodyBlock} {room.options.bodyBlock ? "ON" : "OFF"}</span>
                      <span className="home-status-chip">{copy.multiplayer.debuffTier} {debuffTierLabel(room.options.debuffTier)}</span>
                    </div>

                    <button className="ghost-button subtle-button" type="button" onClick={() => onJoinRoom({ roomId: room.roomId })}>
                      {copy.multiplayer.joinPublic}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {roomGroups.privateRooms.length > 0 ? (
            <div className="multiplayer-room-group">
              <div className="multiplayer-room-group__heading">
                <span className="room-visibility-badge room-visibility-badge--private">{copy.multiplayer.privateRoom}</span>
              </div>
              <div className="multiplayer-room-list">
                {roomGroups.privateRooms.map((room) => {
                  const currentPassword = roomPasswords[room.roomId] ?? "";
                  return (
                    <article key={room.roomId} className="multiplayer-room-card multiplayer-room-card--private">
                      <div className="multiplayer-room-card__header">
                        <div>
                          <strong>{room.hostUsername} · HOST</strong>
                          <p>{formatRoomSubtitle(room)}</p>
                        </div>
                        <span className="room-visibility-badge room-visibility-badge--private">{copy.multiplayer.privateRoom}</span>
                      </div>

                      <div className="matchmaking-card__chips">
                        <span className="home-status-chip">{room.options.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
                        <span className="home-status-chip">{copy.multiplayer.bodyBlock} {room.options.bodyBlock ? "ON" : "OFF"}</span>
                        <span className="home-status-chip">{copy.multiplayer.debuffTier} {debuffTierLabel(room.options.debuffTier)}</span>
                      </div>

                      <form className="multiplayer-room-card__join" onSubmit={(event) => handlePrivateJoin(event, room.roomId)}>
                        <label>
                          <span>{copy.multiplayer.privatePassword}</span>
                          <input
                            value={currentPassword}
                            onChange={(event) => setRoomPasswords((current) => ({ ...current, [room.roomId]: event.target.value }))}
                            placeholder={copy.multiplayer.passwordPlaceholder}
                          />
                        </label>
                        <button className="ghost-button subtle-button" type="submit" disabled={currentPassword.trim().length === 0}>
                          {copy.multiplayer.joinPrivate}
                        </button>
                      </form>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

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
                  <span>{copy.multiplayer.maxPlayers}</span>
                  <select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>
                    {roomMaxPlayerOptions.map((value) => (
                      <option key={value} value={value}>{copy.multiplayer.maxPlayersOption(value)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{copy.multiplayer.debuffTier}</span>
                  <select value={options.debuffTier} onChange={(event) => setOptions((current) => ({ ...current, debuffTier: Number(event.target.value) as RoomOptions["debuffTier"] }))}>
                    <option value={2}>{copy.multiplayer.debuffTierWeak}</option>
                    <option value={3}>{copy.multiplayer.debuffTierStrong}</option>
                  </select>
                </label>
                <label>
                  <span>{copy.multiplayer.bodyBlock}</span>
                  <select
                    value={options.bodyBlock ? "on" : "off"}
                    onChange={(event) => setOptions((current) => ({ ...current, bodyBlock: event.target.value === "on" }))}
                  >
                    <option value="off">OFF</option>
                    <option value="on">ON</option>
                  </select>
                </label>
                {options.visibility === "private" ? (
                  <label>
                    <span>{copy.multiplayer.privatePassword}</span>
                    <input value={createPrivatePassword} onChange={(event) => setCreatePrivatePassword(event.target.value)} placeholder={copy.multiplayer.passwordPlaceholder} />
                  </label>
                ) : null}
              </div>
              <button
                className="home-start-button home-start-button--hero"
                onClick={() => onCreateRoom({ options, maxPlayers, privatePassword: options.visibility === "private" ? createPrivatePassword.trim() : undefined })}
                disabled={options.visibility === "private" && createPrivatePassword.trim().length === 0}
              >
                {copy.multiplayer.createRoom}
              </button>
              <button className="ghost-button subtle-button menu-close-button" onClick={() => setShowCreateSetup(false)}>{copy.records.back}</button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
