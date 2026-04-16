import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";

import type { LobbyNoticeTone, RoomOptions, RoomSummary, UpdateRoomSettingsPayload } from "../lib/multiplayerClient";
import { copy } from "../content/copy";
import { getMultiplayerColorMap } from "../lib/multiplayerColors";

type Props = {
  canStart: boolean;
  connected: boolean;
  onLeave: () => void;
  onSendChat: (message: string) => void;
  onSetReady: (ready: boolean) => void;
  onKickPlayer: (userId: number) => void;
  onTransferHost: (userId: number) => void;
  onUpdateRoomSettings: (settings: UpdateRoomSettingsPayload) => void;
  onStart: () => void;
  countdownSignal?: { secondsRemaining: number; issuedAt: number } | null;
  room: RoomSummary;
  toastSignal?: { message: string; tone: LobbyNoticeTone; issuedAt: number } | null;
  userId: number;
};

const roomMaxPlayerOptions = [2, 3, 4, 5, 6, 7, 8] as const;

function debuffTierLabel(debuffTier: RoomSummary["options"]["debuffTier"]) {
  return debuffTier === 3 ? copy.multiplayer.debuffTierStrong : copy.multiplayer.debuffTierWeak;
}

type PendingModerationAction = {
  playerId: number;
  playerName: string;
  type: "kick" | "transfer";
};

