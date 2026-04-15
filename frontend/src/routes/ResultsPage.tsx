import { useEffect, useMemo, useState } from "react";

import type { RecordEntry, RunResultPayload, SinglePlayerReplayFrame } from "../../../shared/src/contracts/index";
import { copy, formatSecondsLabel, translateErrorMessage } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";

type Props = {
  result: RunResultPayload;
  runSessionId?: string;
  replayFrames?: SinglePlayerReplayFrame[];
  onRetry: () => void;
  onBackToMenu: () => void;
  onViewRecords: () => void;
  onSessionExpired: () => void;
  onSaved?: (entry: RecordEntry) => void;
  embedded?: boolean;
};

const PENDING_RESULT_KEY = "avoid-poop-pending-result";
type PendingResultState = {
  result: RunResultPayload;
  runSessionId?: string;
  replayFrames?: SinglePlayerReplayFrame[];
};

export function ResultsPage({
  result,
  runSessionId,
  replayFrames,
  onRetry,
  onBackToMenu,
  onViewRecords,
  onSessionExpired,
  onSaved,
  embedded = false,
}: Props) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pendingState = useMemo(() => {
    const raw = sessionStorage.getItem(PENDING_RESULT_KEY);
    if (!raw) {
      return { result, runSessionId, replayFrames } satisfies PendingResultState;
    }

    try {
      const parsed = JSON.parse(raw) as PendingResultState | RunResultPayload;
      if ("result" in parsed) {
        return parsed;
      }
      return { result: parsed, runSessionId, replayFrames } satisfies PendingResultState;
    } catch {
      return { result, runSessionId, replayFrames } satisfies PendingResultState;
    }
  }, [result, runSessionId, replayFrames]);

  async function handleSave() {
    try {
      setSaving(true);
      sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(pendingState));
      const entry = await api.saveRecord({
        ...pendingState.result,
        ...(pendingState.runSessionId ? { runSessionId: pendingState.runSessionId } : {}),
        ...(pendingState.replayFrames ? { replayFrames: pendingState.replayFrames } : {}),
      });
      setSaved(true);
      setError("");
      sessionStorage.removeItem(PENDING_RESULT_KEY);
      onSaved?.(entry);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        onSessionExpired();
        return;
      }
      setSaved(false);
      setError(caught instanceof Error ? translateErrorMessage(caught.message) : translateErrorMessage("Failed to save result"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!saved && !saving) {
      void handleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const saveStateLabel = saved ? copy.results.savedYes : saving ? copy.results.savedSaving : error ? copy.results.savedPending : copy.results.savedSaving;
  const heroClass = `console-panel console-panel--primary console-panel--compact results-hero ${result.clear ? "is-clear" : "is-fail"}${embedded ? " results-hero--embedded" : ""}`;
  const content = (
    <div className={heroClass}>
      <div className="panel-heading results-heading">
        <span className="results-badge">{result.clear ? copy.results.outcomeClear : copy.results.outcomeFail}</span>
        <h2>{result.clear ? copy.results.cleared : copy.results.failed}</h2>
        <span className="results-meta">
          {result.mode === "normal" ? copy.results.modeNormal : copy.results.modeHard} · {copy.results.roundLabel(result.reachedRound)}
        </span>
      </div>

      <div className="records-board">
        <div className="score-board">
          <span className="score-board__label">{copy.results.score}</span>
          <strong>{result.score}</strong>
          <span>{result.mode === "normal" ? copy.results.modeNormal : copy.results.modeHard}</span>
        </div>
        <div className="score-board">
          <span className="score-board__label">{copy.results.time}</span>
          <strong>{formatSecondsLabel(result.survivalTime)}</strong>
          <span>{copy.results.roundLabel(result.reachedRound)}</span>
        </div>
      </div>

      <div className={`results-save-state ${saved ? "is-saved" : error ? "is-error" : ""}`}>
        <span>{copy.results.savePanel}</span>
        <strong>{saveStateLabel}</strong>
      </div>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="action-grid results-actions">
        <button className="home-start-button" onClick={onRetry}>
          {copy.results.retry}
        </button>
        <button className="ghost-button subtle-button" onClick={onViewRecords}>
          {copy.results.viewRecords}
        </button>
        <button className="ghost-button subtle-button" onClick={onBackToMenu}>
          {copy.results.backToMenu}
        </button>
        {!saved ? (
          <button className="ghost-button subtle-button" disabled={saving} onClick={handleSave}>
            {saving ? copy.results.saving : copy.results.retrySave}
          </button>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <section className="results-screen">{content}</section>;
}
