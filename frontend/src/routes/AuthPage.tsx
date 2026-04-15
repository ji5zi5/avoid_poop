import { useState } from "react";

import type { AuthUser } from "../../../shared/src/contracts/index";
import { copy } from "../content/copy";
import { api } from "../lib/api";
import { formatAuthError } from "../lib/auth";

type Props = {
  onAuthenticated: (user: AuthUser) => void;
};

export function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = mode === "signup" ? await api.signup({ username, password }) : await api.login({ username, password });
      setError("");
      onAuthenticated(response.user);
    } catch (caught) {
      setError(formatAuthError(caught));
    }
  }

  return (
    <section className="auth-screen auth-screen--studio">
      <div className="console-panel console-panel--primary console-panel--compact auth-studio-card">
        <div className="auth-studio-header auth-studio-header--simple">
          <span className="panel-kicker auth-studio-eyebrow">{copy.auth.studioEyebrow}</span>
        </div>

        <div className="auth-studio-hero">
          <h1 className="auth-studio-hero__title">{copy.auth.title}</h1>
          <p className="auth-studio-hero__subtitle">{copy.auth.studioHint}</p>
        </div>

        <div className="segmented-switch auth-mode-switch" role="tablist" aria-label="인증 방식">
          <button
            type="button"
            className={mode === "login" ? "segmented-switch__item is-active" : "segmented-switch__item"}
            onClick={() => setMode("login")}
          >
            {copy.auth.modeLogin}
          </button>
          <button
            type="button"
            className={mode === "signup" ? "segmented-switch__item is-active" : "segmented-switch__item"}
            onClick={() => setMode("signup")}
          >
            {copy.auth.modeSignup}
          </button>
        </div>

        <form className="stack auth-studio-form" onSubmit={handleSubmit}>
          <label>
            <span>{copy.auth.username}</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required placeholder={copy.auth.username} />
          </label>
          <label>
            <span>{copy.auth.password}</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
              type="password"
              placeholder={copy.auth.password}
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="primary-action auth-submit-button auth-submit-button--studio">
            {mode === "signup" ? copy.auth.signup : copy.auth.login}
          </button>
        </form>
      </div>
    </section>
  );
}
