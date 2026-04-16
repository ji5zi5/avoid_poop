import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";

import type { RoomSummary } from "../lib/multiplayerClient";
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
  onStart: () => void;
  room: RoomSummary;
  userId: number;
};

function debuffTierLabel(debuffTier: RoomSummary["options"]["debuffTier"]) {
  return debuffTier === 3 ? copy.multiplayer.debuffTierStrong : copy.multiplayer.debuffTierWeak;
}

type PendingModerationAction = {
  playerId: number;
  playerName: string;
  type: "kick" | "transfer";
};

export function MultiplayerLobbyPage({ canStart, connected, onLeave, onSendChat, onSetReady, onKickPlayer, onTransferHost, onStart, room, userId }: Props) {
  const currentPlayer = room.players.find((player) => player.userId === userId);
  const playerColors = getMultiplayerColorMap(room.players);
  const isReady = currentPlayer?.ready ?? false;
  const isHost = currentPlayer?.isHost ?? canStart;
  const [message, setMessage] = useState("");
  const [openManagePlayerId, setOpenManagePlayerId] = useState<number | null>(null);
  const [pendingModerationAction, setPendingModerationAction] = useState<PendingModerationAction | null>(null);
  const chatLogRef = useRef<HTMLUListElement | null>(null);
  const managePopoverRef = useRef<HTMLDivElement | null>(null);
  const enoughPlayers = room.playerCount >= 2;
  const allReady = room.players.every((player) => player.ready);
  const canActuallyStart = canStart && enoughPlayers && allReady;
  const readyCount = room.players.filter((player) => player.ready).length;
  const lobbyStateLabel = !enoughPlayers
    ? copy.multiplayer.startNeedPlayers
    : !allReady
      ? copy.multiplayer.startNeedReady
      : copy.multiplayer.startHint;
  const actionTitle = isHost ? "방장 권한" : isReady ? "준비 완료" : "준비 필요";
  const actionSummary = isHost
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
              <button className="home-start-button home-start-button--hero" onClick={primaryAction} disabled={isHost ? !canActuallyStart : false}>
                {primaryActionLabel}
              </button>
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
    </section>
  );
}
