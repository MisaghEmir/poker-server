import { Card } from "./Card";

const ranks: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export default class HandEvaluator {
  static evaluate(hand: Card[], board: Card[]) {
    const cards = [...hand, ...board];

    const count: Record<number, number> = {};

    for (const card of cards) {
      const value = ranks[card.rank];
      count[value] = (count[value] || 0) + 1;
    }

    const values = Object.entries(count)
      .map(([rank, c]) => ({
        rank: Number(rank),
        count: c,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.rank - a.rank;
      });

    // Four
    if (values[0].count === 4) {
      return {
        score: 700 + values[0].rank,
        name: "Four of a Kind",
      };
    }

    // Full House
    if (
      values[0].count === 3 &&
      values.length > 1 &&
      values[1].count >= 2
    ) {
      return {
        score: 600 + values[0].rank,
        name: "Full House",
      };
    }

    // Three
    if (values[0].count === 3) {
      return {
        score: 300 + values[0].rank,
        name: "Three of a Kind",
      };
    }

    // Two Pair
    if (
      values[0].count === 2 &&
      values.length > 1 &&
      values[1].count === 2
    ) {
      return {
        score: 200 + values[0].rank,
        name: "Two Pair",
      };
    }

    // Pair
    if (values[0].count === 2) {
      return {
        score: 100 + values[0].rank,
        name: "One Pair",
      };
    }

    // High Card
    const high = Math.max(...cards.map((c) => ranks[c.rank]));

    return {
      score: high,
      name: "High Card",
    };
  }
}