import { useState } from "react";

import type { AuthUser } from "../../../shared/src/contracts/index";
import { copy } from "../content/copy";
import { api } from "../lib/api";
import { formatAuthError } from "../lib/auth";

type Props = {
  onAuthenticated: (user: AuthUser) => void;
};

const socialIcons = ["✉", "◉", "⋯"] as const;

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
    <section className="auth-screen auth-screen--studio">
      <div className="console-panel console-panel--primary console-panel--compact auth-studio-card">
        <div className="auth-studio-header">
          <span className="panel-kicker auth-studio-eyebrow">{copy.auth.studioEyebrow}</span>
          <span className="auth-studio-orb" aria-hidden="true">●</span>
        </div>

        <section className="auth-membership-card">
          <div className="auth-membership-card__header">
            <div>
              <h1 className="auth-membership-card__title">{copy.auth.membershipTitle}</h1>
              <p>{copy.auth.membershipBody}</p>
            </div>
            <div className="auth-membership-card__cluster" aria-hidden="true">
              <span className="auth-membership-card__badge auth-membership-card__badge--plus">＋</span>
              <span className="auth-membership-card__badge" />
              <span className="auth-membership-card__badge auth-membership-card__badge--small" />
            </div>
          </div>

          <div className="auth-membership-card__stats">
            <article className="auth-membership-stat">
              <span className="auth-membership-stat__icon">☁</span>
              <div>
                <strong>{copy.auth.membershipCloud}</strong>
                <small>{copy.auth.featureSave}</small>
              </div>
            </article>
            <article className="auth-membership-stat">
              <span className="auth-membership-stat__icon">★</span>
              <div>
                <strong>{copy.auth.membershipVault}</strong>
                <small>{copy.auth.featureRanking}</small>
              </div>
            </article>
          </div>
        </section>

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
          <p className="auth-studio-form__hint">{copy.auth.forgotPassword}</p>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="primary-action auth-submit-button auth-submit-button--studio">
            {mode === "signup" ? copy.auth.signup : copy.auth.login}
          </button>
        </form>

        <div className="auth-social-block">
          <span className="auth-social-block__label">{copy.auth.socialLabel}</span>
          <div className="auth-social-block__actions">
            {socialIcons.map((icon, index) => (
              <button key={`${icon}-${index}`} type="button" className="auth-social-block__button" aria-label={`${copy.auth.socialLabel} ${index + 1}`}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
