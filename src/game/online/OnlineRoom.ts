export type OnlinePlayerStatus = "PLAYING" | "WAITING";

export interface OnlinePlayer {
  userId: string;
  socketId: string;
  username: string;
  chips: number;

  status: OnlinePlayerStatus;

  isFolded: boolean;
  isConnected: boolean;
}

export type OnlineRoomStatus = "WAITING" | "PLAYING";

export class OnlineRoom {
  public roomId: string;

  public maxPlayers: number = 5;

  public players: OnlinePlayer[] = [];

  public status: OnlineRoomStatus = "WAITING";

  // آیا الان یک Hand در حال اجراست؟
  public isHandRunning: boolean = false;

  // شماره Hand
  public currentHandId: number = 0;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  // =========================
  // ظرفیت میز
  // =========================

  hasSpace(): boolean {
    return this.players.length < this.maxPlayers;
  }

  getPlayerCount(): number {
    return this.players.length;
  }

  // =========================
  // بررسی بازیکن
  // =========================

  hasPlayer(userId: string): boolean {
    return this.players.some(
      (player) => player.userId === userId
    );
  }

  // =========================
  // اضافه کردن بازیکن
  // =========================

  addPlayer(player: OnlinePlayer): boolean {
    if (!this.hasSpace()) {
      return false;
    }

    if (this.hasPlayer(player.userId)) {
      return false;
    }

    /*
      اگر Hand در حال اجرا باشد،
      بازیکن فعلاً منتظر می‌ماند
      تا Hand بعدی.
    */
    if (this.isHandRunning) {
      player.status = "WAITING";
    } else {
      player.status = "PLAYING";
    }

    this.players.push(player);

    return true;
  }

  // =========================
  // حذف بازیکن
  // =========================

  removePlayer(userId: string): OnlinePlayer | null {
    const index = this.players.findIndex(
      (player) => player.userId === userId
    );

    if (index === -1) {
      return null;
    }

    const [removedPlayer] =
      this.players.splice(index, 1);

    return removedPlayer;
  }

  // =========================
  // بازیکنان فعال
  // =========================

  getPlayingPlayers(): OnlinePlayer[] {
    return this.players.filter(
      (player) => player.status === "PLAYING"
    );
  }

  // =========================
  // بازیکنان منتظر
  // =========================

  getWaitingPlayers(): OnlinePlayer[] {
    return this.players.filter(
      (player) => player.status === "WAITING"
    );
  }

  // =========================
  // شروع Hand
  // =========================

  startHand(): boolean {
    // حداقل ۲ نفر لازم است
    if (this.getPlayingPlayers().length < 2) {
      return false;
    }

    this.isHandRunning = true;

    this.status = "PLAYING";

    this.currentHandId++;

    // همه بازیکن‌های فعال
    // برای شروع Hand جدید Fold نیستند
    this.players.forEach((player) => {
      if (player.status === "PLAYING") {
        player.isFolded = false;
      }
    });

    console.log(
      `🎮 HAND ${this.currentHandId} STARTED IN ${this.roomId}`
    );

    return true;
  }

  // =========================
  // پایان Hand
  // =========================

  endHand(): void {
    this.isHandRunning = false;

    // بازیکن‌هایی که وسط Hand منتظر بودند
    // از Hand بعدی وارد بازی می‌شوند
    this.activateWaitingPlayers();

    if (this.getPlayingPlayers().length >= 2) {
      this.status = "PLAYING";
    } else {
      this.status = "WAITING";
    }

    console.log(
      `🏁 HAND ${this.currentHandId} ENDED IN ${this.roomId}`
    );
  }

  // =========================
  // فعال کردن بازیکنان منتظر
  // =========================

  activateWaitingPlayers(): void {
    this.players.forEach((player) => {
      if (player.status === "WAITING") {
        player.status = "PLAYING";
        player.isFolded = false;
      }
    });
  }

  // =========================
  // آیا بازی می‌تواند شروع شود؟
  // =========================

  canStartGame(): boolean {
    return this.getPlayingPlayers().length >= 2;
  }
}