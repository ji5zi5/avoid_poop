// @vitest-environment jsdom
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {records} = vi.hoisted(() => ({
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

import {MenuPage} from './MenuPage';

describe('MenuPage', () => {
  beforeEach(() => {
    records.mockReset();
    records.mockResolvedValue({
      best: {
        normal: {score: 58200},
        hard: {score: 82400},
      },
    });
  });

  it('opens single/multi chooser after pressing start', async () => {
    render(
      <MenuPage
        user={{id: 1, username: 'alpha'}}
        sessionSaveCount={0}
        onOpenMultiplayer={vi.fn()}
        onPlay={vi.fn()}
        onViewRecords={vi.fn()}
        onLogout={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('58,200 pts')).toBeTruthy());

    fireEvent.click(screen.getAllByText('게임 시작')[0]);
    expect(screen.getByText('싱글').textContent).toBe('싱글');
    expect(screen.getByText('멀티').textContent).toBe('멀티');
  });

  it('shows the fetched best score for the selected single-player mode', async () => {
    render(
      <MenuPage
        user={{id: 1, username: 'alpha'}}
        sessionSaveCount={0}
        onOpenMultiplayer={vi.fn()}
        onPlay={vi.fn()}
        onViewRecords={vi.fn()}
        onLogout={vi.fn()}
        onSessionExpired={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('58,200 pts')).toBeTruthy());

    fireEvent.click(screen.getAllByText('게임 시작')[0]);
    fireEvent.click(screen.getByRole('button', {name: '싱글'}));
    fireEvent.click(screen.getByRole('button', {name: '하드'}));

    await waitFor(() => expect(screen.getByText('82,400 pts')).toBeTruthy());
  });
});
