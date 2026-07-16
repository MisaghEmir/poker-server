import { Card } from "../Card";

export default class HandEvaluator {
  static evaluate(hand: Card[], community: Card[]): number {
    const cards = [...hand, ...community];

    const ranks = cards.map((c) => c.rank);

    const suits = cards.map((c) => c.suit);

    const rankCount = this.count(ranks);

    const suitCount = this.count(suits);

    const pairs = Object.values(rankCount).filter(
      (v: number) => v === 2,
    ).length;

    const three = Object.values(rankCount).some((v: number) => v === 3);

    const four = Object.values(rankCount).some((v: number) => v === 4);

    const flush = Object.values(suitCount).some((v: number) => v >= 5);

    const straight = this.hasStraight(ranks);

    // Straight Flush
    if (flush && straight) return 900;

    // Four of a kind
    if (four) return 800;

    // Full House
    if (three && pairs > 0) return 700;

    // Flush
    if (flush) return 600;

    // Straight
    if (straight) return 500;

    // Three of a kind
    if (three) return 400;

    // Two Pair
    if (pairs >= 2) return 300;

    // Pair
    if (pairs === 1) return 200;

    // High Card
    return 100;
  }

  private static count(arr: string[]): Record<string, number> {
    const result: Record<string, number> = {};

    arr.forEach((item) => {
      result[item] = (result[item] || 0) + 1;
    });

    return result;
  }

  private static hasStraight(ranks: string[]): boolean {
    const values = ranks
      .map((rank) => {
        switch (rank) {
          case "A":
            return 14;

          case "K":
            return 13;

          case "Q":
            return 12;

          case "J":
            return 11;

          default:
            return Number(rank);
        }
      })
      .sort((a, b) => a - b);

    // حذف تکراری‌ها
    const unique = [...new Set(values)];

    let count = 1;

    for (let i = 1; i < unique.length; i++) {
      if (unique[i] === unique[i - 1] + 1) {
        count++;

        if (count >= 5) return true;
      } else {
        count = 1;
      }
    }

    // حالت A2345
    if (
      unique.includes(14) &&
      unique.includes(2) &&
      unique.includes(3) &&
      unique.includes(4) &&
      unique.includes(5)
    ) {
      return true;
    }

    return false;
  }
}
