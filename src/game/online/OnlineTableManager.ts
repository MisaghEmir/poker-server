import { OnlineRoom, OnlinePlayer } from "./OnlineRoom";

export class OnlineTableManager {
  private rooms: Map<string, OnlineRoom> = new Map();

  private roomCounter = 1;

  /**
   * پیدا کردن میزی که ظرفیت دارد
   */
  findAvailableRoom(): OnlineRoom | null {
    for (const room of this.rooms.values()) {
      if (room.hasSpace()) {
        return room;
      }
    }

    return null;
  }

  /**
   * ساخت میز جدید
   */
  createRoom(): OnlineRoom {
    const roomId = `online-${this.roomCounter++}`;

    const room = new OnlineRoom(roomId);

    this.rooms.set(roomId, room);

    console.log(`🆕 ONLINE ROOM CREATED: ${roomId}`);

    return room;
  }

  /**
   * پیدا کردن یا ساختن میز
   */
  findOrCreateRoom(): OnlineRoom {
    const availableRoom = this.findAvailableRoom();

    if (availableRoom) {
      return availableRoom;
    }

    return this.createRoom();
  }

  /**
   * اضافه کردن بازیکن به بهترین میز
   */
  joinRoom(player: OnlinePlayer): OnlineRoom | null {
    let room = this.findAvailableRoom();

    // اگر هیچ میزی جا نداشت
    if (!room) {
      room = this.createRoom();
    }

    const added = room.addPlayer(player);

    if (!added) {
      console.log(
        `❌ Could not add ${player.username} to ${room.roomId}`
      );

      return null;
    }

    console.log(
      `👤 ${player.username} joined ${room.roomId}`
    );

    console.log(
      `👥 Players: ${room.getPlayerCount()}/${room.maxPlayers}`
    );

    return room;
  }

  /**
   * پیدا کردن میز بر اساس ID
   */
  getRoom(roomId: string): OnlineRoom | null {
    return this.rooms.get(roomId) ?? null;
  }

  /**
   * حذف بازیکن از میز
   */
  removePlayer(
    roomId: string,
    userId: string
  ): OnlinePlayer | null {
    const room = this.getRoom(roomId);

    if (!room) {
      return null;
    }

    const player = room.removePlayer(userId);

    // اگر میز کاملاً خالی شد حذفش کن
    if (room.players.length === 0) {
      this.rooms.delete(roomId);

      console.log(
        `🗑️ ONLINE ROOM DELETED: ${roomId}`
      );
    }

    return player;
  }

  /**
   * تمام میزها
   */
  getRooms(): OnlineRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * تعداد میزها
   */
  getRoomCount(): number {
    return this.rooms.size;
  }
}