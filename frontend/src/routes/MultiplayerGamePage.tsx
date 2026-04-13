import {useEffect, useRef} from "react";

import {copy} from "../content/copy";
import type {MultiplayerGameSnapshot} from "../lib/multiplayerClient";
import {renderMultiplayerGame} from "../game/multiplayer/renderMultiplayerGame";

type Props = {
  currentUserId: number;
  game: MultiplayerGameSnapshot;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
  onLeave: () => void;
};

export function MultiplayerGamePage({currentUserId, game, onDirectionChange, onLeave}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const me = game.players.find((player) => player.userId === currentUserId) ?? null;
  const remaining = game.players.filter((player) => player.status === "alive").length;

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
      if (event.key === "ArrowLeft") {
        onDirectionChange(-1);
      }
      if (event.key === "ArrowRight") {
        onDirectionChange(1);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        onDirectionChange(0);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onDirectionChange]);

  return (
    <section className="game-screen multiplayer-game-screen">
      <div className="console-panel console-panel--game">
        <div className="game-hud-grid multiplayer-game-hud">
          <div className="readout-panel"><span>{copy.game.round}</span><strong>{game.round}</strong></div>
          <div className={`readout-panel readout-panel--phase ${game.phase === "boss" ? "is-boss" : ""}`}><span>{copy.game.mode}</span><strong>{game.phase === "boss" ? copy.game.boss : copy.game.wave}</strong></div>
          <div className="readout-panel"><span>{copy.multiplayer.remainingPlayers}</span><strong>{remaining}</strong></div>
        </div>
        <div className="game-frame multiplayer-game-frame">
          <div className="game-playfield">
            <canvas ref={canvasRef} width={360} height={520} className="game-canvas" />
            {me?.status === "spectator" ? <div className="spectator-banner">{copy.multiplayer.spectator}</div> : null}
            {me?.status === "disconnected" ? <div className="spectator-banner">{copy.multiplayer.reconnecting}</div> : null}
          </div>
          <div className="multiplayer-player-strip">
            {game.players.map((player) => (
              <div key={player.userId} className={`effect-pill ${player.userId === currentUserId ? 'is-self' : ''}`}>
                <span>{player.username}</span>
                <strong>{player.status}</strong>
              </div>
            ))}
          </div>
          <div className="mobile-controls">
            <button className="control-button" onPointerDown={() => onDirectionChange(-1)} onPointerUp={() => onDirectionChange(0)} onPointerLeave={() => onDirectionChange(0)} onPointerCancel={() => onDirectionChange(0)}>◀</button>
            <button className="control-button" onPointerDown={() => onDirectionChange(1)} onPointerUp={() => onDirectionChange(0)} onPointerLeave={() => onDirectionChange(0)} onPointerCancel={() => onDirectionChange(0)}>▶</button>
          </div>
          <button className="ghost-button subtle-button" onClick={onLeave}>{copy.multiplayer.leave}</button>
        </div>
      </div>
    </section>
  );
}
