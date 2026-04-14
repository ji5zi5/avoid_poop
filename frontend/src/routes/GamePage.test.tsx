// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createGameEngine } = vi.hoisted(() => ({
  createGameEngine: vi.fn(),
}));

vi.mock('../game/engine', () => ({
  createGameEngine,
  updateGame: vi.fn((state) => state),
}));

vi.mock('../game/loop', () => ({
  createLoop: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../game/rendering/canvasRenderer', () => ({
  renderGame: vi.fn(),
}));

import { GamePage } from './GamePage';

function makeState() {
  return {
    mode: 'hard',
    width: 360,
    height: 520,
    player: { x: 0, y: 0, width: 36, height: 24, speed: 210, lives: 3 },
    hazards: [],
    items: [],
    score: 0,
    round: 4,
    reachedRound: 4,
    survivalTime: 0,
    elapsedInPhase: 0,
    currentPhase: 'boss',
    pendingBossClearAnnouncement: false,
    nextHazardId: 1,
    nextItemId: 1,
    spawnTimer: 0,
    itemTimer: 0,
    bossPatternTimer: 0,
    bossEncounterDuration: 12,
    bossThemeId: 'corridor_switch',
    bossPatternQueue: [],
    bossPatternIndex: 0,
    bossPatternActiveId: null,
    bossPatternPhase: 'telegraph',
    bossPatternStepTimer: 0,
    bossPatternShots: 0,
    bossPatternSeed: 17,
    bossPatternFamilyStreak: null,
    bossPatternFamilyStreakCount: 0,
    bossRecentPatterns: [],
    bossTelegraphTimer: 1,
    bossTelegraphText: '왼쪽 유도, 반대로 회피',
    invincibilityTimer: 0,
    speedBoostTimer: 0,
    slowMotionTimer: 0,
    phaseAnnouncementTimer: 1,
    phaseAnnouncementText: '보스 패턴이 시작됩니다 · 통로 뒤집기',
    itemToastTimer: 0,
    itemToastText: '',
    itemToastTone: 'neutral',
    effectBurstTimer: 0,
    effectBurstType: null,
    waveDirector: {
      seed: 37,
      patternCursor: 0,
      recentPatterns: [],
      specialCooldown: 0,
      roundBudget: 1,
      clusterQuota: 1,
      tripleQuota: 0,
      splitterQuota: 0,
      bounceQuota: 0,
      roundBand: 1,
      round: 4,
    },
    screenShakeTimer: 0,
    damageFlashTimer: 0,
    gameOver: false,
    clear: false,
  };
}

describe('GamePage', () => {
  beforeEach(() => {
    createGameEngine.mockReset();
    createGameEngine.mockReturnValue(makeState());
  });

  it('renders the selected boss theme in the telegraph overlay', () => {
    render(
      <GamePage
        mode="hard"
        onBackToMenu={vi.fn()}
        onViewRecords={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    expect(screen.getByText('보스 공격')).toBeTruthy();
    expect(screen.getByText('왼쪽 유도, 반대로 회피')).toBeTruthy();
  });

  it('renders the boss-entry banner with the theme label', () => {
    render(
      <GamePage
        mode="hard"
        onBackToMenu={vi.fn()}
        onViewRecords={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    expect(screen.getAllByText('보스 패턴이 시작됩니다 · 통로 뒤집기').length).toBeGreaterThan(0);
  });
});
