import type {RoomOptions} from './multiplayer.schemas.js';
import type {MultiplayerDebuffType, MultiplayerPlayerState} from './game.types.js';

const BASE_DEBUFFS: MultiplayerDebuffType[] = ['slow', 'reverse', 'input_delay'];
const ADVANCED_DEBUFFS: MultiplayerDebuffType[] = ['vision_jam', 'item_lock'];

export class MultiplayerDebuffService {
  getAllowedDebuffs(options: Pick<RoomOptions, 'debuffTier'>): MultiplayerDebuffType[] {
    return options.debuffTier === 3 ? [...BASE_DEBUFFS, ...ADVANCED_DEBUFFS] : [...BASE_DEBUFFS];
  }

  chooseRandomTarget(players: MultiplayerPlayerState[], sourceUserId: number, randomValue = Math.random()) {
    const candidates = players.filter((player) => player.status === 'alive' && player.userId !== sourceUserId);
    if (candidates.length === 0) {
      return null;
    }
    const index = Math.min(candidates.length - 1, Math.floor(randomValue * candidates.length));
    return candidates[index] ?? null;
  }

  chooseDebuff(options: Pick<RoomOptions, 'debuffTier'>, randomValue = Math.random()) {
    const pool = this.getAllowedDebuffs(options);
    const index = Math.min(pool.length - 1, Math.floor(randomValue * pool.length));
    return pool[index]!;
  }
}
