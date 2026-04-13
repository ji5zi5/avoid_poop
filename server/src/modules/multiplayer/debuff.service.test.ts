import assert from 'node:assert/strict';
import test from 'node:test';

import {MultiplayerDebuffService} from './debuff.service.js';
import type {MultiplayerPlayerState} from './game.types.js';

const service = new MultiplayerDebuffService();

function createPlayer(userId: number, status: MultiplayerPlayerState['status'] = 'alive'): MultiplayerPlayerState {
  return {
    userId,
    username: `player_${userId}`,
    x: 0,
    y: 0,
    width: 36,
    height: 24,
    direction: 0,
    lives: 3,
    status,
    disconnectDeadlineAt: null,
    airborneUntil: null,
    activeDebuffs: []
  };
}

test('random target excludes source and inactive players', () => {
  const players = [
    createPlayer(1, 'alive'),
    createPlayer(2, 'alive'),
    createPlayer(3, 'spectator'),
    createPlayer(4, 'disconnected')
  ];

  const target = service.chooseRandomTarget(players, 1, 0.2);

  assert.equal(target?.userId, 2);
});

test('tier 2 and tier 3 debuff pools differ', () => {
  const tier2 = service.getAllowedDebuffs({debuffTier: 2});
  const tier3 = service.getAllowedDebuffs({debuffTier: 3});

  assert.deepEqual(tier2, ['slow', 'reverse', 'input_delay']);
  assert.deepEqual(tier3, ['slow', 'reverse', 'input_delay', 'vision_jam', 'item_lock']);
});