export function MultiplayerLobbyPage({ canStart, connected, onLeave, onSendChat, onSetReady, onKickPlayer, onTransferHost, onUpdateRoomSettings, onStart, countdownSignal = null, room, toastSignal = null, userId }: Props) {
  const currentPlayer = room.players.find((player) => player.userId === userId);
  const playerColors = getMultiplayerColorMap(room.players);
  const isReady = currentPlayer?.ready ?? false;
  const isHost = currentPlayer?.isHost ?? canStart;
  const [message, setMessage] = useState("");
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [settingsOptions, setSettingsOptions] = useState<RoomOptions>(room.options);
  const [settingsMaxPlayers, setSettingsMaxPlayers] = useState<number>(room.maxPlayers);
  const [settingsPrivatePassword, setSettingsPrivatePassword] = useState("");
  const [openManagePlayerId, setOpenManagePlayerId] = useState<number | null>(null);
  const [pendingModerationAction, setPendingModerationAction] = useState<PendingModerationAction | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: LobbyNoticeTone } | null>(null);
  const chatLogRef = useRef<HTMLUListElement | null>(null);
  const managePopoverRef = useRef<HTMLDivElement | null>(null);
  const enoughPlayers = room.playerCount >= 2;
  const allReady = room.players.every((player) => player.ready);
  const canActuallyStart = canStart && enoughPlayers && allReady;
  const readyCount = room.players.filter((player) => player.ready).length;
  const countdownSecondsRemaining = countdownSignal?.secondsRemaining ?? null;
  const countdownActive = room.status === "starting" && countdownSecondsRemaining !== null;
  const lobbyStateLabel = countdownActive
    ? copy.multiplayer.startingSoon(countdownSecondsRemaining)
    : !enoughPlayers
      ? copy.multiplayer.startNeedPlayers
      : !allReady
        ? copy.multiplayer.startNeedReady
        : copy.multiplayer.startHint;
  const actionTitle = countdownActive ? "곧 시작" : isHost ? "방장 권한" : isReady ? "준비 완료" : "준비 필요";
  const actionSummary = countdownActive
    ? "카운트다운이 끝나면 바로 게임 화면으로 넘어갑니다."
    : isHost
      ? canActuallyStart
        ? "지금 바로 시작할 수 있습니다."
        : `${readyCount}/${room.playerCount}명 준비 · 전원이 준비되면 시작 가능합니다.`
      : isReady
        ? "방장이 시작하면 바로 입장합니다."
        : "준비를 눌러야 방장이 게임을 시작할 수 있습니다.";
  const primaryActionLabel = isHost ? copy.multiplayer.start : isReady ? copy.multiplayer.cancelReady : copy.multiplayer.ready;
  const primaryAction = () => {
    if (isHost) {
      onStart();
      return;
    }
    onSetReady(!isReady);
  };
  const canManagePlayers = isHost && room.status === "waiting" && room.playerCount > 1;

  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (!chatLog) {
      return;
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }, [room.chatMessages.length]);

  useEffect(() => {
    if (!openManagePlayerId) {
      return;
    }
    if (!room.players.some((player) => player.userId === openManagePlayerId && player.userId !== userId)) {
      setOpenManagePlayerId(null);
    }
  }, [openManagePlayerId, room.players, userId]);

  useEffect(() => {
    if (!canManagePlayers && openManagePlayerId !== null) {
      setOpenManagePlayerId(null);
    }
  }, [canManagePlayers, openManagePlayerId]);

  useEffect(() => {
    if (!isHost) {
      setShowSettingsSheet(false);
      return;
    }
    if (!showSettingsSheet) {
      setSettingsOptions(room.options);
      setSettingsMaxPlayers(room.maxPlayers);
      setSettingsPrivatePassword("");
    }
  }, [isHost, room.maxPlayers, room.options, showSettingsSheet]);

  useEffect(() => {
    if (countdownActive && showSettingsSheet) {
      setShowSettingsSheet(false);
    }
  }, [countdownActive, showSettingsSheet]);

  useEffect(() => {
    if (!openManagePlayerId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const surface = managePopoverRef.current;
      if (!surface) {
        return;
      }
      if (event.target instanceof Node && surface.contains(event.target)) {
        return;
      }
      setOpenManagePlayerId(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenManagePlayerId(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openManagePlayerId]);

  useEffect(() => {
    if (!pendingModerationAction) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingModerationAction(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingModerationAction]);

  useEffect(() => {
    if (!toastSignal) {
      return;
    }
    setToast({ message: toastSignal.message, tone: toastSignal.tone });
  }, [toastSignal]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }
    onSendChat(message.trim());
    setMessage("");
  }

  function openManageMenu(event: MouseEvent<HTMLElement>, targetUserId: number) {
    event.preventDefault();
    if (!canManagePlayers) {
      return;
    }
    setPendingModerationAction(null);
    setOpenManagePlayerId((current) => current === targetUserId ? null : targetUserId);
  }

  function requestModerationAction(type: PendingModerationAction["type"], playerId: number, playerName: string) {
    setOpenManagePlayerId(null);
    setPendingModerationAction({ type, playerId, playerName });
  }

  function confirmModerationAction() {
    if (!pendingModerationAction) {
      return;
    }

    if (pendingModerationAction.type === "transfer") {
      onTransferHost(pendingModerationAction.playerId);
    } else {
      onKickPlayer(pendingModerationAction.playerId);
    }
    setPendingModerationAction(null);
  }

  function openSettingsSheet() {
    setSettingsOptions(room.options);
    setSettingsMaxPlayers(room.maxPlayers);
    setSettingsPrivatePassword("");
    setShowSettingsSheet(true);
  }

  function handleSaveRoomSettings() {
    onUpdateRoomSettings({
      options: settingsOptions,
      maxPlayers: settingsMaxPlayers,
      privatePassword: settingsOptions.visibility === "private" && settingsPrivatePassword.trim().length > 0
        ? settingsPrivatePassword.trim()
        : undefined,
    });
    setShowSettingsSheet(false);
  }

  const availableMaxPlayerOptions = roomMaxPlayerOptions.filter((value) => value >= room.playerCount);
  const needsPrivatePassword = settingsOptions.visibility === "private" && room.options.visibility !== "private" && settingsPrivatePassword.trim().length === 0;

  return (
    <section className="menu-screen multiplayer-lobby-screen">
      <div className="console-panel console-panel--primary console-panel--compact multiplayer-lobby-card multiplayer-lobby-card--stitch">
        {toast ? (
          <div className={`multiplayer-lobby-toast multiplayer-lobby-toast--${toast.tone}`} role="status" aria-live="polite">
            {toast.message}
          </div>
        ) : null}
        {countdownActive ? (
          <div className="multiplayer-lobby-countdown" role="status" aria-live="assertive">
            <span className="panel-kicker">COUNTDOWN</span>
            <strong>{copy.multiplayer.startingSoon(countdownSecondsRemaining)}</strong>
          </div>
        ) : null}
        <div className="multiplayer-lobby-header multiplayer-lobby-header--heroic">
          <div>
            <p className="panel-kicker">{copy.multiplayer.entry}</p>
            <h1 className="home-card__title">{copy.multiplayer.lobbyTitle}</h1>
            <div className="room-code-chip">{room.options.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</div>
          </div>
          <div className="multiplayer-lobby-header__aside">
            <strong className={`room-status-chip ${connected ? "is-live" : ""}`}>{connected ? copy.multiplayer.statusConnected : copy.multiplayer.statusConnecting}</strong>
          </div>
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
                    onContextMenu={(event) => {
                      if (player.userId === userId || player.isHost) {
                        return;
                      }
                      openManageMenu(event, player.userId);
                    }}
                    style={{
                      "--player-accent": playerColors.get(player.userId)?.accent,
                      "--player-soft": playerColors.get(player.userId)?.soft,
                      "--player-ink": playerColors.get(player.userId)?.ink,
                    } as React.CSSProperties}
                  >
                    <div className="lobby-player-identity">
                      <span className="lobby-player-avatar">{player.username.slice(0, 1).toUpperCase()}</span>
                      <div className="lobby-player-copy">
                        <div className="lobby-player-title-row">
                          <span>{player.username}</span>
                          <span className={`lobby-player-role ${player.isHost ? "is-host" : ""}`}>{player.isHost ? copy.multiplayer.hostBadge : copy.multiplayer.participantBadge}</span>
                        </div>
                        <small>{player.userId === userId ? (player.isHost ? "내 방" : "내 자리") : player.ready ? "준비 완료" : "대기 중"}</small>
                      </div>
                    </div>
                    <div className="lobby-player-actions">
                      <strong className={`room-status-chip ${player.ready ? "is-live" : ""}`}>{player.ready ? copy.multiplayer.ready : copy.multiplayer.waitingRoom}</strong>
                      {canManagePlayers && player.userId !== userId ? (
                        <div
                          className="lobby-player-manage-shell"
                          ref={openManagePlayerId === player.userId ? managePopoverRef : null}
                        >
                          <button
                            type="button"
                            className={`ghost-button subtle-button lobby-player-manage-button ${openManagePlayerId === player.userId ? "is-open" : ""}`}
                            onClick={(event) => openManageMenu(event, player.userId)}
                            aria-label={`${player.username} ${copy.multiplayer.manage}`}
                          >
                            ⋯
                          </button>
                          {openManagePlayerId === player.userId ? (
                            <div className="lobby-player-manage-popover" role="menu" aria-label={copy.multiplayer.moderationMenuHint}>
                              <div className="lobby-player-manage-popover__header">
                                <span className="panel-kicker">{copy.multiplayer.manage}</span>
                                <strong>{player.username}</strong>
                              </div>
                              <button
                                type="button"
                                className="ghost-button subtle-button lobby-player-manage-popover__action"
                                onClick={() => requestModerationAction("transfer", player.userId, player.username)}
                              >
                                {copy.multiplayer.transferHost}
                              </button>
                              <button
                                type="button"
                                className="ghost-button subtle-button lobby-player-manage-popover__action lobby-player-manage-popover__action--danger"
                                onClick={() => requestModerationAction("kick", player.userId, player.username)}
                              >
                                {copy.multiplayer.kickPlayer}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
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

        <div className="multiplayer-lobby-footer">
          <div className="multiplayer-lobby-action-card">
            <div className="multiplayer-lobby-action-card__copy">
              <span className="panel-kicker">{isHost ? "HOST" : "PLAYER"}</span>
              <div>
                <h2>{actionTitle}</h2>
                <p>{actionSummary}</p>
              </div>
            </div>
            <div className="multiplayer-lobby-actions multiplayer-lobby-actions--heroic">
              <button
                className="home-start-button home-start-button--hero"
                onClick={primaryAction}
                disabled={isHost ? !canActuallyStart || countdownActive : countdownActive}
              >
                {primaryActionLabel}
              </button>
              {isHost ? (
                <button
                  type="button"
                  className="ghost-button subtle-button multiplayer-lobby-settings-button"
                  onClick={openSettingsSheet}
                  disabled={countdownActive}
                >
                  {copy.multiplayer.editRoomSetup}
                </button>
              ) : null}
              <button className="ghost-button subtle-button multiplayer-lobby-leave-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
            </div>
          </div>
          <p className="home-card__meta">{lobbyStateLabel}</p>
        </div>
      </div>

      {pendingModerationAction ? (
        <div className="menu-selection-sheet menu-selection-sheet--centered" role="dialog" aria-modal="true" aria-label={pendingModerationAction.type === "transfer" ? copy.multiplayer.moderationTransferTitle : copy.multiplayer.moderationKickTitle}>
          <div className="menu-selection-sheet__scrim" onClick={() => setPendingModerationAction(null)} />
          <div className="menu-selection-sheet__panel multiplayer-moderation-modal">
            <span className="panel-kicker">{copy.multiplayer.manage}</span>
            <div className="multiplayer-moderation-modal__copy">
              <h2>{pendingModerationAction.type === "transfer" ? copy.multiplayer.moderationTransferTitle : copy.multiplayer.moderationKickTitle}</h2>
              <p>
                {pendingModerationAction.type === "transfer"
                  ? copy.multiplayer.moderationTransferMessage(pendingModerationAction.playerName)
                  : copy.multiplayer.moderationKickMessage(pendingModerationAction.playerName)}
              </p>
            </div>
            <div className="multiplayer-moderation-target">
              <span className="lobby-player-avatar">{pendingModerationAction.playerName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{pendingModerationAction.playerName}</strong>
                <p>{pendingModerationAction.type === "transfer" ? "새 방장으로 지정" : "대기방에서 즉시 제외"}</p>
              </div>
            </div>
            <div className="multiplayer-moderation-modal__actions">
              <button type="button" className="ghost-button subtle-button" onClick={() => setPendingModerationAction(null)}>
                {copy.multiplayer.moderationCancel}
              </button>
              <button
                type="button"
                className={`home-start-button multiplayer-moderation-modal__confirm ${pendingModerationAction.type === "kick" ? "is-danger" : ""}`}
                onClick={confirmModerationAction}
              >
                {pendingModerationAction.type === "transfer" ? copy.multiplayer.moderationTransferConfirm : copy.multiplayer.moderationKickConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSettingsSheet && isHost ? (
        <div className="menu-selection-sheet" role="dialog" aria-label={copy.multiplayer.editRoomSetup}>
          <div className="menu-selection-sheet__scrim" onClick={() => setShowSettingsSheet(false)} />
          <div className="menu-selection-sheet__panel multiplayer-create-sheet">
            <div className="multiplayer-settings-sheet__intro">
              <div>
                <p className="panel-kicker">{copy.multiplayer.editRoomSetup}</p>
                <h2>{copy.multiplayer.editRoomSetup}</h2>
                <p>{copy.multiplayer.settingsSheetHint}</p>
              </div>
              <div className="matchmaking-card__chips">
                <span className="home-status-chip">{settingsOptions.visibility === "public" ? copy.multiplayer.publicRoom : copy.multiplayer.privateRoom}</span>
                <span className="home-status-chip">{settingsOptions.difficulty === "hard" ? copy.multiplayer.difficultyHard : copy.multiplayer.difficultyNormal}</span>
                <span className="home-status-chip">{copy.multiplayer.maxPlayersChip(settingsMaxPlayers)}</span>
                <span className="home-status-chip">{settingsOptions.bodyBlock ? "부딪힘 ON" : "부딪힘 OFF"}</span>
              </div>
            </div>
            <div className="multiplayer-home-options multiplayer-home-options--refined multiplayer-home-options--heroic">
              <label>
                <span>{copy.multiplayer.visibility}</span>
                <select value={settingsOptions.visibility} onChange={(event) => setSettingsOptions((current) => ({ ...current, visibility: event.target.value as RoomOptions["visibility"] }))}>
                  <option value="public">{copy.multiplayer.publicRoom}</option>
                  <option value="private">{copy.multiplayer.privateRoom}</option>
                </select>
              </label>
              <label>
                <span>{copy.multiplayer.difficulty}</span>
                <select value={settingsOptions.difficulty} onChange={(event) => setSettingsOptions((current) => ({ ...current, difficulty: event.target.value as RoomOptions["difficulty"] }))}>
                  <option value="normal">{copy.multiplayer.difficultyNormal}</option>
                  <option value="hard">{copy.multiplayer.difficultyHard}</option>
                </select>
              </label>
              <label>
                <span>{copy.multiplayer.maxPlayers}</span>
                <select value={settingsMaxPlayers} onChange={(event) => setSettingsMaxPlayers(Number(event.target.value))}>
                  {availableMaxPlayerOptions.map((value) => (
                    <option key={value} value={value}>{copy.multiplayer.maxPlayersOption(value)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{copy.multiplayer.debuffTier}</span>
                <select value={settingsOptions.debuffTier} onChange={(event) => setSettingsOptions((current) => ({ ...current, debuffTier: Number(event.target.value) as RoomOptions["debuffTier"] }))}>
                  <option value={2}>{copy.multiplayer.debuffTierWeak}</option>
                  <option value={3}>{copy.multiplayer.debuffTierStrong}</option>
                </select>
              </label>
              <label>
                <span>{copy.multiplayer.bodyBlock}</span>
                <select
                  value={settingsOptions.bodyBlock ? "on" : "off"}
                  onChange={(event) => setSettingsOptions((current) => ({ ...current, bodyBlock: event.target.value === "on" }))}
                >
                  <option value="off">OFF</option>
                  <option value="on">ON</option>
                </select>
              </label>
              {settingsOptions.visibility === "private" ? (
                <label>
                  <span>{copy.multiplayer.privatePassword}</span>
                  <input
                    value={settingsPrivatePassword}
                    onChange={(event) => setSettingsPrivatePassword(event.target.value)}
                    placeholder={room.options.visibility === "private" ? copy.multiplayer.privatePasswordKeep : copy.multiplayer.passwordPlaceholder}
                  />
                </label>
              ) : null}
            </div>
            <button
              type="button"
              className="home-start-button home-start-button--hero"
              onClick={handleSaveRoomSettings}
              disabled={needsPrivatePassword}
            >
              {copy.multiplayer.saveRoomSettings}
            </button>
            <button type="button" className="ghost-button subtle-button menu-close-button" onClick={() => setShowSettingsSheet(false)}>
              {copy.records.back}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
