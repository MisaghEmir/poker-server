import { Card } from "./Card";

export interface HandResult {
  score: number;
  name: string;
  winningCards: Card[];
}

export default class HandEvaluator {
  static evaluate(
    hand: Card[],
    community: Card[],
  ): HandResult {
    const cards = [...hand, ...community];

    const ranks = cards.map((c) => c.rank);
    const suits = cards.map((c) => c.suit);

    const rankCount = this.count(ranks);
    const suitCount = this.count(suits);

    const pairs = Object.entries(rankCount)
      .filter(([, count]) => count === 2)
      .map(([rank]) => rank);

    const triples = Object.entries(rankCount)
      .filter(([, count]) => count === 3)
      .map(([rank]) => rank);

    const quads = Object.entries(rankCount)
      .filter(([, count]) => count === 4)
      .map(([rank]) => rank);

    /**
     * FOUR OF A KIND
     */
    if (quads.length > 0) {
      const rank = quads[0];

      return {
        score: 800,
        name: "FOUR OF A KIND",
        winningCards: cards.filter(
          (card) => card.rank === rank,
        ),
      };
    }

    /**
     * FULL HOUSE
     */
    if (
      triples.length > 0 &&
      pairs.length > 0
    ) {
      const tripleRank = triples[0];
      const pairRank = pairs[0];

      return {
        score: 700,
        name: "FULL HOUSE",
        winningCards: cards.filter(
          (card) =>
            card.rank === tripleRank ||
            card.rank === pairRank,
        ),
      };
    }

    /**
     * FLUSH
     */
    const flushSuit = Object.entries(suitCount)
      .find(([, count]) => count >= 5)?.[0];

    if (flushSuit) {
      return {
        score: 600,
        name: "FLUSH",
        winningCards: cards.filter(
          (card) => card.suit === flushSuit,
        ),
      };
    }

    /**
     * STRAIGHT
     */
    const straightRanks =
      this.getStraightRanks(ranks);

    if (straightRanks.length === 5) {
      return {
        score: 500,
        name: "STRAIGHT",
        winningCards: cards.filter(
          (card) =>
            straightRanks.includes(
              this.rankValue(card.rank),
            ),
        ),
      };
    }

    /**
     * THREE OF A KIND
     */
    if (triples.length > 0) {
      const rank = triples[0];

      return {
        score: 400,
        name: "THREE OF A KIND",
        winningCards: cards.filter(
          (card) => card.rank === rank,
        ),
      };
    }

    /**
     * TWO PAIR
     */
    if (pairs.length >= 2) {
      const pairRanks = pairs.slice(0, 2);

      return {
        score: 300,
        name: "TWO PAIR",
        winningCards: cards.filter(
          (card) =>
            pairRanks.includes(card.rank),
        ),
      };
    }

    /**
     * ONE PAIR
     */
    if (pairs.length === 1) {
      const rank = pairs[0];

      return {
        score: 200,
        name: "PAIR",
        winningCards: cards.filter(
          (card) => card.rank === rank,
        ),
      };
    }

    /**
     * HIGH CARD
     */
    const sorted = [...cards].sort(
      (a, b) =>
        this.rankValue(b.rank) -
        this.rankValue(a.rank),
    );

    const highCard = sorted[0];

    return {
      score: 100,
      name: "HIGH CARD",
      winningCards: highCard
        ? [highCard]
        : [],
    };
  }

  private static count(
    arr: string[],
  ): Record<string, number> {
    const result: Record<
      string,
      number
    > = {};

    arr.forEach((item) => {
      result[item] =
        (result[item] || 0) + 1;
    });

    return result;
  }

  private static rankValue(
    rank: string,
  ): number {
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
  }

  private static getStraightRanks(
    ranks: string[],
  ): number[] {
    const values = [
      ...new Set(
        ranks.map((rank) =>
          this.rankValue(rank),
        ),
      ),
    ].sort((a, b) => a - b);

    /**
     * A2345
     */
    if (
      values.includes(14) &&
      values.includes(2) &&
      values.includes(3) &&
      values.includes(4) &&
      values.includes(5)
    ) {
      return [14, 2, 3, 4, 5];
    }

    let run: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (
        run.length === 0 ||
        values[i] ===
          run[run.length - 1] + 1
      ) {
        run.push(values[i]);
      } else {
        run = [values[i]];
      }

      if (run.length >= 5) {
        return run.slice(-5);
      }
    }

    return [];
  }
}