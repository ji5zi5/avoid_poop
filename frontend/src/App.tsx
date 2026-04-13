import { useEffect, useMemo, useState } from "react";

import type { AuthUser, GameMode, RecordEntry } from "../../shared/src/contracts/index";
import { copy } from "./content/copy";
import { api } from "./lib/api";
import { createMultiplayerClient, type MultiplayerGameSnapshot, type RoomSummary } from "./lib/multiplayerClient";
import { AuthPage } from "./routes/AuthPage";
import { GamePage } from "./routes/GamePage";
import { MenuPage } from "./routes/MenuPage";
import { MultiplayerGamePage } from "./routes/MultiplayerGamePage";
import { MultiplayerHomePage } from "./routes/MultiplayerHomePage";
import { MultiplayerLobbyPage } from "./routes/MultiplayerLobbyPage";
import { RecordsPage } from "./routes/RecordsPage";

type Screen = "auth" | "menu" | "game" | "records" | "multiplayer-home" | "multiplayer-lobby" | "multiplayer-game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<GameMode>("normal");
  const [saveCount, setSaveCount] = useState(0);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [game, setGame] = useState<MultiplayerGameSnapshot | null>(null);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const multiplayerClient = useMemo(
    () =>
      createMultiplayerClient({
        reconnectToken,
        onClose: () => setSocketConnected(false),
        onEvent: (event) => {
          if (event.type === "connected") {
            setReconnectToken(event.reconnectToken);
            setSocketConnected(true);
            return;
          }
          if (event.type === "room_snapshot") {
            setRoom(event.room);
            if (event.room.status === "in_progress") {
              setScreen("multiplayer-game");
            }
            return;
          }
          if (event.type === "game_snapshot") {
            setGame(event.game);
            setScreen("multiplayer-game");
          }
        },
      }),
    [reconnectToken],
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
    if ((screen === "multiplayer-lobby" || screen === "multiplayer-game") && room) {
      multiplayerClient.connect();
      multiplayerClient.subscribeRoom(room.roomCode);
      return () => multiplayerClient.disconnect();
    }
    return undefined;
  }, [multiplayerClient, room, screen]);

  function handleAuthenticated(authUser: AuthUser) {
    setUser(authUser);
    setScreen("menu");
  }

  function handleSessionExpired() {
    setUser(null);
    setScreen("auth");
  }

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    setUser(null);
    setScreen("auth");
  }

  function handleSaved(_entry: RecordEntry) {
    setSaveCount((count) => count + 1);
  }

  async function enterRoom(loadRoom: Promise<RoomSummary>) {
    const nextRoom = await loadRoom;
    setRoom(nextRoom);
    setGame(null);
    setScreen("multiplayer-lobby");
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
              onOpenMultiplayer={() => setScreen("multiplayer-home")}
              onPlay={(nextMode) => {
                setMode(nextMode);
                setScreen("game");
              }}
              onViewRecords={() => setScreen("records")}
              onLogout={handleLogout}
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
          {screen === "records" ? <RecordsPage onBack={() => setScreen("menu")} onSessionExpired={handleSessionExpired} /> : null}
          {screen === "multiplayer-home" ? (
            <MultiplayerHomePage
              onBack={() => setScreen("menu")}
              onCreateRoom={() => enterRoom(api.createRoom())}
              onQuickJoin={() => enterRoom(api.quickJoin())}
              onJoinByCode={(roomCode) => enterRoom(api.joinRoom({ roomCode }))}
            />
          ) : null}
          {screen === "multiplayer-lobby" && room && user ? (
            <MultiplayerLobbyPage
              canStart={room.hostUserId === user.id}
              connected={socketConnected}
              room={room}
              userId={user.id}
              onLeave={() => setScreen("multiplayer-home")}
              onSetReady={(ready) => multiplayerClient.send({ type: "set_ready", ready })}
              onStart={() => multiplayerClient.send({ type: "start_game" })}
            />
          ) : null}
          {screen === "multiplayer-game" && room && game && user ? (
            <MultiplayerGamePage
              currentUserId={user.id}
              game={game}
              onDirectionChange={(direction) => multiplayerClient.send({ type: "player_input", direction })}
              onLeave={() => setScreen("multiplayer-home")}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
