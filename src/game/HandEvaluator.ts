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

    const flush = this.checkFlush(cards);
    const straight = this.checkStraight(cards);

    // Royal Flush / Straight Flush
    if (flush && straight) {
      const high = straight.high;

      if (high === 14) {
        return {
          score: 900,
          name: "Royal Flush",
        };
      }

      return {
        score: 800 + high,
        name: "Straight Flush",
      };
    }

    const groups = this.getGroups(cards);

    // Four of a kind
    const four = groups.find((g) => g.count === 4);

    if (four) {
      return {
        score: 700 + four.rank,
        name: "Four of a Kind",
      };
    }

    // Full House
    const three = groups.find((g) => g.count === 3);
    const pair = groups.find((g) => g.count === 2);

    if (three && pair) {
      return {
        score: 600 + three.rank,
        name: "Full House",
      };
    }

    // Flush
    if (flush) {
      return {
        score: 500 + flush.high,
        name: "Flush",
      };
    }

    // Straight
    if (straight) {
      return {
        score: 400 + straight.high,
        name: "Straight",
      };
    }

    // Three of kind
    if (three) {
      return {
        score: 300 + three.rank,
        name: "Three of a Kind",
      };
    }

    // Two Pair
    const pairs = groups.filter((g) => g.count === 2);

    if (pairs.length >= 2) {
      return {
        score: 200 + pairs[0].rank,
        name: "Two Pair",
      };
    }

    // One Pair
    if (pairs.length === 1) {
      return {
        score: 100 + pairs[0].rank,
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

  private static getGroups(cards: Card[]) {
    const map: Record<number, number> = {};

    cards.forEach((card) => {
      const value = ranks[card.rank];

      map[value] = (map[value] || 0) + 1;
    });

    return Object.entries(map)
      .map(([rank, count]) => ({
        rank: Number(rank),
        count,
      }))
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;

        return b.rank - a.rank;
      });
  }

  private static checkFlush(cards: Card[]) {
    const suits: Record<string, Card[]> = {};

    cards.forEach((card) => {
      if (!suits[card.suit]) suits[card.suit] = [];

      suits[card.suit].push(card);
    });

    for (const suit in suits) {
      if (suits[suit].length >= 5) {
        const high = Math.max(...suits[suit].map((c) => ranks[c.rank]));

        return {
          suit,
          high,
        };
      }
    }

    return null;
  }

  private static checkStraight(cards: Card[]) {
    const values = [...new Set(cards.map((c) => ranks[c.rank]))].sort(
      (a, b) => b - a,
    );

    // A can be low in A2345
    if (values.includes(14)) {
      values.push(1);
    }

    let count = 1;

    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - 1 === values[i + 1]) {
        count++;

        if (count >= 5) {
          return {
            high: values[i - 3],
          };
        }
      } else {
        count = 1;
      }
    }

    return null;
  }
}
