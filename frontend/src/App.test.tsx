// @vitest-environment jsdom
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {me, createRoom, quickJoin, joinRoom, leaveRoom, records, listRooms, createRunSession, heartbeatRunSession, createWebSocketTicket} = vi.hoisted(() => ({
  me: vi.fn(),
  createRoom: vi.fn(),
  quickJoin: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  records: vi.fn(),
  listRooms: vi.fn(),
  createRunSession: vi.fn(),
  heartbeatRunSession: vi.fn(),
  createWebSocketTicket: vi.fn(),
}));

vi.mock('./lib/api', () => ({
  api: {
    me,
    logout: vi.fn().mockResolvedValue({ok: true}),
    createRoom,
    listRooms,
    quickJoin,
    joinRoom,
    records,
    createRunSession,
    heartbeatRunSession,
    createWebSocketTicket,
    saveRecord: vi.fn(),
    leaveRoom,
  },
  clearStoredSessionToken: vi.fn(),
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
    listRooms.mockResolvedValue([]);
    records.mockResolvedValue({
      profile: {totalRuns: 0, totalClears: 0, totalScore: 0},
      best: { nightmare: undefined, normal: undefined, hard: undefined },
      recent: [],
      multiplayer: {stats: {matchesPlayed: 0, wins: 0, bestPlacement: null}, recent: []},
      leaderboard: {normal: [], hard: [], nightmare: [], multiplayer: []},
    });
    createRunSession.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      mode: 'normal',
      waveSeed: 123,
      bossSeed: 456,
      startedAt: '2026-04-15T05:00:00.000Z',
    });
    heartbeatRunSession.mockResolvedValue({ ok: true });
    createWebSocketTicket.mockResolvedValue({ token: 'ws-ticket' });
  });

  it('opens multiplayer home after game start then multiplayer selection', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('게임 시작'));
    fireEvent.click(screen.getByText('게임 시작'));
    fireEvent.click(screen.getByText('멀티'));
    expect(screen.getByText('멀티 대전').textContent).toBe('멀티 대전');
  });
});
