import { useEffect, useRef, useState } from "react";

import type { RecordEntry, RunResultPayload } from "../../../shared/src/contracts/index";
import type { GameMode } from "../../../shared/src/contracts/index";
import { copy, formatSecondsLabel } from "../content/copy";
import { createGameEngine, updateGame } from "../game/engine";
import { createLoop } from "../game/loop";
import { renderGame } from "../game/rendering/canvasRenderer";
import { toRunResult } from "../game/state";
import type { GameState } from "../game/state";
import { ResultsPage } from "./ResultsPage";

type Props = {
  mode: GameMode;
  onBackToMenu: () => void;
  onViewRecords: () => void;
  onSessionExpired: () => void;
  onSaved?: (entry: RecordEntry) => void;
};

type ActiveEffect = {
  key: "invincibility" | "speed" | "slow";
  label: string;
  time: number;
};

export function GamePage({ mode, onBackToMenu, onViewRecords, onSessionExpired, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createGameEngine(mode));
  const directionRef = useRef(0);
  const [, forceRender] = useState(0);
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<RunResultPayload | null>(null);

  function setDirection(direction: number) {
    directionRef.current = direction;
  }

  function restartRun() {
    directionRef.current = 0;
    stateRef.current = createGameEngine(mode);
    setResult(null);
    setRunId((value) => value + 1);
    forceRender((value) => value + 1);
  }

  useEffect(() => {
    directionRef.current = 0;
    stateRef.current = createGameEngine(mode);
    setResult(null);
    const loop = createLoop((delta) => {
      const state = updateGame(stateRef.current, delta, directionRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          renderGame(ctx, state);
        }
      }
      forceRender((value) => value + 1);
      if (state.gameOver) {
        loop.stop();
        setResult(toRunResult(state));
      }
    });

    function onKeyDown(event: KeyboardEvent) {
      if (result) {
        return;
      }
      if (event.key === "ArrowLeft") {
        setDirection(-1);
      }
      if (event.key === "ArrowRight") {
        setDirection(1);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        setDirection(0);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    loop.start();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      loop.stop();
    };
  }, [mode, runId]);

  const state = stateRef.current;
  const isBossPresentation = state.currentPhase === "boss" || state.pendingBossClearAnnouncement;
  const activeEffects: ActiveEffect[] = [];

  if (state.invincibilityTimer > 0) {
    activeEffects.push({ key: "invincibility", label: copy.game.effectLabel.invincibility, time: state.invincibilityTimer });
  }
  if (state.speedBoostTimer > 0) {
    activeEffects.push({ key: "speed", label: copy.game.effectLabel.speed, time: state.speedBoostTimer });
  }
  if (state.slowMotionTimer > 0) {
    activeEffects.push({ key: "slow", label: copy.game.effectLabel.slow, time: state.slowMotionTimer });
  }

  return (
    <section className="game-screen">
      <div className="console-panel console-panel--game">
        <div className="game-hud-stack">
          <div className="game-hud-grid">
            <div className="readout-panel readout-panel--lives">
              <span>{copy.game.lives}</span>
              <div className="life-meter" aria-label={`${copy.game.lives} ${state.player.lives}`}>
                {[0, 1, 2].map((index) => (
                  <span key={index} className={index < state.player.lives ? "life-heart" : "life-heart is-empty"}>
                    ♥
                  </span>
                ))}
              </div>
            </div>
            <div className="readout-panel">
              <span>{copy.game.round}</span>
              <strong>{state.reachedRound}</strong>
            </div>
            <div className="readout-panel">
              <span>{copy.game.score}</span>
              <strong>{Math.round(state.score)}</strong>
            </div>
            <div className={`readout-panel readout-panel--phase ${isBossPresentation ? "is-boss" : ""}`}>
              <span>{copy.game.mode}</span>
              <strong>{copy.game.modeLabel[mode]}</strong>
            </div>
          </div>
        </div>

        <div className="game-stage-panel">
          <div className="game-frame">
            <div className="game-playfield">
              <canvas ref={canvasRef} width={state.width} height={state.height} className="game-canvas" />
              {state.damageFlashTimer > 0 ? <div className="damage-flash" aria-hidden="true" /> : null}
              {state.bossTelegraphText && !result ? (
                <div className="boss-telegraph" role="status" aria-live="polite">
                  <strong>{copy.game.bossAttack}</strong>
                </div>
              ) : null}
            </div>
            {activeEffects.length > 0 && !result ? (
              <div className="effect-strip effect-strip--overlay" aria-label={copy.game.activeEffects}>
                {activeEffects.map((effect) => (
                  <div key={effect.key} className={`effect-pill effect-pill--${effect.key}`}>
                    <span>{effect.label}</span>
                    <strong>{formatSecondsLabel(effect.time)}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            {state.itemToastTimer > 0 && !result ? (
              <div className={`item-toast item-toast--${state.itemToastTone}`} role="status" aria-live="polite">
                {state.itemToastText}
              </div>
            ) : null}
            {state.phaseAnnouncementTimer > 0 && !result ? (
              <div className={`phase-banner ${isBossPresentation ? "is-boss" : ""}`}>
                <strong>{copy.game.transitionPrefix}</strong>
                <span>{state.phaseAnnouncementText}</span>
              </div>
            ) : null}
            {result ? (
              <div className="game-result-overlay">
                <ResultsPage
                  embedded
                  result={result}
                  onRetry={restartRun}
                  onBackToMenu={onBackToMenu}
                  onSaved={onSaved}
                  onSessionExpired={onSessionExpired}
                  onViewRecords={onViewRecords}
                />
              </div>
            ) : null}
          </div>

          <div className="mobile-controls">
            <button
              className="control-button"
              aria-label={copy.game.left}
              disabled={Boolean(result)}
              onPointerDown={() => setDirection(-1)}
              onPointerUp={() => setDirection(0)}
              onPointerLeave={() => setDirection(0)}
              onPointerCancel={() => setDirection(0)}
            >
              ◀
            </button>
            <button
              className="control-button"
              aria-label={copy.game.right}
              disabled={Boolean(result)}
              onPointerDown={() => setDirection(1)}
              onPointerUp={() => setDirection(0)}
              onPointerLeave={() => setDirection(0)}
              onPointerCancel={() => setDirection(0)}
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
