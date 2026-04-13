// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecordsResponse } from '../../../shared/src/contracts/index';

const { records } = vi.hoisted(() => ({
  records: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    records,
  },
  ApiRequestError: class ApiRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = 'ApiRequestError';
      this.status = status;
    }
  },
}));

import { ApiRequestError } from '../lib/api';
import { RecordsPage } from './RecordsPage';

const sampleRecords: RecordsResponse = {
  profile: {
    totalRuns: 12,
    totalClears: 4,
    totalScore: 987,
  },
  best: {
    normal: {
      id: 11,
      userId: 7,
      mode: 'normal',
      score: 321,
      reachedRound: 6,
      survivalTime: 45.6,
      clear: true,
      createdAt: '2026-04-13T09:00:00.000Z',
    },
    hard: {
      id: 12,
      userId: 7,
      mode: 'hard',
      score: 222,
      reachedRound: 5,
      survivalTime: 37.4,
      clear: false,
      createdAt: '2026-04-13T09:05:00.000Z',
    },
  },
  recent: [
    {
      id: 12,
      userId: 7,
      mode: 'hard',
      score: 222,
      reachedRound: 5,
      survivalTime: 37.4,
      clear: false,
      createdAt: '2026-04-13T09:05:00.000Z',
    },
    {
      id: 11,
      userId: 7,
      mode: 'normal',
      score: 321,
      reachedRound: 6,
      survivalTime: 45.6,
      clear: true,
      createdAt: '2026-04-13T09:00:00.000Z',
    },
  ],
  multiplayer: {
    stats: {
      matchesPlayed: 9,
      wins: 3,
      bestPlacement: 1,
    },
    recent: [
      {
        matchId: 42,
        placement: 1,
        totalPlayers: 4,
        reachedRound: 8,
        won: true,
        createdAt: '2026-04-13T09:10:00.000Z',
      },
    ],
  },
  leaderboard: {
    normal: [
      {
        rank: 1,
        userId: 7,
        username: 'alpha',
        score: 321,
        reachedRound: 6,
        survivalTime: 45.6,
        clear: true,
        createdAt: '2026-04-13T09:00:00.000Z',
      },
      {
        rank: 2,
        userId: 8,
        username: 'bravo',
        score: 280,
        reachedRound: 5,
        survivalTime: 33.1,
        clear: false,
        createdAt: '2026-04-13T09:03:00.000Z',
      },
    ],
    hard: [
      {
        rank: 1,
        userId: 9,
        username: 'charlie',
        score: 410,
        reachedRound: 8,
        survivalTime: 52.2,
        clear: true,
        createdAt: '2026-04-13T09:15:00.000Z',
      },
    ],
    multiplayer: [
      {
        rank: 1,
        userId: 7,
        username: 'alpha',
        wins: 3,
        matchesPlayed: 9,
        bestPlacement: 1,
        bestReachedRound: 8,
      },
      {
        rank: 2,
        userId: 8,
        username: 'bravo',
        wins: 1,
        matchesPlayed: 6,
        bestPlacement: 2,
        bestReachedRound: 6,
      },
    ],
  },
};

describe('RecordsPage', () => {
  beforeEach(() => {
    records.mockReset();
  });

  it('renders ranking summaries and switches between leaderboard tabs', async () => {
    records.mockResolvedValue(sampleRecords);

    render(<RecordsPage onBack={vi.fn()} onSessionExpired={vi.fn()} />);

    expect(screen.getByText('기록을 불러오는 중...')).toBeTruthy();

    await waitFor(() => expect(screen.getByText('랭킹 & 전적')).toBeTruthy());

    expect(screen.getByText('총 싱글 플레이')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('클리어 수 4')).toBeTruthy();
    expect(screen.getAllByText('멀티 승리 수').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('멀티 경기 수 9').length).toBeGreaterThan(0);

    expect(screen.getAllByText('alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('#1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('점수 321 / 6라운드').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('45.6초').length).toBeGreaterThan(0);
    expect(screen.getAllByText('클리어').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '하드' }));
    await waitFor(() => expect(screen.getAllByText('charlie').length).toBeGreaterThan(0));
    expect(screen.getAllByText('점수 410 / 8라운드').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '멀티' }));
    await waitFor(() => expect(screen.getAllByText('멀티 승리 수').length).toBeGreaterThan(0));
    expect(screen.getAllByText('최고 순위 1등').length).toBeGreaterThan(0);
    expect(screen.getAllByText('최고 라운드 8').length).toBeGreaterThan(0);
    expect(screen.getAllByText('최종 승리').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1등 / 4명 / 8라운드').length).toBeGreaterThan(0);
  });

  it('redirects to auth when the records request returns 401', async () => {
    const onSessionExpired = vi.fn();
    records.mockRejectedValue(new ApiRequestError('Authentication required.', 401));

    render(<RecordsPage onBack={vi.fn()} onSessionExpired={onSessionExpired} />);

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('로그인이 필요한 화면입니다.')).toBeNull();
  });

  it('shows translated errors for non-auth failures', async () => {
    records.mockRejectedValue(new Error('Failed to load records'));

    render(<RecordsPage onBack={vi.fn()} onSessionExpired={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('기록을 불러오지 못했습니다.')).toBeTruthy());
  });
});
