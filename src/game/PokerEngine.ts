import Room from "./Room";
import Player from "./Player";
import { GameState } from "./GameState";
import { PlayerAction } from "./PlayerAction";
import HandEvaluator from "./HandEvaluator";

export default class PokerEngine {
  room: Room;
  roundTimer?: NodeJS.Timeout;

  onUpdate?: () => void;

  constructor(room: Room) {
    this.room = room;
  }

  // =====================================================
  // CURRENT PLAYER
  // =====================================================

  getCurrentPlayer(): Player {
    return this.room.players[this.room.currentPlayerIndex];
  }

  // =====================================================
  // NEXT TURN
  // =====================================================

  nextTurn() {
    const totalPlayers = this.room.players.length;

    if (totalPlayers === 0) return;

    let count = 0;

    do {
      this.room.currentPlayerIndex =
        (this.room.currentPlayerIndex + 1) % totalPlayers;

      count++;

      if (count > totalPlayers) {
        return;
      }
    } while (this.room.players[this.room.currentPlayerIndex].folded);
  }

  // =====================================================
  // NEXT ROUND
  // =====================================================

  nextRound() {
    // پاک کردن تایمر قبلی
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }

    const activePlayers = this.room.players.filter((p) => !p.folded);

    // =====================================================
    // فقط یک بازیکن باقی مانده
    // =====================================================

    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];

        this.room.winner = winner;

        winner.chips += this.room.pot;

        this.room.pot = 0;

        this.room.state = GameState.SHOWDOWN;

        console.log("🏆 WINNER BY NEXT ROUND:", winner.username);

        this.onUpdate?.();

        setTimeout(() => {
          this.startNextHand();
        }, 5000);
      }

      return;
    }

    // =====================================================
    // اگر همه بازیکنان All-In هستند
    //
    // باید کارت‌های باقی‌مانده تا River پخش شوند
    // و سپس مستقیم Showdown
    // =====================================================

    if (activePlayers.every((p) => p.allIn)) {
      console.log("🔥 ALL PLAYERS ALL-IN → RUNNING BOARD TO RIVER");

      while (this.room.communityCards.length < 5) {
        if (this.room.communityCards.length === 0) {
          this.room.dealFlop();

          this.room.state = GameState.FLOP;
        } else if (this.room.communityCards.length === 3) {
          this.room.dealTurn();

          this.room.state = GameState.TURN;
        } else if (this.room.communityCards.length === 4) {
          this.room.dealRiver();

          this.room.state = GameState.RIVER;
        } else {
          break;
        }
      }

      console.log("🃏 FINAL COMMUNITY CARDS:", this.room.communityCards);

      this.room.state = GameState.SHOWDOWN;

      console.log("🏆 ALL-IN → SHOWDOWN");

      this.showdown();

      return;
    }

    // =====================================================
    // ریست شرط‌های راند
    // =====================================================

    this.room.players.forEach((p) => {
      p.currentBet = 0;

      (p as any).actedThisRound = false;
    });

    this.room.currentBet = 0;

    // =====================================================
    // تغییر وضعیت بازی
    // =====================================================

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

    // =====================================================
    // پیدا کردن شروع کننده راند جدید
    // =====================================================

    const smallBlindIndex = this.room.players.findIndex((p) => p.smallBlind);

    let start =
      smallBlindIndex >= 0 ? smallBlindIndex : this.room.currentPlayerIndex;

    let count = 0;

    while (
      this.room.players[start]?.folded &&
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

    console.log("SET TURN TO:", this.getCurrentPlayer()?.username);
  }

  // =====================================================
  // PLAYER ACTION
  // =====================================================

  playerAction(player: Player, action: PlayerAction, amount = 0) {
    // =====================================================
    // GAME FINISHED
    // =====================================================

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

    // =====================================================
    // ACTION
    // =====================================================

    switch (action) {
      // ---------------------------------------------------
      // FOLD
      // ---------------------------------------------------

      case PlayerAction.FOLD:
        player.fold();

        console.log("AFTER FOLD:", player.username, player.folded);

        break;

      // ---------------------------------------------------
      // CHECK
      // ---------------------------------------------------

      case PlayerAction.CHECK:
        break;

      // ---------------------------------------------------
      // CALL
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // RAISE
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // ALL IN
      // ---------------------------------------------------

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

    // =====================================================
    // CHECK ACTIVE PLAYERS
    // =====================================================

    const activePlayers = this.room.players.filter((p) => !p.folded);

    // =====================================================
    // ONLY ONE PLAYER
    // =====================================================

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];

      this.room.winner = winner;

      winner.chips += this.room.pot;

      this.room.pot = 0;

      this.room.state = GameState.SHOWDOWN;

      console.log("🏆 WINNER BY FOLD:", winner.username);

      this.onUpdate?.();

      setTimeout(() => {
        this.startNextHand();
      }, 5000);

      return;
    }

    // =====================================================
    // ALL PLAYERS ALL-IN
    //
    // این مهم‌ترین قسمت است.
    //
    // اگر همه All-In شده‌اند، دیگر نباید منتظر
    // nextTurn بمانیم.
    // =====================================================

    const allPlayersAllIn =
      activePlayers.length > 1 && activePlayers.every((p) => p.allIn);

    if (allPlayersAllIn) {
      console.log("🔥🔥 ALL PLAYERS ARE ALL-IN");

      // اگر هنوز River نرسیدیم،
      // nextRound خودش تا River کارت‌ها را پخش می‌کند.

      if (this.room.communityCards.length < 5) {
        console.log("🃏 RUNNING REMAINING CARDS...");

        this.onUpdate?.();

        this.roundTimer = setTimeout(() => {
          this.nextRound();
        }, 800);

        return;
      }

      // اگر River هستیم
      this.room.state = GameState.SHOWDOWN;

      console.log("🏆 ALL-IN ON RIVER → SHOWDOWN");

      this.showdown();

      return;
    }

    // =====================================================
    // BETTING ROUND FINISHED
    // =====================================================

    if (this.isBettingRoundFinished()) {
      console.log("🏁 ROUND FINISHED");

      this.onUpdate?.();

      this.roundTimer = setTimeout(() => {
        this.nextRound();
      }, 1000);

      return;
    }

    // =====================================================
    // NEXT TURN
    // =====================================================

    setTimeout(() => {
      this.nextTurn();

      this.onUpdate?.();
    }, 1700);
  }

  // =====================================================
  // BETTING ROUND FINISHED
  // =====================================================

  isBettingRoundFinished() {
    const activePlayers = this.room.players.filter((p) => !p.folded);

    if (activePlayers.length <= 1) {
      return true;
    }

    // اگر همه All-In هستند
    if (activePlayers.every((p) => p.allIn)) {
      return true;
    }

    const highestBet = Math.max(...activePlayers.map((p) => p.currentBet));

    return activePlayers.every(
      (p) =>
        (p as any).actedThisRound && (p.currentBet === highestBet || p.allIn),
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

    const activePlayers = this.room.players.filter((p) => !p.folded);

    // =====================================================
    // NO PLAYERS
    // =====================================================

    if (activePlayers.length === 0) {
      console.log("❌ SHOWDOWN: NO ACTIVE PLAYERS");

      return;
    }

    // =====================================================
    // ONE PLAYER
    // =====================================================

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];

      this.room.winner = winner;

      winner.chips += this.room.pot;

      this.room.pot = 0;

      console.log("🏆 SHOWDOWN WINNER:", winner.username);

      this.onUpdate?.();

      setTimeout(() => {
        this.startNextHand();
      }, 5000);

      return;
    }

    // =====================================================
    // EVALUATE ALL ACTIVE PLAYERS
    // =====================================================

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

    // =====================================================
    // SORT BY SCORE
    // =====================================================

    results.sort((a, b) => b.result.score - a.result.score);

    const winnerResult = results[0];

    // =====================================================
    // WINNER
    // =====================================================

    this.room.winner = winnerResult.player;

    this.room.winnerHand = winnerResult.result.name;

    this.room.winnerCards = winnerResult.result.winningCards;

    console.log("🏆 WINNER:", winnerResult.player.username);

    console.log("🏆 WINNING HAND:", winnerResult.result.name);

    console.log("🏆 WINNING CARDS:", winnerResult.result.winningCards);

    // =====================================================
    // PAY POT
    // =====================================================

    winnerResult.player.chips += this.room.pot;

    console.log("💰 WINNER CHIPS:", winnerResult.player.chips);

    console.log("💰 POT:", this.room.pot);

    this.room.pot = 0;

    // =====================================================
    // SHOWDOWN UPDATE
    // =====================================================

    this.room.state = GameState.SHOWDOWN;

    this.onUpdate?.();

    // =====================================================
    // NEXT HAND
    // =====================================================

    setTimeout(() => {
      this.startNextHand();
    }, 15000);
  }

  // =====================================================
  // START NEXT HAND
  // =====================================================

 startNextHand() {
  console.log("====================================");
  console.log("🔄 START NEXT HAND");

  const playablePlayers = this.room.players.filter(
    (player) => player.chips > 0
  );

  console.log(
    "👥 PLAYABLE:",
    playablePlayers.map((p) => ({
      id: p.id,
      username: p.username,
      chips: p.chips,
    }))
  );

  // =====================================================
  // کمتر از 2 بازیکن دارای چیپ
  // =====================================================

  if (playablePlayers.length < 2) {
    console.log("🛑 NEXT HAND BLOCKED");
    console.log(
      `⏳ ONLY ${playablePlayers.length} PLAYER(S) HAVE CHIPS`
    );

    // خیلی مهم
    // دیگر startGame صدا زده نمی‌شود
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

    console.log("🟡 TABLE IS WAITING FOR BUY-IN / LEAVE");
    console.log("====================================");

    return;
  }

  // =====================================================
  // دو نفر یا بیشتر چیپ دارند
  // =====================================================

  console.log(
    `✅ ${playablePlayers.length} PLAYERS CAN PLAY`
  );

  // بازیکنان بدون چیپ فعلاً بازی نمی‌کنند
  this.room.players.forEach((player) => {
    if (player.chips <= 0) {
      player.folded = true;
    }
  });

  // =====================================================
  // پاک کردن Winner
  // =====================================================

  this.room.winner = null;

  this.room.winnerHand = null;

  this.room.winnerCards = [];

  // =====================================================
  // Dealer
  // =====================================================

  this.room.nextDealer();

  // =====================================================
  // شروع دست جدید
  // =====================================================

  console.log("🎮 STARTING NEW HAND");

  this.room.startGame();

  this.onUpdate?.();

  console.log(
    "🎮 NEW HAND STARTED:",
    this.room.state
  );

  console.log("====================================");
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
