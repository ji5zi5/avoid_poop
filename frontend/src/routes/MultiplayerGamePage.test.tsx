// @vitest-environment jsdom
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {MultiplayerGamePage} from './MultiplayerGamePage';

const game = {
  roomCode: 'ROOM42',
  phase: 'wave' as const,
  round: 2,
  elapsedInPhase: 1,
  bossEncounterDuration: 11,
  bossThemeId: null,
  bossThemeLabel: '',
  bossPatternQueue: [],
  bossPatternIndex: 0,
  bossPatternActiveId: null,
  bossPatternPhase: 'idle' as const,
  bossTelegraphText: '',
  bossTelegraphTimer: 0,
  options: {difficulty: 'normal' as const, visibility: 'public' as const, bodyBlock: false, debuffTier: 2 as const},
  players: [
    {userId: 1, username: 'alpha', x: 0, y: 0, width: 36, height: 24, direction: 0 as const, lives: 3, status: 'alive' as const, disconnectDeadlineAt: null, airborneUntil: null, activeDebuffs: []},
    {userId: 2, username: 'beta', x: 20, y: 0, width: 36, height: 24, direction: 0 as const, lives: 0, status: 'spectator' as const, disconnectDeadlineAt: null, airborneUntil: null, activeDebuffs: []},
  ],
  hazards: [],
  items: [],
  winnerUserId: null,
};

describe('MultiplayerGamePage', () => {
  window.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), arc: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillText: vi.fn() })) as any;

  it('shows spectator banner for spectator player', () => {
    render(<MultiplayerGamePage currentUserId={2} game={game} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('관전 중').textContent).toBe('관전 중');
  });

  it('shows the current player hearts in the multiplayer hud', () => {
    render(<MultiplayerGamePage currentUserId={1} game={game} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByLabelText('하트 3').textContent).toContain('♥');
  });

  it('shows win banner when the current player wins', () => {
    render(<MultiplayerGamePage currentUserId={1} game={{...game, phase: 'complete', winnerUserId: 1}} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('WIN').textContent).toBe('WIN');
  });

  it('shows reconnect banner for disconnected player', () => {
    render(<MultiplayerGamePage currentUserId={1} game={{...game, players: [{...game.players[0], status: 'disconnected', disconnectDeadlineAt: Date.now() + 1000}, game.players[1]]}} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('재접속 대기').textContent).toBe('재접속 대기');
  });

  it('shows boss telegraph text when the boss pattern is warning the player', () => {
    render(
      <MultiplayerGamePage
        currentUserId={1}
        game={{ ...game, phase: 'boss', bossThemeId: 'pressure_intro', bossThemeLabel: '측면 압박', bossTelegraphText: '절반 막기', bossTelegraphTimer: 0.6 }}
        onDirectionChange={vi.fn()}
        onJump={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByText('절반 막기').textContent).toBe('절반 막기');
    expect(screen.getByText('측면 압박').textContent).toBe('측면 압박');
  });

  it('shows active debuff chips and vision jam overlay for the current player', () => {
    render(<MultiplayerGamePage currentUserId={1} game={{...game, players: [{...game.players[0], activeDebuffs: [{type: 'vision_jam', expiresAt: Date.now() + 1000}, {type: 'input_delay', expiresAt: Date.now() + 1000}]}, game.players[1]]}} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('시야 방해').textContent).toBe('시야 방해');
    expect(screen.getByText('입력 지연').textContent).toBe('입력 지연');
  });

  it('shows jump readiness when body block is enabled and the player is grounded', () => {
    render(<MultiplayerGamePage currentUserId={1} game={{...game, options: {...game.options, bodyBlock: true}}} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('점프 준비').textContent).toBe('점프 준비');
  });

  it('uses distinct player colors in the multiplayer player strip', () => {
    const { container } = render(<MultiplayerGamePage currentUserId={1} game={game} onDirectionChange={vi.fn()} onJump={vi.fn()} onLeave={vi.fn()} />);
    const playerPills = Array.from(container.querySelectorAll('.multiplayer-player-strip .effect-pill--player'));

    expect(playerPills).toHaveLength(2);
    expect(playerPills[0]?.getAttribute('style')).not.toBe(playerPills[1]?.getAttribute('style'));
  });
});
