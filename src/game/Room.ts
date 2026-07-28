import Deck from "./Deck";
import Player from "./Player";
import { Card } from "./Card";
import { GameState } from "./GameState";

export default class Room {
  id: string;

  // بازیکنان
  players: Player[] = [];

  currentBet = 0;

  lastRaise = 2;

  round = 0;

  // دسته کارت
  deck: Deck = new Deck();

  // کارت‌های روی میز
  communityCards: Card[] = [];

  // مجموع شرط‌ها
  pot = 0;

  winner?: Player;

  // حداکثر تعداد بازیکنان
  maxPlayers = 5;

  // Dealer
  dealerIndex = 0;

  // نوبت فعلی
  currentPlayerIndex = 0;

  // Blind ها
  smallBlindAmount: number;
  bigBlindAmount: number;

  state: GameState = GameState.WAITING;

  constructor(id: string, smallBlindAmount = 1, bigBlindAmount = 2) {
    this.id = id;
    this.smallBlindAmount = smallBlindAmount;
    this.bigBlindAmount = bigBlindAmount;
  }

  // اضافه کردن بازیکن
  addPlayer(player: Player) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error("Room is full.");
    }

    this.players.push(player);
  }

  // حذف بازیکن
  removePlayer(playerId: string) {
    this.players = this.players.filter((player) => player.id !== playerId);
  }

  // آیا بازی قابل شروع است؟
  canStartGame() {
    return this.players.length >= 2;
  }

  // مشخص کردن Dealer و Blind ها
  private assignPositions() {
    this.players.forEach((player) => {
      player.dealer = false;
      player.smallBlind = false;
      player.bigBlind = false;
    });

    const dealer = this.players[this.dealerIndex];
    dealer.dealer = true;

    if (this.players.length === 2) {
      // Heads-up: dealer = small blind
      dealer.smallBlind = true;
      const bbIndex = (this.dealerIndex + 1) % this.players.length;
      this.players[bbIndex].bigBlind = true;
    } else {
      const sbIndex = (this.dealerIndex + 1) % this.players.length;
      const bbIndex = (this.dealerIndex + 2) % this.players.length;
      this.players[sbIndex].smallBlind = true;
      this.players[bbIndex].bigBlind = true;
    }
  }

  // دریافت Blind ها
  private collectBlinds() {
    const sb = this.players.find((p) => p.smallBlind);
    const bb = this.players.find((p) => p.bigBlind);

    if (!sb || !bb) {
      throw new Error("Blind players not found.");
    }

    sb.bet(this.smallBlindAmount);
    bb.bet(this.bigBlindAmount);

    this.pot = this.smallBlindAmount + this.bigBlindAmount;

    this.currentBet = this.bigBlindAmount;
  }

  // شروع بازی
  startGame() {
    if (!this.canStartGame()) {
      throw new Error("Not enough players.");
    }

    this.deck.reset();
    this.deck.shuffle();

    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;

    this.state = GameState.PRE_FLOP;

    // ریست بازیکنان
    this.players.forEach((player) => {
      player.clearHand();
    });

    // تعیین Dealer و Blind ها
    this.assignPositions();

    // دریافت Blind
    this.collectBlinds();

    // پخش کارت‌ها
    for (let i = 0; i < 2; i++) {
      this.players.forEach((player) => {
        player.receiveCard(this.deck.draw());
      });
    }

    // اولین نفر بعد از Big Blind
    this.currentPlayerIndex = (this.dealerIndex + 3) % this.players.length;
  }

  // Flop
  dealFlop() {
    this.deck.draw(); // Burn

    this.players.forEach((player) => {
      player.lastAction = null;
    });

    this.communityCards.push(this.deck.draw());
    this.communityCards.push(this.deck.draw());
    this.communityCards.push(this.deck.draw());
  }

  // Turn
  dealTurn() {
    this.deck.draw(); // Burn

    this.communityCards.push(this.deck.draw());
  }

  // River
  dealRiver() {
    this.deck.draw(); // Burn

    this.communityCards.push(this.deck.draw());
  }

  // بازیکن فعلی
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // بازیکن بعدی
  nextPlayer() {
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;
  }

  // دست بعدی
  nextDealer() {
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
  }

  // وضعیت میز
  printStatus() {
    console.log("========== TABLE ==========");
    console.log("Pot:", this.pot);

    console.log("Community:", this.communityCards);

    console.log("---------------------------");

    this.players.forEach((player) => {
      console.log({
        username: player.username,
        chips: player.chips,
        currentBet: player.currentBet,
        dealer: player.dealer,
        smallBlind: player.smallBlind,
        bigBlind: player.bigBlind,
        cards: player.hand,
      });
    });

    console.log("===========================");
  }
  getFirstPlayerAfterDealer() {
    let index = (this.dealerIndex + 1) % this.players.length;

    let count = 0;

    while (this.players[index].folded && count < this.players.length) {
      index = (index + 1) % this.players.length;
      count++;
    }

    return index;
  }
}
