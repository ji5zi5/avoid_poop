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
  it('shows room options and only the host start action until all players are ready', () => {
    render(<MultiplayerLobbyPage canStart connected room={room} userId={1} onLeave={vi.fn()} onSendChat={vi.fn()} onSetReady={vi.fn()} onKickPlayer={vi.fn()} onTransferHost={vi.fn()} onUpdateRoomSettings={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getAllByText('비공개방').length).toBeGreaterThan(0);
    expect(screen.getByText('방장 권한')).toBeTruthy();
    expect(screen.getByRole('button', { name: '방 설정' })).toBeTruthy();
    expect(screen.getByText('전원이 준비해야 시작 가능').textContent).toBe('전원이 준비해야 시작 가능');
    expect((screen.getByText('시작') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('준비 해제')).toBeNull();
  });

  it('shows only the ready action for non-host participants', () => {
    render(<MultiplayerLobbyPage canStart={false} connected room={room} userId={2} onLeave={vi.fn()} onSendChat={vi.fn()} onSetReady={vi.fn()} onKickPlayer={vi.fn()} onTransferHost={vi.fn()} onUpdateRoomSettings={vi.fn()} onStart={vi.fn()} />);
    expect(screen.getByText('준비 필요')).toBeTruthy();
    expect(screen.getByRole('button', { name: '준비' }).textContent).toBe('준비');
    expect(screen.queryByText('시작')).toBeNull();
    expect(screen.queryByRole('button', { name: '방 설정' })).toBeNull();
  });

  it('gives each lobby player a distinct visual accent', () => {
    render(<MultiplayerLobbyPage canStart connected room={room} userId={1} onLeave={vi.fn()} onSendChat={vi.fn()} onSetReady={vi.fn()} onKickPlayer={vi.fn()} onTransferHost={vi.fn()} onUpdateRoomSettings={vi.fn()} onStart={vi.fn()} />);

    const hostRow = screen.getByTestId('lobby-player-1');
    const guestRow = screen.getByTestId('lobby-player-2');

    expect(hostRow.getAttribute('style')).not.toBe(guestRow.getAttribute('style'));
  });

  it('sends chat message from the form', () => {
    const onSendChat = vi.fn();
    render(<MultiplayerLobbyPage canStart connected room={{...room, players: room.players.map((p) => ({...p, ready: true}))}} userId={1} onLeave={vi.fn()} onSendChat={onSendChat} onSetReady={vi.fn()} onKickPlayer={vi.fn()} onTransferHost={vi.fn()} onUpdateRoomSettings={vi.fn()} onStart={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('채팅'), {target: {value: '안녕'}});
    fireEvent.submit(screen.getByRole('button', {name: '보내기'}).closest('form')!);
    expect(onSendChat).toHaveBeenCalledWith('안녕');
  });

  it('keeps the chat panel height stable and scrolls to the latest message', () => {
    const initial = {
      ...room,
      chatMessages: [{ id: 'm1', userId: 2, username: 'guest', message: '첫 메시지', createdAt: '2026-04-16T10:00:00.000Z' }],
    };
    const { container, rerender } = render(<MultiplayerLobbyPage canStart connected room={initial} userId={1} onLeave={vi.fn()} onSendChat={vi.fn()} onSetReady={vi.fn()} onKickPlayer={vi.fn()} onTransferHost={vi.fn()} onUpdateRoomSettings={vi.fn()} onStart={vi.fn()} />);

    const chatPanel = container.querySelector('.multiplayer-chat-panel--heroic') as HTMLDivElement;
    const chatLog = container.querySelector('.multiplayer-chat-log') as HTMLUListElement;
    Object.defineProperty(chatLog, 'scrollHeight', { configurable: true, value: 420 });

    rerender(
      <MultiplayerLobbyPage
        canStart
        connected
        room={{
          ...initial,
          chatMessages: [...initial.chatMessages, { id: 'm2', userId: 1, username: 'host', message: '응답', createdAt: '2026-04-16T10:00:01.000Z' }],
        }}
        userId={1}
        onLeave={vi.fn()}
        onSendChat={vi.fn()}
        onSetReady={vi.fn()}
        onKickPlayer={vi.fn()}
        onTransferHost={vi.fn()}
        onUpdateRoomSettings={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(chatPanel.className).toContain('multiplayer-chat-panel--heroic');
    expect(chatLog.scrollTop).toBe(420);
    expect(container.querySelector('.multiplayer-chat-message.is-self')?.textContent).toContain('응답');
  });

  it('lets the host open a player management menu and trigger transfer or kick', () => {
    const onKickPlayer = vi.fn();
    const onTransferHost = vi.fn();

    render(
      <MultiplayerLobbyPage
        canStart
        connected
        room={room}
        userId={1}
        onLeave={vi.fn()}
        onSendChat={vi.fn()}
        onSetReady={vi.fn()}
        onKickPlayer={onKickPlayer}
        onTransferHost={onTransferHost}
        onUpdateRoomSettings={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'guest 관리' }));
    fireEvent.click(screen.getByRole('button', { name: '방장 넘기기' }));
    expect(screen.getByRole('dialog', { name: '방장 넘기기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '방장 넘기기' }));
    expect(onTransferHost).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByRole('button', { name: 'guest 관리' }));
    fireEvent.click(screen.getByRole('button', { name: '추방' }));
    expect(screen.getByRole('dialog', { name: '유저 추방' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '추방하기' }));
    expect(onKickPlayer).toHaveBeenCalledWith(2);
  });

  it('lets the host edit room settings from inside the lobby', () => {
    const onUpdateRoomSettings = vi.fn();

    render(
      <MultiplayerLobbyPage
        canStart
        connected
        room={room}
        userId={1}
        onLeave={vi.fn()}
        onSendChat={vi.fn()}
        onSetReady={vi.fn()}
        onKickPlayer={vi.fn()}
        onTransferHost={vi.fn()}
        onUpdateRoomSettings={onUpdateRoomSettings}
        onStart={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '방 설정' }));
    expect(screen.getByRole('dialog', { name: '방 설정' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('난이도'), { target: { value: 'normal' } });
    fireEvent.change(screen.getByLabelText('최대 인원'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('부딪힘'), { target: { value: 'off' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));

    expect(onUpdateRoomSettings).toHaveBeenCalledWith({
      options: { difficulty: 'normal', visibility: 'private', bodyBlock: false, debuffTier: 3 },
      maxPlayers: 4,
      privatePassword: undefined,
    });
  });
});
