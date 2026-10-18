import { Card } from "../Card";

export interface HandResult {
  /** دسته × ۱٬۰۰۰٬۰۰۰ + جزئیات kicker — برای ربات: Math.floor(score / 1_000_000) * 100 */
  score: number;
  name: string;
  winningCards: Card[];
}

export default class HandEvaluator {
  /**
   * Texas Hold'em
   * فقط ۲ کارت همان بازیکن + کارت‌های وسط.
   * کارت دست بازیکن‌های دیگر هرگز وارد نمی‌شود.
   */
  static evaluate(hand: Card[], community: Card[]): HandResult {
    // فقط ۲ کارت اول دست (جلوگیری از باگ اگر آرایه آلوده باشد)
    const hole = (hand || []).slice(0, 2);
    const board = community || [];
    const cards = [...hole, ...board];

    if (cards.length === 0) {
      return { score: 0, name: "NO CARDS", winningCards: [] };
    }

    // کمتر از ۵ کارت (preflop/flop): همان کارت‌های موجود
    if (cards.length < 5) {
      return this.evaluateFive(cards);
    }

    // بهترین ترکیب ۵تایی از حداکثر ۷ کارت
    const combos = this.getCombinations(cards, 5);
    let best: HandResult | null = null;

    for (const combo of combos) {
      const result = this.evaluateFive(combo);
      if (!best || result.score > best.score) {
        best = result;
      }
    }

    return best!;
  }

  private static evaluateFive(cards: Card[]): HandResult {
    const sorted = [...cards].sort(
      (a, b) => this.rankValue(b.rank) - this.rankValue(a.rank),
    );

    const ranks = sorted.map((c) => c.rank);
    const values = sorted.map((c) => this.rankValue(c.rank));
    const suits = sorted.map((c) => c.suit);

    const rankCount = this.count(ranks);

    // Flush فقط وقتی دقیقاً همهٔ کارت‌های این ترکیب یک خال باشند
    // و حداقل ۵ کارت داشته باشیم
    const isFlush =
      sorted.length >= 5 && suits.every((s) => s === suits[0]);

    const isStraight =
      sorted.length >= 5 && this.isStraight(values);

    const pairs: string[] = [];
    const triples: string[] = [];
    let quads: string | null = null;

    for (const [rank, cnt] of Object.entries(rankCount)) {
      if (cnt === 4) quads = rank;
      else if (cnt === 3) triples.push(rank);
      else if (cnt === 2) pairs.push(rank);
    }

    pairs.sort((a, b) => this.rankValue(b) - this.rankValue(a));
    triples.sort((a, b) => this.rankValue(b) - this.rankValue(a));

    // ─── 9) Straight Flush / Royal ───
    if (isFlush && isStraight) {
      const high =
        values[0] === 14 && values[1] === 5 ? 5 : values[0];
      const isRoyal = high === 14 && values.includes(13);
      return {
        score: 9_000_000 + high * 10_000,
        name: isRoyal ? "ROYAL FLUSH" : "STRAIGHT FLUSH",
        winningCards: sorted,
      };
    }

    // ─── 8) Four of a Kind ───
    if (quads) {
      const q = this.rankValue(quads);
      const kicker = values.find((v) => v !== q) || 0;
      return {
        score: 8_000_000 + q * 10_000 + kicker,
        name: "FOUR OF A KIND",
        winningCards: sorted,
      };
    }

    // ─── 7) Full House ───
    if (triples.length > 0 && (pairs.length > 0 || triples.length > 1)) {
      const t = this.rankValue(triples[0]);
      const p = this.rankValue(
        triples.length > 1 ? triples[1] : pairs[0],
      );
      return {
        score: 7_000_000 + t * 10_000 + p * 100,
        name: "FULL HOUSE",
        winningCards: sorted,
      };
    }

    // ─── 6) Flush ───
    if (isFlush) {
      return {
        score:
          6_000_000 +
          values[0] * 10_000 +
          values[1] * 1_000 +
          values[2] * 100 +
          values[3] * 10 +
          (values[4] || 0),
        name: "FLUSH",
        winningCards: sorted,
      };
    }

    // ─── 5) Straight ───
    if (isStraight) {
      const high =
        values[0] === 14 && values[1] === 5 ? 5 : values[0];
      return {
        score: 5_000_000 + high * 10_000,
        name: "STRAIGHT",
        winningCards: sorted,
      };
    }

    // ─── 4) Three of a Kind ───
    if (triples.length > 0) {
      const t = this.rankValue(triples[0]);
      const kickers = values.filter((v) => v !== t);
      return {
        score:
          4_000_000 +
          t * 10_000 +
          (kickers[0] || 0) * 100 +
          (kickers[1] || 0),
        name: "THREE OF A KIND",
        winningCards: sorted,
      };
    }

    // ─── 3) Two Pair ───
    if (pairs.length >= 2) {
      const hi = this.rankValue(pairs[0]);
      const lo = this.rankValue(pairs[1]);
      const kicker =
        values.find((v) => v !== hi && v !== lo) || 0;
      return {
        score: 3_000_000 + hi * 10_000 + lo * 100 + kicker,
        name: "TWO PAIR",
        winningCards: sorted,
      };
    }

    // ─── 2) One Pair ───
    if (pairs.length === 1) {
      const p = this.rankValue(pairs[0]);
      const kickers = values.filter((v) => v !== p);
      return {
        score:
          2_000_000 +
          p * 10_000 +
          (kickers[0] || 0) * 500 +
          (kickers[1] || 0) * 20 +
          (kickers[2] || 0),
        name: "PAIR",
        winningCards: sorted,
      };
    }

    // ─── 1) High Card ───
    return {
      score:
        1_000_000 +
        values[0] * 10_000 +
        (values[1] || 0) * 1_000 +
        (values[2] || 0) * 100 +
        (values[3] || 0) * 10 +
        (values[4] || 0),
      name: "HIGH CARD",
      winningCards: sorted.slice(0, Math.min(5, sorted.length)),
    };
  }

  // ─────────────────── Helpers ───────────────────

  private static rankValue(rank: string): number {
    switch (rank) {
      case "A":
        return 14;
      case "K":
        return 13;
      case "Q":
        return 12;
      case "J":
        return 11;
      case "T":
      case "10":
        return 10;
      default:
        return Number(rank) || 0;
    }
  }

  private static count(arr: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const x of arr) out[x] = (out[x] || 0) + 1;
    return out;
  }

  private static isStraight(sortedDesc: number[]): boolean {
    const unique = [...new Set(sortedDesc)].sort((a, b) => b - a);
    if (unique.length < 5) return false;

    // A-2-3-4-5
    if (
      unique.includes(14) &&
      unique.includes(5) &&
      unique.includes(4) &&
      unique.includes(3) &&
      unique.includes(2)
    ) {
      return true;
    }

    for (let i = 0; i <= unique.length - 5; i++) {
      let ok = true;
      for (let j = 0; j < 4; j++) {
        if (unique[i + j] - unique[i + j + 1] !== 1) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }

  private static getCombinations<T>(arr: T[], k: number): T[][] {
    if (k === arr.length) return [arr];
    if (k > arr.length || k <= 0) return [];
    if (k === 1) return arr.map((x) => [x]);

    const result: T[][] = [];
    const helper = (start: number, combo: T[]) => {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    };
    helper(0, []);
    return result;
  }
}