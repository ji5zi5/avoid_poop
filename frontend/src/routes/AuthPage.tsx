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
          <article className="info-card auth-feature-card">
            <span className="info-card__label">LIVE BOARD</span>
            <strong>{copy.auth.featureRanking}</strong>
            <span>플레이어 랭킹과 내 전적을 분리해서 더 빨리 확인할 수 있습니다.</span>
          </article>
          <article className="info-card auth-feature-card">
            <span className="info-card__label">ROOM FLOW</span>
            <strong>{copy.auth.featureMultiplayer}</strong>
            <span>공개방은 바로 입장하고, 비공개방은 비밀번호를 입력해 바로 참가합니다.</span>
          </article>
        </div>

        <div className="auth-brand-showcase">
          <div className="auth-brand-showcase__copy">
            <span className="panel-kicker">{copy.auth.showcaseLabel}</span>
            <strong>{copy.auth.showcaseTitle}</strong>
            <p>{copy.auth.showcaseBody}</p>
          </div>
          <div className="auth-brand-showcase__stats">
            <article className="auth-brand-stat">
              <span>{copy.auth.showcasePrimary}</span>
              <strong>{copy.auth.showcasePrimaryValue}</strong>
            </article>
            <article className="auth-brand-stat">
              <span>{copy.auth.showcaseSecondary}</span>
              <strong>{copy.auth.showcaseSecondaryValue}</strong>
            </article>
          </div>
          <div className="auth-brand-showcase__footer">
            <span className="home-status-chip">{copy.auth.showcaseFooter}</span>
          </div>
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
