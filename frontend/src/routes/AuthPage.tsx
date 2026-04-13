import { useState } from "react";

import type { AuthUser } from "../../../shared/src/contracts/index";
import { copy } from "../content/copy";
import { api } from "../lib/api";
import { formatAuthError } from "../lib/auth";

type Props = {
  onAuthenticated: (user: AuthUser) => void;
};

export function AuthPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
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
    <section className="auth-screen auth-screen--stitch">
      <div className="console-panel console-panel--brand auth-brand-panel">
        <div className="panel-heading">
          <p className="panel-kicker">{copy.auth.consoleTitle}</p>
          <h1 className="home-card__title auth-brand-title">{copy.auth.title}</h1>
          <p className="panel-copy">{copy.auth.consoleDescription}</p>
        </div>

        <div className="auth-brand-badges">
          <span className="home-status-chip">{copy.auth.featureRounds}</span>
          <span className="home-status-chip">{copy.auth.featureItems}</span>
          <span className="home-status-chip">{copy.auth.featureSave}</span>
        </div>

        <div className="auth-feature-grid">
          <article className="info-card auth-feature-card">
            <span className="info-card__label">ARCADE LOOP</span>
            <strong>{copy.auth.featureRounds}</strong>
            <span>라운드가 올라갈수록 더 촘촘하고 보스가 더 악랄해집니다.</span>
          </article>
          <article className="info-card auth-feature-card">
            <span className="info-card__label">ACCOUNT SAVE</span>
            <strong>{copy.auth.featureSave}</strong>
            <span>싱글 기록과 멀티 전적이 계정 단위로 같이 쌓입니다.</span>
          </article>
        </div>
      </div>

      <div className="console-panel console-panel--form console-panel--compact auth-form-panel">
        <div className="panel-heading">
          <p className="panel-kicker">{copy.app.online}</p>
          <h2>{mode === "signup" ? copy.auth.signup : copy.auth.login}</h2>
        </div>

        <div className="segmented-switch" role="tablist" aria-label="인증 방식">
          <button
            type="button"
            className={mode === "signup" ? "segmented-switch__item is-active" : "segmented-switch__item"}
            onClick={() => setMode("signup")}
          >
            {copy.auth.modeSignup}
          </button>
          <button
            type="button"
            className={mode === "login" ? "segmented-switch__item is-active" : "segmented-switch__item"}
            onClick={() => setMode("login")}
          >
            {copy.auth.modeLogin}
          </button>
        </div>

        <form className="stack auth-form-stack" onSubmit={handleSubmit}>
          <label>
            {copy.auth.username}
            <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} required />
          </label>
          <label>
            {copy.auth.password}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
              type="password"
            />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="primary-action auth-submit-button">
            {mode === "signup" ? copy.auth.signup : copy.auth.login}
          </button>
        </form>
      </div>
    </section>
  );
}
