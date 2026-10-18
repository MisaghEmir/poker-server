import Room from "./Room";
import Player from "./Player";
import { GameState } from "./GameState";
import { PlayerAction } from "./PlayerAction";
import HandEvaluator from "./HandEvaluator";

export default class PokerEngine {
  room: Room;
  roundTimer?: NodeJS.Timeout;

  onUpdate?: () => void;
  onWin?: (playerId: string, amount: number) => void;

  constructor(room: Room) {
    this.room = room;
  }

  // =====================================================
  // HELPERS
  // =====================================================

  getCurrentPlayer(): Player {
    return this.room.players[this.room.currentPlayerIndex];
  }

  /** بازیکنانی که فولد نکرده‌اند */
  getActivePlayers(): Player[] {
    return this.room.players.filter((p) => !p.folded);
  }

  /** بازیکنانی که هنوز می‌توانند شرط ببندند (نه فولد، نه All-In) */
  getPlayersWhoCanAct(): Player[] {
    return this.room.players.filter((p) => !p.folded && !p.allIn);
  }

  /**
   * آیا دیگر شرط‌بندی ممکن نیست؟
   * یعنی کمتر از ۲ نفر باقی مانده که بتوانند بازی کنند.
   * در این حالت باید بورد تا River پخش شود و Showdown شود.
   */
  isActionClosed(): boolean {
    return this.getPlayersWhoCanAct().length <= 1;
  }

  // =====================================================
  // NEXT TURN  (فولد + All-In را رد می‌کند)
  // =====================================================

  nextTurn() {
    const totalPlayers = this.room.players.length;
    if (totalPlayers === 0) return;

    let count = 0;

    do {
      this.room.currentPlayerIndex =
        (this.room.currentPlayerIndex + 1) % totalPlayers;

      count++;
      if (count > totalPlayers) return;

      const p = this.room.players[this.room.currentPlayerIndex];
      // هم فولد و هم All-In را رد کن
      if (!p.folded && !p.allIn) break;
    } while (true);
  }

  // =====================================================
  // RUN BOARD TO RIVER + SHOWDOWN
  // =====================================================

  /**
   * کارت‌های باقی‌مانده را یکی‌یکی پخش می‌کند
   * و در نهایت Showdown می‌کند.
   */
  runOutBoardAndShowdown() {
    console.log("🃏 ACTION CLOSED → RUNNING BOARD TO RIVER");

    const dealNext = () => {
      if (this.room.communityCards.length >= 5) {
        this.room.state = GameState.SHOWDOWN;
        this.onUpdate?.();
        this.showdown();
        return;
      }

      if (this.room.communityCards.length === 0) {
        this.room.dealFlop();
        this.room.state = GameState.FLOP;
      } else if (this.room.communityCards.length === 3) {
        this.room.dealTurn();
        this.room.state = GameState.TURN;
      } else if (this.room.communityCards.length === 4) {
        this.room.dealRiver();
        this.room.state = GameState.RIVER;
      }

      console.log(
        "🃏 DEALT →",
        this.room.state,
        "cards:",
        this.room.communityCards.length,
      );

      this.onUpdate?.();

      // کمی تأخیر برای UI
      this.roundTimer = setTimeout(dealNext, 900);
    };

    // اگر همین الان ۵ کارت داریم مستقیم showdown
    if (this.room.communityCards.length >= 5) {
      this.room.state = GameState.SHOWDOWN;
      this.onUpdate?.();
      this.showdown();
      return;
    }

    dealNext();
  }

  // =====================================================
  // NEXT ROUND
  // =====================================================

