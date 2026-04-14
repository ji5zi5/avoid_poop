// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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

import { CareerPage } from './CareerPage';

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
    normal: [],
    hard: [],
    multiplayer: [],
  },
};

describe('CareerPage', () => {
  beforeEach(() => {
    records.mockReset();
  });

  it('renders personal stats and recent history separately from rankings', async () => {
    records.mockResolvedValue(sampleRecords);

    render(<CareerPage onBack={vi.fn()} onSessionExpired={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('내 전적')).toBeTruthy());
    expect(screen.getByText('총 싱글 플레이')).toBeTruthy();
    expect(screen.getByText('최근 싱글 전적')).toBeTruthy();
    expect(screen.getByText('최근 멀티 전적')).toBeTruthy();
    expect(screen.getAllByText('멀티 승리 수').length).toBeGreaterThan(0);
    expect(screen.getAllByText('최종 승리').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1등 / 4명 / 8라운드').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '랭킹 보기' })).toBeTruthy();
  });
});
