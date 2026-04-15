import { useEffect, useRef, useState } from "react";

import type { RecordEntry, RunResultPayload, SinglePlayerReplayFrame, SinglePlayerRunSession } from "../../../shared/src/contracts/index";
import type { GameMode } from "../../../shared/src/contracts/index";
import { copy, formatSecondsLabel } from "../content/copy";
import { api, ApiRequestError } from "../lib/api";
import { createHorizontalInputTracker } from "../lib/horizontalInput.js";
import { createGameEngine, updateGame } from "../game/engine.js";
import { createLoop } from "../game/loop.js";
import { renderGame } from "../game/rendering/canvasRenderer.js";
import { toRunResult } from "../game/state.js";
import type { GameState } from "../game/state.js";
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
  const inputTrackerRef = useRef(createHorizontalInputTracker());
  const [, forceRender] = useState(0);
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<RunResultPayload | null>(null);
  const [resultRunSessionId, setResultRunSessionId] = useState<string | undefined>();
  const [resultReplayFrames, setResultReplayFrames] = useState<SinglePlayerReplayFrame[]>([]);
  const [runReady, setRunReady] = useState(false);
  const runSessionRef = useRef<SinglePlayerRunSession | null>(null);
  const replayFramesRef = useRef<SinglePlayerReplayFrame[]>([]);

  function setDirection(direction: number) {
    directionRef.current = direction;
  }

  function suppressTouchCallout(event: React.SyntheticEvent<HTMLElement>) {
    event.preventDefault();
  }

  function restartRun() {
    directionRef.current = 0;
    inputTrackerRef.current.clear();
    runSessionRef.current = null;
    replayFramesRef.current = [];
    stateRef.current = createGameEngine(mode);
    setResult(null);
    setResultRunSessionId(undefined);
    setResultReplayFrames([]);
    setRunReady(false);
    setRunId((value) => value + 1);
    forceRender((value) => value + 1);
  }

  useEffect(() => {
    directionRef.current = 0;
    inputTrackerRef.current.clear();
    runSessionRef.current = null;
    replayFramesRef.current = [];
    stateRef.current = createGameEngine(mode);
    setResult(null);
    setResultRunSessionId(undefined);
    setResultReplayFrames([]);
    setRunReady(false);

    let heartbeatTimer: number | null = null;
    let loopStarted = false;

    async function initializeVerifiedRun() {
      try {
        const runSession = await api.createRunSession(mode);
        if (disposed) {
          return;
        }
        runSessionRef.current = runSession;
        stateRef.current = createGameEngine(mode, {
          waveSeed: runSession.waveSeed,
          bossSeed: runSession.bossSeed,
        });
        forceRender((value) => value + 1);
        setRunReady(true);
        loop.start();
        loopStarted = true;
        heartbeatTimer = window.setInterval(() => {
          const activeSession = runSessionRef.current;
          if (!activeSession || stateRef.current.gameOver) {
            return;
          }
          api.heartbeatRunSession(activeSession.id).catch((caught) => {
            if (caught instanceof ApiRequestError && caught.status === 401) {
              onSessionExpired();
            }
          });
        }, 5000);
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.status === 401) {
          onSessionExpired();
          return;
        }
        if (!disposed) {
          setRunReady(true);
          loop.start();
          loopStarted = true;
        }
      }
    }

    let disposed = false;
    const loop = createLoop((delta) => {
      replayFramesRef.current.push({
        deltaMs: Number((delta * 1000).toFixed(3)),
        direction: directionRef.current as -1 | 0 | 1,
      });
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
        setResultRunSessionId(runSessionRef.current?.id);
        setResultReplayFrames([...replayFramesRef.current]);
      }
    });

    function onKeyDown(event: KeyboardEvent) {
      if (result) {
        return;
      }
      const nextDirection = inputTrackerRef.current.keyDown(event.key);
      if (nextDirection !== null) {
        setDirection(nextDirection);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const nextDirection = inputTrackerRef.current.keyUp(event.key);
      if (nextDirection !== null) {
        setDirection(nextDirection);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    void initializeVerifiedRun();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      inputTrackerRef.current.clear();
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
      }
      disposed = true;
      if (loopStarted) {
        loop.stop();
      }
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
              {!runReady && !result ? (
                <div className="boss-telegraph" role="status" aria-live="polite">
                  <span>RANKED</span>
                  <strong>랭킹 세션 준비 중</strong>
                </div>
              ) : null}
              {state.damageFlashTimer > 0 ? <div className="damage-flash" aria-hidden="true" /> : null}
              {state.bossTelegraphText && !result ? (
                <div className="boss-telegraph" role="status" aria-live="polite">
                  <span>{copy.game.bossAttack}</span>
                  <strong>{state.bossTelegraphText}</strong>
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
                  runSessionId={resultRunSessionId}
                  replayFrames={resultReplayFrames}
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
              onContextMenu={suppressTouchCallout}
              onPointerDown={() => setDirection(inputTrackerRef.current.press(-1))}
              onPointerUp={() => setDirection(inputTrackerRef.current.release(-1))}
              onPointerLeave={() => setDirection(inputTrackerRef.current.release(-1))}
              onPointerCancel={() => setDirection(inputTrackerRef.current.release(-1))}
            >
              ◀
            </button>
            <button
              className="control-button"
              aria-label={copy.game.right}
              disabled={Boolean(result)}
              onContextMenu={suppressTouchCallout}
              onPointerDown={() => setDirection(inputTrackerRef.current.press(1))}
              onPointerUp={() => setDirection(inputTrackerRef.current.release(1))}
              onPointerLeave={() => setDirection(inputTrackerRef.current.release(1))}
              onPointerCancel={() => setDirection(inputTrackerRef.current.release(1))}
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