  nextRound() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }

    const activePlayers = this.getActivePlayers();

    // فقط یک بازیکن → برنده با فولد
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        this.room.winner = winner;

        const wonAmount = this.room.pot;
        winner.chips += wonAmount;
        this.onWin?.(winner.id, wonAmount);

        this.room.pot = 0;
        this.room.state = GameState.SHOWDOWN;

        console.log("🏆 WINNER BY FOLD (nextRound):", winner.username);
        this.onUpdate?.();

        setTimeout(() => this.startNextHand(), 5000);
      }
      return;
    }

    // کمتر از ۲ نفر می‌توانند شرط ببندند → بورد را تا آخر پخش کن
    if (this.isActionClosed()) {
      this.runOutBoardAndShowdown();
      return;
    }

    // ریست شرط‌های راند
    this.room.players.forEach((p) => {
      p.currentBet = 0;
      (p as any).actedThisRound = false;
    });
    this.room.currentBet = 0;

    // خیابان بعدی
    switch (this.room.state) {
      case GameState.PRE_FLOP:
        this.room.dealFlop();
        this.room.state = GameState.FLOP;
        break;

      case GameState.FLOP:
        this.room.dealTurn();
        this.room.state = GameState.TURN;
        break;

      case GameState.TURN:
        this.room.dealRiver();
        this.room.state = GameState.RIVER;
        break;

      case GameState.RIVER:
        this.room.state = GameState.SHOWDOWN;
        console.log("🏆 RIVER FINISHED → SHOWDOWN");
        this.showdown();
        return;
    }

    // شروع‌کننده راند جدید (نزدیک‌ترین بازیکن فعال بعد از SB)
    const smallBlindIndex = this.room.players.findIndex((p) => p.smallBlind);
    let start =
      smallBlindIndex >= 0 ? smallBlindIndex : this.room.currentPlayerIndex;

    let count = 0;
    while (
      (this.room.players[start]?.folded ||
        this.room.players[start]?.allIn) &&
      count < this.room.players.length
    ) {
      start = (start + 1) % this.room.players.length;
      count++;
    }

    this.room.currentPlayerIndex = start;

    console.log(
      "NEXT ROUND:",
      this.room.state,
      "TURN:",
      this.getCurrentPlayer()?.username,
    );

    this.onUpdate?.();
  }

  // =====================================================
  // PLAYER ACTION
  // =====================================================

  playerAction(player: Player, action: PlayerAction, amount = 0) {
    if (
      this.room.state === GameState.SHOWDOWN ||
      this.room.state === GameState.FINISHED
    ) {
      return;
    }

    console.log(
      "CURRENT BEFORE ACTION:",
      this.getCurrentPlayer()?.username,
      "ACTION PLAYER:",
      player.username,
    );

    switch (action) {
      case PlayerAction.FOLD:
        player.fold();
        console.log("AFTER FOLD:", player.username, player.folded);
        break;

      case PlayerAction.CHECK:
        break;

      case PlayerAction.CALL: {
        const highestBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );
        const callAmount = highestBet - player.currentBet;

        if (callAmount > 0) {
          const actualAmount = Math.min(callAmount, player.chips);
          player.bet(actualAmount);
          this.room.pot += actualAmount;
        }
        break;
      }

      case PlayerAction.RAISE: {
        const highestBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );
        const total = highestBet - player.currentBet + amount;
        const actualAmount = Math.min(total, player.chips);

        player.bet(actualAmount);
        this.room.pot += actualAmount;
        this.room.currentBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );
        break;
      }

      case PlayerAction.ALL_IN: {
        const chips = player.chips;
        console.log("🔥 ALL IN:", player.username, "CHIPS:", chips);

        if (chips > 0) {
          player.bet(chips);
          this.room.pot += chips;
        }

        this.room.currentBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );
        break;
      }
    }

    player.lastAction = action;
    (player as any).actedThisRound = true;

    console.log("ACTION:", player.username, action);
    console.log(
      "PLAYER STATUS:",
      this.room.players.map((p) => ({
        username: p.username,
        chips: p.chips,
        currentBet: p.currentBet,
        allIn: p.allIn,
        folded: p.folded,
        acted: (p as any).actedThisRound,
      })),
    );

    // ─── فقط یک بازیکن مانده ───
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      this.room.winner = winner;

      const wonAmount = this.room.pot;
      winner.chips += wonAmount;
      this.onWin?.(winner.id, wonAmount);

      this.room.pot = 0;
      this.room.state = GameState.SHOWDOWN;

      console.log("🏆 WINNER BY FOLD:", winner.username);
      this.onUpdate?.();

      setTimeout(() => this.startNextHand(), 5000);
      return;
    }

    // ─── دیگر کسی نمی‌تواند شرط ببندد (All-In / Call All-In) ───
    if (this.isActionClosed()) {
      console.log("🔥 ACTION CLOSED (≤1 player can still act)");
      this.onUpdate?.();

      this.roundTimer = setTimeout(() => {
        this.runOutBoardAndShowdown();
      }, 700);
      return;
    }

    // ─── راند شرط‌بندی تمام شده ───
    if (this.isBettingRoundFinished()) {
      console.log("🏁 ROUND FINISHED");
      this.onUpdate?.();

      this.roundTimer = setTimeout(() => {
        this.nextRound();
      }, 1000);
      return;
    }

    // ─── نوبت بعدی ───
    setTimeout(() => {
      this.nextTurn();
      this.onUpdate?.();
    }, 1700);
  }

  // =====================================================
  // BETTING ROUND FINISHED  (باگ All-In از راند قبل اینجا بود)
  // =====================================================

  isBettingRoundFinished(): boolean {
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length <= 1) return true;

    // همه All-In → راند تمام
    if (activePlayers.every((p) => p.allIn)) return true;

    const highestBet = Math.max(...activePlayers.map((p) => p.currentBet));

    // All-Inها نیازی به actedThisRound ندارند
    return activePlayers.every(
      (p) =>
        p.allIn ||
        ((p as any).actedThisRound && p.currentBet === highestBet),
    );
  }

  // =====================================================
  // SHOWDOWN
  // =====================================================

  showdown() {
    console.log("🏆 ================= SHOWDOWN =================");

    console.log(
      this.room.players.map((p) => ({
        name: p.username,
        folded: p.folded,
        allIn: p.allIn,
        hand: p.hand,
      })),
    );

    const activePlayers = this.getActivePlayers();

    if (activePlayers.length === 0) {
      console.log("❌ SHOWDOWN: NO ACTIVE PLAYERS");
      return;
    }

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      this.room.winner = winner;

      const wonAmount = this.room.pot;
      winner.chips += wonAmount;
      this.onWin?.(winner.id, wonAmount);

      this.room.pot = 0;
      console.log("🏆 SHOWDOWN WINNER:", winner.username);
      this.onUpdate?.();

      setTimeout(() => this.startNextHand(), 5000);
      return;
    }

    const results = activePlayers.map((player) => ({
      player,
      result: HandEvaluator.evaluate(player.hand, this.room.communityCards),
    }));

    console.log(
      "🧠 HAND RESULTS:",
      results.map((item) => ({
        username: item.player.username,
        hand: item.player.hand,
        score: item.result.score,
        name: item.result.name,
        winningCards: item.result.winningCards,
      })),
    );

    results.sort((a, b) => b.result.score - a.result.score);

    const winnerResult = results[0];

    this.room.winner = winnerResult.player;
    this.room.winnerHand = winnerResult.result.name;
    this.room.winnerCards = winnerResult.result.winningCards;

    console.log("🏆 WINNER:", winnerResult.player.username);
    console.log("🏆 WINNING HAND:", winnerResult.result.name);

    const wonAmount = this.room.pot;
    winnerResult.player.chips += wonAmount;
    this.onWin?.(winnerResult.player.id, wonAmount);

    this.room.pot = 0;
    this.room.state = GameState.SHOWDOWN;
    this.onUpdate?.();

    setTimeout(() => this.startNextHand(), 15000);
  }

  // =====================================================
  // START NEXT HAND
  // =====================================================

  startNextHand() {
    console.log("====================================");
    console.log("🔄 START NEXT HAND");

    const playablePlayers = this.room.players.filter((p) => p.chips > 0);

    console.log(
      "👥 PLAYABLE:",
      playablePlayers.map((p) => ({
        id: p.id,
        username: p.username,
        chips: p.chips,
      })),
    );

    if (playablePlayers.length < 2) {
      console.log("🛑 NEXT HAND BLOCKED");

      this.room.state = GameState.WAITING;
      this.room.currentPlayerIndex = 0;
      this.room.communityCards = [];
      this.room.pot = 0;
      this.room.currentBet = 0;
      this.room.winner = null;
      this.room.winnerHand = null;
      this.room.winnerCards = [];

      this.room.players.forEach((player) => {
        player.clearHand();
        player.currentBet = 0;
        player.folded = false;
        player.lastAction = null;
        (player as any).actedThisRound = false;
      });

      this.onUpdate?.();
      console.log("🟡 TABLE IS WAITING");
      return;
    }

    this.room.players.forEach((player) => {
      if (player.chips <= 0) {
        player.folded = true;
      }
    });

    this.room.winner = null;
    this.room.winnerHand = null;
    this.room.winnerCards = [];

    this.room.nextDealer();
    this.room.startGame();
    this.onUpdate?.();

    console.log("🎮 NEW HAND STARTED:", this.room.state);
  }

  // =====================================================
  // STOP
  // =====================================================

  stop() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }
  }
}