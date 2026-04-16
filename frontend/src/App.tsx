import { useEffect, useMemo, useState } from "react";

import type { AuthUser, GameMode, RecordEntry } from "../../shared/src/contracts/index";
import { copy, translateErrorMessage } from "./content/copy";
import { api, clearStoredSessionToken } from "./lib/api";
import { createMultiplayerClient, type LobbyNoticeTone, type MultiplayerGameSnapshot, type RoomSummary } from "./lib/multiplayerClient";
import { AuthPage } from "./routes/AuthPage";
import { CareerPage } from "./routes/CareerPage";
import { GamePage } from "./routes/GamePage";
import { MenuPage } from "./routes/MenuPage";
import { MultiplayerGamePage } from "./routes/MultiplayerGamePage";
import { MultiplayerHomePage } from "./routes/MultiplayerHomePage";
import { MultiplayerLobbyPage } from "./routes/MultiplayerLobbyPage";
import { RecordsPage } from "./routes/RecordsPage";

type Screen = "auth" | "menu" | "game" | "records" | "career" | "multiplayer-home" | "multiplayer-lobby" | "multiplayer-game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<GameMode>("normal");
  const [saveCount, setSaveCount] = useState(0);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [game, setGame] = useState<MultiplayerGameSnapshot | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [reconnectSequence, setReconnectSequence] = useState(0);
  const [multiplayerNotice, setMultiplayerNotice] = useState<string | null>(null);
  const [multiplayerLobbyToast, setMultiplayerLobbyToast] = useState<{ message: string; tone: LobbyNoticeTone; issuedAt: number } | null>(null);
  const [multiplayerCountdown, setMultiplayerCountdown] = useState<{ secondsRemaining: number; issuedAt: number } | null>(null);

  const multiplayerClient = useMemo(
    () =>
      createMultiplayerClient({
        onClose: ({ wasConnected }) => {
          setSocketConnected(false);
          if (wasConnected) {
            setReconnectSequence((value) => value + 1);
          }
        },
        onEvent: (event) => {
          if (event.type === "connected") {
            setSocketConnected(true);
            return;
          }
          if (event.type === "room_snapshot") {
            setRoom(event.room);
            if (event.room.status !== "starting") {
              setMultiplayerCountdown(null);
            }
            if (event.room.status === "in_progress") {
              setScreen("multiplayer-game");
            }
            return;
          }
          if (event.type === "room_countdown") {
            setMultiplayerCountdown({
              secondsRemaining: event.countdown.secondsRemaining,
              issuedAt: Date.now(),
            });
            return;
          }
          if (event.type === "chat_message") {
            setRoom((current) => {
              if (!current || current.roomCode !== event.roomCode) {
                return current;
              }
              const nextMessages = [...current.chatMessages.filter((entry) => entry.id !== event.chatMessage.id), event.chatMessage].slice(-80);
              return {
                ...current,
                chatMessages: nextMessages,
              };
            });
            return;
          }
          if (event.type === "room_departed") {
            setMultiplayerNotice(event.message);
            setMultiplayerLobbyToast(null);
            setMultiplayerCountdown(null);
            setRoom(null);
            setGame(null);
            setSocketConnected(false);
            setScreen("multiplayer-home");
            return;
          }
          if (event.type === "lobby_notice") {
            setMultiplayerLobbyToast({
              message: event.notice.message,
              tone: event.notice.tone,
              issuedAt: Date.now(),
            });
            return;
          }
          if (event.type === "error") {
            setMultiplayerLobbyToast({
              message: translateErrorMessage(event.error),
              tone: "danger",
              issuedAt: Date.now(),
            });
            return;
          }
          if (event.type === "game_snapshot") {
            setMultiplayerCountdown(null);
            setGame(event.game);
            setScreen("multiplayer-game");
          }
        },
      }),
    [],
  );

  useEffect(() => {
    api
      .me()
      .then((session) => {
        setUser(session.user);
        setScreen(session.authenticated ? "menu" : "auth");
      })
      .catch(() => setScreen("auth"));
  }, []);

  useEffect(() => {
    const coarsePointer = typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
    const isTouchEnvironment = coarsePointer || navigator.maxTouchPoints > 0;
    if (!isTouchEnvironment) {
      return undefined;
    }

    const suppressCallout = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener("contextmenu", suppressCallout);
    document.addEventListener("selectstart", suppressCallout);
    document.addEventListener("dragstart", suppressCallout);

    return () => {
      document.removeEventListener("contextmenu", suppressCallout);
      document.removeEventListener("selectstart", suppressCallout);
      document.removeEventListener("dragstart", suppressCallout);
    };
  }, []);

  const activeMultiplayerRoomCode =
    screen === "multiplayer-lobby" || screen === "multiplayer-game" ? room?.roomCode ?? null : null;

  useEffect(() => {
    if (!activeMultiplayerRoomCode) {
      return undefined;
    }

    multiplayerClient.connect();
    multiplayerClient.subscribeRoom(activeMultiplayerRoomCode);
    return () => multiplayerClient.disconnect();
  }, [activeMultiplayerRoomCode, multiplayerClient, reconnectSequence]);

  function handleAuthenticated(authUser: AuthUser) {
    setUser(authUser);
    setScreen("menu");
  }

  function handleSessionExpired() {
    clearStoredSessionToken();
    setUser(null);
    setScreen("auth");
  }

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    clearStoredSessionToken();
    setUser(null);
    setScreen("auth");
  }

  function handleSaved(_entry: RecordEntry) {
    setSaveCount((count) => count + 1);
  }

  async function enterRoom(loadRoom: Promise<RoomSummary>) {
    const nextRoom = await loadRoom;
    setMultiplayerNotice(null);
    setMultiplayerLobbyToast(null);
    setMultiplayerCountdown(null);
    setRoom(nextRoom);
    setGame(null);
    setSocketConnected(false);
    setScreen("multiplayer-lobby");
  }

  async function handleLeaveMultiplayer() {
    await api.leaveRoom().catch(() => undefined);
    multiplayerClient.disconnect();
    setMultiplayerNotice(null);
    setMultiplayerLobbyToast(null);
    setMultiplayerCountdown(null);
    setRoom(null);
    setGame(null);
    setSocketConnected(false);
    setScreen("multiplayer-home");
  }

  const screenLabel = copy.app.screens[screen as keyof typeof copy.app.screens] ?? copy.app.screens.menu;
  const presenceLabel = user?.username ?? copy.app.guest;

  return (
    <main className={`app-shell app-shell--${screen}`}>
      <div className="console-shell">
        <header className="console-header console-header--compact">
          <div className="console-marquee">
            <span className="console-pill">{copy.app.title}</span>
            <span className="console-marquee__label">{screenLabel}</span>
            <span className="console-marquee__presence">{presenceLabel}</span>
          </div>
        </header>

        <section className={`console-stage console-stage--${screen}`}>
          {screen === "auth" ? <AuthPage onAuthenticated={handleAuthenticated} /> : null}
          {screen === "menu" && user ? (
            <MenuPage
              user={user}
              sessionSaveCount={saveCount}
              onOpenMultiplayer={() => {
                setMultiplayerNotice(null);
                setScreen("multiplayer-home");
              }}
              onPlay={(nextMode) => {
                setMode(nextMode);
                setScreen("game");
              }}
              onViewRecords={() => setScreen("records")}
              onLogout={handleLogout}
              onSessionExpired={handleSessionExpired}
            />
          ) : null}
          {screen === "game" ? (
            <GamePage
              mode={mode}
              onBackToMenu={() => setScreen("menu")}
              onSaved={handleSaved}
              onSessionExpired={handleSessionExpired}
              onViewRecords={() => setScreen("records")}
            />
          ) : null}
          {screen === "records" ? <RecordsPage onBack={() => setScreen("menu")} onOpenCareer={() => setScreen("career")} onSessionExpired={handleSessionExpired} /> : null}
          {screen === "career" ? <CareerPage onBack={() => setScreen("records")} onSessionExpired={handleSessionExpired} /> : null}
          {screen === "multiplayer-home" ? (
            <MultiplayerHomePage
              notice={multiplayerNotice}
              onBack={() => {
                setMultiplayerNotice(null);
                setScreen("menu");
              }}
              onCreateRoom={(payload) => enterRoom(api.createRoom(payload))}
              loadRooms={() => api.listRooms()}
              onJoinRoom={(payload) => enterRoom(api.joinRoom(payload))}
              onQuickJoin={(payload) => enterRoom(api.quickJoin(payload))}
            />
          ) : null}
          {screen === "multiplayer-lobby" && room && user ? (
            <MultiplayerLobbyPage
              canStart={room.hostUserId === user.id}
              connected={socketConnected}
              countdownSignal={multiplayerCountdown}
              room={room}
              toastSignal={multiplayerLobbyToast}
              userId={user.id}
              onLeave={handleLeaveMultiplayer}
              onSendChat={(message) => multiplayerClient.send({ type: "send_chat", message })}
              onSetReady={(ready) => multiplayerClient.send({ type: "set_ready", ready })}
              onKickPlayer={(targetUserId) => multiplayerClient.send({ type: "kick_player", targetUserId })}
              onTransferHost={(targetUserId) => multiplayerClient.send({ type: "transfer_host", targetUserId })}
              onUpdateRoomSettings={(settings) => multiplayerClient.send({ type: "update_room_settings", settings })}
              onStart={() => multiplayerClient.send({ type: "start_game" })}
            />
          ) : null}
          {screen === "multiplayer-game" && room && game && user ? (
            <MultiplayerGamePage
              currentUserId={user.id}
              game={game}
              onDirectionChange={(direction) => multiplayerClient.send({ type: "player_input", direction })}
              onJump={() => multiplayerClient.send({ type: "jump" })}
              onLeave={handleLeaveMultiplayer}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
