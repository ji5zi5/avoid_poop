// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {MultiplayerLobbyPage} from './MultiplayerLobbyPage';

const room = {
  roomCode: 'ROOM42',
  hostUserId: 1,
  status: 'waiting' as const,
  maxPlayers: 8,
  playerCount: 2,
  options: {difficulty: 'hard' as const, visibility: 'private' as const, bodyBlock: true, debuffTier: 3 as const},
  players: [
    {userId: 1, username: 'host', isHost: true, ready: true},
    {userId: 2, username: 'guest', isHost: false, ready: false},
  ],
  chatMessages: [],
};

afterEach(() => cleanup());

describe('MultiplayerLobbyPage', () => {
  it('shows room options and disables start until all players are ready', () => {
    render(<MultiplayerLobbyPage canStart connected room={room} userId={1} onLeave={vi.fn()} onSendChat={vi.fn()} onSetReady={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByText((_, node) => node?.textContent === '방 공개: 비공개방').textContent).toBe('방 공개: 비공개방');
    expect(screen.getByText((_, node) => node?.textContent === '난이도: 하드').textContent).toBe('난이도: 하드');
    expect(screen.getByText((_, node) => node?.textContent === '길막: ON').textContent).toBe('길막: ON');
    expect(screen.getByText('전원이 준비해야 시작 가능').textContent).toBe('전원이 준비해야 시작 가능');
    expect((screen.getByText('시작') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends chat message from the form', () => {
    const onSendChat = vi.fn();
    render(<MultiplayerLobbyPage canStart connected room={{...room, players: room.players.map((p) => ({...p, ready: true}))}} userId={1} onLeave={vi.fn()} onSendChat={onSendChat} onSetReady={vi.fn()} onStart={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('채팅'), {target: {value: '안녕'}});
    fireEvent.submit(screen.getByRole('button', {name: '보내기'}).closest('form')!);
    expect(onSendChat).toHaveBeenCalledWith('안녕');
  });
});
