import { useEffect, useRef } from "react";

import { copy } from "../content/copy";
import { createHorizontalInputTracker } from "../lib/horizontalInput";
import { getMultiplayerColorMap } from "../lib/multiplayerColors";
import type { MultiplayerGameSnapshot } from "../lib/multiplayerClient";
import { renderMultiplayerGame } from "../game/multiplayer/renderMultiplayerGame";

type Props = {
  currentUserId: number;
  game: MultiplayerGameSnapshot;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
  onJump: () => void;
  onLeave: () => void;
};

export function MultiplayerGamePage({ currentUserId, game, onDirectionChange, onJump, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputTrackerRef = useRef(createHorizontalInputTracker());
  const playerColors = getMultiplayerColorMap(game.players);
  const me = game.players.find((player) => player.userId === currentUserId) ?? null;
  const remaining = game.players.filter((player) => player.status === "alive").length;
  const currentDebuffs = me?.activeDebuffs ?? [];
  const jammed = currentDebuffs.some((debuff) => debuff.type === "vision_jam");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    renderMultiplayerGame(ctx, game, currentUserId);
  }, [game, currentUserId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const nextDirection = inputTrackerRef.current.keyDown(event.key);
      if (nextDirection !== null) {
        onDirectionChange(nextDirection);
      }
      if ((event.key === " " || event.key === "ArrowUp") && game.options.bodyBlock) {
        event.preventDefault();
        onJump();
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const nextDirection = inputTrackerRef.current.keyUp(event.key);
      if (nextDirection !== null) {
        onDirectionChange(nextDirection);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      inputTrackerRef.current.clear();
    };
  }, [game.options.bodyBlock, onDirectionChange, onJump]);

  return (
    <section className="game-screen multiplayer-game-screen">
      <div className="console-panel console-panel--game">
        <div className="game-hud-grid multiplayer-game-hud">
          <div className="readout-panel"><span>{copy.game.round}</span><strong>{game.round}</strong></div>
          <div className={`readout-panel readout-panel--phase ${game.phase === "boss" ? "is-boss" : ""}`}><span>{copy.game.mode}</span><strong>{game.phase === "boss" ? copy.game.boss : game.phase === "complete" ? copy.multiplayer.finished : copy.game.wave}</strong></div>
          <div className="readout-panel"><span>{copy.multiplayer.remainingPlayers}</span><strong>{remaining}</strong></div>
        </div>
        <div className="game-frame multiplayer-game-frame">
          <div className="game-playfield">
            <canvas ref={canvasRef} width={360} height={520} className="game-canvas" />
            {jammed ? <div className="vision-jam-overlay" aria-label={copy.multiplayer.debuffLabels.vision_jam} /> : null}
            {me?.status === "spectator" ? <div className="spectator-banner">{copy.multiplayer.spectator}</div> : null}
            {me?.status === "disconnected" ? <div className="spectator-banner">{copy.multiplayer.reconnecting}</div> : null}
          </div>
          {game.phase === "complete" ? <div className="spectator-banner">{game.winnerUserId === currentUserId ? "WIN" : "게임 종료"}</div> : null}
          <div className="multiplayer-player-strip">
            {game.players.map((player) => (
              <div
                key={player.userId}
                className={`effect-pill effect-pill--player ${player.userId === currentUserId ? "is-self" : ""}`}
                style={{
                  "--player-accent": playerColors.get(player.userId)?.accent,
                  "--player-soft": playerColors.get(player.userId)?.soft,
                  "--player-ink": playerColors.get(player.userId)?.ink,
                } as React.CSSProperties}
              >
                <span>{player.username}</span>
                <strong>{player.status}</strong>
              </div>
            ))}
          </div>
          {currentDebuffs.length > 0 ? (
            <div className="multiplayer-debuff-strip" aria-label={copy.multiplayer.debuffActive}>
              {currentDebuffs.map((debuff) => (
                <span key={`${debuff.type}-${debuff.expiresAt}`} className="effect-pill effect-pill--danger">
                  {copy.multiplayer.debuffLabels[debuff.type]}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mobile-controls">
            <button className="control-button" onPointerDown={() => onDirectionChange(inputTrackerRef.current.press(-1))} onPointerUp={() => onDirectionChange(inputTrackerRef.current.release(-1))} onPointerLeave={() => onDirectionChange(inputTrackerRef.current.release(-1))} onPointerCancel={() => onDirectionChange(inputTrackerRef.current.release(-1))}>◀</button>
            {game.options.bodyBlock ? <button className="control-button" onPointerDown={onJump}>▲</button> : <span className="control-button control-button--ghost">·</span>}
            <button className="control-button" onPointerDown={() => onDirectionChange(inputTrackerRef.current.press(1))} onPointerUp={() => onDirectionChange(inputTrackerRef.current.release(1))} onPointerLeave={() => onDirectionChange(inputTrackerRef.current.release(1))} onPointerCancel={() => onDirectionChange(inputTrackerRef.current.release(1))}>▶</button>
          </div>
          {game.options.bodyBlock ? <p className="home-card__meta">{copy.multiplayer.jumpHint}</p> : null}
          <button className="ghost-button subtle-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
        </div>
      </div>
    </section>
  );
}
