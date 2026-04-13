import type {RoomOptionsPatch, RoomSummary} from './multiplayer.schemas.js';
import {RoomService, type RoomUser} from './room.service.js';

export class MatchmakingService {
  constructor(private readonly roomService: RoomService) {}

  quickJoin(user: RoomUser, options?: RoomOptionsPatch): RoomSummary {
    const existingRoom = this.roomService.getRoomForUserId(user.id);
    if (existingRoom) {
      return existingRoom;
    }

    const candidateRoomCode = this.roomService.findJoinableRoom(options);
    if (!candidateRoomCode) {
      return this.roomService.createRoom(user, options);
    }

    return this.roomService.joinRoom(user, candidateRoomCode);
  }
}
