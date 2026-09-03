import { Card } from "./Card";
import { PlayerAction } from "./PlayerAction";

export default class Player {
  id: string;
  username: string;

  chips: number;

  hand: Card[] = [];

  currentBet = 0;
  totalBet = 0;
  actedThisRound = false;
  folded = false;
  allIn = false;

  dealer = false;
  smallBlind = false;
  bigBlind = false;

  lastAction: PlayerAction | null = null;

  isActive = true;

  isTurn = false;

  constructor(id: string, username: string, chips = 10000) {
    this.id = id;
    this.username = username;
    this.chips = chips;
  }

  receiveCard(card: Card) {
    if (this.hand.length >= 2) {
      throw new Error("Player already has 2 cards.");
    }

    this.hand.push(card);
  }

  clearHand() {
    this.hand = [];
    this.currentBet = 0;
    this.totalBet = 0;

    this.folded = false;
    this.allIn = false;

    this.dealer = false;
    this.smallBlind = false;
    this.bigBlind = false;

    this.lastAction = null;

    this.isActive = true;
    this.isTurn = false;
  }

  bet(amount: number) {
    if (amount <= 0) {
      return;
    }

    // هیچوقت بیشتر از چیپ موجود شرط نزن
    const actualAmount = Math.min(amount, this.chips);

    this.chips -= actualAmount;
    this.currentBet += actualAmount;
    this.totalBet += actualAmount;

    // اگر همه چیپ‌ها مصرف شد
    if (this.chips === 0) {
      this.allIn = true;
    }
  }

  fold() {
    this.folded = true;
  }
}
