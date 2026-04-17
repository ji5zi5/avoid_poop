import { describe, expect, it } from "vitest";

import type { MultiplayerGameSnapshot } from "../../lib/multiplayerClient";
import { createGameEngine } from "../engine";
import { renderMultiplayerGame } from "../multiplayer/renderMultiplayerGame";
import { renderGame } from "./canvasRenderer";

type MockContextCalls = {
  arc: Array<[number, number, number, number, number]>;
  beginPath: number;
};

function createMockContext() {
  const calls: MockContextCalls = {
    arc: [],
    beginPath: 0,
  };

  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    clearRect() {},
    fillRect() {},
    beginPath() {
      calls.beginPath += 1;
    },
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
      calls.arc.push([x, y, radius, startAngle, endAngle]);
    },
    ellipse() {},
    stroke() {},
    fill() {},
    fillText() {},
    save() {},
    restore() {},
    translate() {},
  } as unknown as CanvasRenderingContext2D;

  return { calls, ctx };
}

function createBounceState(bouncesRemaining: number) {
  const state = createGameEngine("hard");
  state.hazards = [{
    id: 1,
    x: 120,
    y: 160,
    size: 20,
    width: 20,
    height: 20,
    speed: 180,
    owner: "wave",
    variant: "medium",
    behavior: "bounce",
    bouncesRemaining,
  }];
  state.items = [];
  return state;
}

function createMultiplayerSnapshot(bouncesRemaining: number): MultiplayerGameSnapshot {
  return {
    roomCode: "ROOM42",
    phase: "wave",
    round: 8,
    elapsedInPhase: 1.2,
    bossEncounterDuration: 12,
    bossThemeId: null,
    bossThemeLabel: "",
    bossPatternQueue: [],
    bossPatternIndex: 0,
    bossPatternActiveId: null,
    bossPatternPhase: "idle",
    bossTelegraphText: "",
    bossTelegraphTimer: 0,
    options: {
      difficulty: "hard",
      visibility: "public",
      bodyBlock: false,
      debuffTier: 2,
    },
    players: [{
      userId: 7,
      username: "alpha",
      x: 160,
      y: 444,
      width: 36,
      height: 24,
      direction: 0,
      lives: 3,
      status: "alive",
      disconnectDeadlineAt: null,
      airborneUntil: null,
      activeDebuffs: [],
    }],
    hazards: [{
      id: 1,
      owner: "wave",
      x: 120,
      y: 160,
      width: 20,
      height: 20,
      speed: 180,
      variant: "medium",
      behavior: "bounce",
      bouncesRemaining,
    }],
    items: [],
    winnerUserId: null,
  };
}

describe("hazard bounce markers", () => {
  it("draws extra bounce marks in the single-player renderer for multi-bounce hazards", () => {
    const normal = createMockContext();
    const multi = createMockContext();

    renderGame(normal.ctx, createBounceState(1));
    renderGame(multi.ctx, createBounceState(2));

    expect(normal.calls.arc).toHaveLength(1);
    expect(multi.calls.arc.length).toBeGreaterThan(normal.calls.arc.length);
    expect(multi.calls.beginPath).toBeGreaterThan(normal.calls.beginPath);
  });

  it("draws extra bounce marks in the multiplayer renderer for multi-bounce hazards", () => {
    const normal = createMockContext();
    const multi = createMockContext();

    renderMultiplayerGame(normal.ctx, createMultiplayerSnapshot(1), 7);
    renderMultiplayerGame(multi.ctx, createMultiplayerSnapshot(2), 7);

    expect(normal.calls.arc).toHaveLength(1);
    expect(multi.calls.arc.length).toBeGreaterThan(normal.calls.arc.length);
    expect(multi.calls.beginPath).toBeGreaterThan(normal.calls.beginPath);
  });
});
