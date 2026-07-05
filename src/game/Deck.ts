import { Card, Rank, Suit } from "./Card";

export default class Deck {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.cards = [];

    const suits: Suit[] = ["S", "H", "D", "C"];

    const ranks: Rank[] = [
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
      "A",
    ];

    for (const suit of suits) {
      for (const rank of ranks) {
        this.cards.push({
          suit,
          rank,
        });
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Card {
    const card = this.cards.pop();

    if (!card) {
      throw new Error("Deck is empty");
    }

    return card;
  }

  remaining() {
    return this.cards.length;
  }
}