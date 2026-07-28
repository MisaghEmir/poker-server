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

  getCurrentPlayer(): Player {
    return this.room.players[this.room.currentPlayerIndex];
  }

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

  nextRound() {
    // پاک کردن تایمر قبلی
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }

    // ریست شرط های راند
    this.room.players.forEach((p) => {
      p.currentBet = 0;

      (p as any).actedThisRound = false;
    });

    this.room.currentBet = 0;

    // تغییر وضعیت بازی

    const activePlayers = this.room.players.filter((p) => !p.folded);

    if (activePlayers.every((p) => p.allIn)) {
      while (this.room.communityCards.length < 5) {
        if (this.room.communityCards.length === 0) {
          this.room.dealFlop();
        } else if (this.room.communityCards.length === 3) {
          this.room.dealTurn();
        } else {
          this.room.dealRiver();
        }
      }

      this.room.state = GameState.SHOWDOWN;
      this.showdown();
      return;
    }

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
        console.log("SHOWDOWN SET");
        this.showdown();

        break;
    }

    // پیدا کردن شروع کننده راند جدید
    const smallBlindIndex = this.room.players.findIndex((p) => p.smallBlind);

    let start = smallBlindIndex;

    let count = 0;

    while (
      this.room.players[start].folded &&
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

    if (this.onUpdate) {
      this.onUpdate();
    }

    console.log("SET TURN TO:", this.getCurrentPlayer()?.username);
  }

  playerAction(player: Player, action: PlayerAction, amount = 0) {
    // اگر دست تمام شده
    if (this.room.state === GameState.SHOWDOWN) {
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

        break;

      case PlayerAction.CHECK:
        break;

      case PlayerAction.CALL: {
        const highestBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );

        const callAmount = highestBet - player.currentBet;

        if (callAmount > 0) {
          player.bet(callAmount);

          this.room.pot += callAmount;
        }

        break;
      }

      case PlayerAction.RAISE: {
        const highestBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );

        const total = highestBet - player.currentBet + amount;

        player.bet(total);

        this.room.pot += total;

        this.room.currentBet = Math.max(
          ...this.room.players.map((p) => p.currentBet),
        );

        break;
      }

      case PlayerAction.ALL_IN: {
        const chips = player.chips;

        player.bet(chips);

        this.room.pot += chips;

        break;
      }
    }

    player.lastAction = action;

    (player as any).actedThisRound = true;

    console.log("ACTION:", player.username, action);

    // آیا راند تمام شده؟

    const activePlayers = this.room.players.filter((p) => !p.folded);

    if (activePlayers.length === 1) {
      const winner = activePlayers[0];

      this.room.winner = winner;
      winner.chips += this.room.pot;
      this.room.pot = 0;

      this.room.state = GameState.SHOWDOWN;

      console.log("WINNER BY FOLD:", winner.username);

      if (this.onUpdate) {
        this.onUpdate();
      }

      setTimeout(() => {
        this.startNextHand();
      }, 5000);

      return;
    }

    if (this.isBettingRoundFinished()) {
      console.log("ROUND FINISHED WAIT...");

      this.roundTimer = setTimeout(() => {
        this.nextRound();
      }, 3000);

      return;
    }

    // نفر بعدی

    this.nextTurn();
  }

  isBettingRoundFinished() {
    const activePlayers = this.room.players.filter((p) => !p.folded);

    if (activePlayers.length <= 1) {
      return true;
    }

    const highestBet = Math.max(...activePlayers.map((p) => p.currentBet));

    return activePlayers.every(
      (p) =>
        (p as any).actedThisRound && (p.currentBet === highestBet || p.allIn),
    );
  }

  showdown() {
    const activePlayers = this.room.players.filter((p) => !p.folded);

    if (activePlayers.length <= 1) {
      return true;
    }

    // همه بازیکنان فعال All-In هستند
    if (activePlayers.every((p) => p.allIn)) {
      return true;
    }

    const results = activePlayers.map((player) => ({
      player,
      result: HandEvaluator.evaluate(player.hand, this.room.communityCards),
    }));

    results.sort((a, b) => b.result.score - a.result.score);

    this.room.winner = results[0].player;

    console.log("WINNER:", results[0].player.username, results[0].result.name);

    this.room.winner.chips += this.room.pot;

    this.room.pot = 0;

    this.onUpdate?.();

    setTimeout(() => {
      this.startNextHand();
    }, 15000);
  }

  startNextHand() {
    this.room.nextDealer();
    this.room.startGame();

    this.onUpdate?.();
  }
}
