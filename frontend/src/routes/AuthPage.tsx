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
    <section className="auth-screen">
      <div className="console-panel console-panel--form console-panel--compact">
        <div className="panel-heading">
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

        <form className="stack" onSubmit={handleSubmit}>
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
          <button type="submit" className="primary-action">
            {mode === "signup" ? copy.auth.signup : copy.auth.login}
          </button>
        </form>
      </div>
    </section>
  );
}
