import type {RoomSummary} from './multiplayer.schemas.js';
import {RoomService, type RoomUser} from './room.service.js';

export class MatchmakingService {
  constructor(private readonly roomService: RoomService) {}

  quickJoin(user: RoomUser): RoomSummary {
    const existingRoom = this.roomService.getRoomForUserId(user.id);
    if (existingRoom) {
      return existingRoom;
    }

    const candidateRoomCode = this.roomService.findJoinableRoom({ visibility: "public" });
    if (!candidateRoomCode) {
      return this.roomService.createRoom(user, { visibility: "public" });
    }

    return this.roomService.joinRoom(user, candidateRoomCode);
  }
}
