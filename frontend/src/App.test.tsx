// @vitest-environment jsdom
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {me, createRoom, quickJoin, joinRoom, leaveRoom, records} = vi.hoisted(() => ({
  me: vi.fn(),
  createRoom: vi.fn(),
  quickJoin: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  records: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  api: {
    me,
    logout: vi.fn().mockResolvedValue({ok: true}),
    createRoom,
    quickJoin,
    joinRoom,
    records,
    saveRecord: vi.fn(),
    leaveRoom,
  },
  ApiRequestError: class ApiRequestError extends Error { status = 400; },
}));

vi.mock('./lib/multiplayerClient', async () => {
  const actual = await vi.importActual<typeof import('./lib/multiplayerClient')>('./lib/multiplayerClient');
  return {
    ...actual,
    createMultiplayerClient: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      subscribe: vi.fn(),
      subscribeRoom: vi.fn(),
      ping: vi.fn(),
      setReconnectToken: vi.fn(),
    }),
  };
});

import App from './App';

describe('App multiplayer entry flow', () => {
  beforeEach(() => {
    me.mockResolvedValue({authenticated: true, user: {id: 1, username: 'alpha'}});
    createRoom.mockResolvedValue({
      roomCode: 'ROOM42',
      hostUserId: 1,
      status: 'waiting',
      maxPlayers: 8,
      playerCount: 1,
      players: [{userId: 1, username: 'alpha', isHost: true, ready: false}],
      options: {difficulty: 'normal', visibility: 'public', bodyBlock: false, debuffTier: 2},
      chatMessages: [],
    });
    leaveRoom.mockResolvedValue({ok: true});
    records.mockResolvedValue({
      profile: {totalRuns: 0, totalClears: 0, totalScore: 0},
      best: {},
      recent: [],
      multiplayer: {stats: {matchesPlayed: 0, wins: 0, bestPlacement: null}, recent: []},
      leaderboard: {normal: [], hard: [], multiplayer: []},
    });
  });

  it('opens multiplayer home after game start then multiplayer selection', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('게임 시작'));
    fireEvent.click(screen.getByText('게임 시작'));
    fireEvent.click(screen.getByText('멀티'));
    expect(screen.getByText('멀티 대전').textContent).toBe('멀티 대전');
  });
});
