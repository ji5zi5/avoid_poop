import { useEffect, useState } from "react";

import type { AuthUser, GameMode, RecordEntry } from "../../shared/src/contracts/index";
import { copy } from "./content/copy";
import { api } from "./lib/api";
import { AuthPage } from "./routes/AuthPage";
import { GamePage } from "./routes/GamePage";
import { MenuPage } from "./routes/MenuPage";
import { RecordsPage } from "./routes/RecordsPage";

type Screen = "auth" | "menu" | "game" | "records";

export default function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<GameMode>("normal");
  const [saveCount, setSaveCount] = useState(0);

  useEffect(() => {
    api
      .me()
      .then((session) => {
        setUser(session.user);
        setScreen(session.authenticated ? "menu" : "auth");
      })
      .catch(() => setScreen("auth"));
  }, []);

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

  const screenLabel = copy.app.screens[screen];
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
          {screen === "records" ? (
            <RecordsPage onBack={() => setScreen("menu")} onSessionExpired={handleSessionExpired} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
