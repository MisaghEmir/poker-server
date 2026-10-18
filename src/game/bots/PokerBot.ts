import Player from "../Player";
import HandEvaluator from "../HandEvaluator";
import PokerEngine from "../PokerEngine";
import { PlayerAction } from "../PlayerAction";

export type BotStyle = "tight" | "aggressive" | "balanced" | "loose";

type BotDecision = {
  action: PlayerAction;
  amount: number;
};

type StyleConfig = {
  looseness: number;
  aggression: number;
  bluff: number;
  callThreshold: number;
};

export default class PokerBot extends Player {
  style: BotStyle;
  isBot = true;

  constructor(
    id: string,
    username: string,
    style: BotStyle = "balanced",
    minBuyIn = 1000,
    maxBuyIn = 10000,
  ) {
    const min = Math.max(1, Math.floor(Math.min(minBuyIn, maxBuyIn)));
    const max = Math.max(min, Math.floor(Math.max(minBuyIn, maxBuyIn)));
    const chips = Math.floor(Math.random() * (max - min + 1)) + min;

    super(id, username, chips);
    this.style = style;
  }

  getStrength(engine: PokerEngine): number {
    const result = HandEvaluator.evaluate(
      this.hand,
      engine.room.communityCards,
    );
    return Number(result.score) || 0;
  }

  isOpponentAllIn(engine: PokerEngine): boolean {
    return engine.room.players.some(
      (p) => p.id !== this.id && !p.folded && p.allIn,
    );
  }

  getActiveOpponents(engine: PokerEngine) {
    return engine.room.players.filter((p) => p.id !== this.id && !p.folded);
  }

  getHighestBet(engine: PokerEngine): number {
    const active = this.getActiveOpponents(engine);
    if (active.length === 0) return 0;
    return Math.max(...active.map((p) => Number(p.currentBet) || 0));
  }

  getCallAmount(engine: PokerEngine): number {
    return Math.max(0, this.getHighestBet(engine) - this.currentBet);
  }

  private getStreet(
    engine: PokerEngine,
  ): "preflop" | "flop" | "turn" | "river" {
    const n = engine.room.communityCards?.length ?? 0;
    if (n === 0) return "preflop";
    if (n === 3) return "flop";
    if (n === 4) return "turn";
    return "river";
  }

  private getStyleConfig(): StyleConfig {
    // 🔥 بلوف و تهاجم خیلی بالاتر
    return {
      tight: {
        looseness: 1.05,
        aggression: 1.25,
        bluff: 0.22,
        callThreshold: 0.28,
      },
      balanced: {
        looseness: 1.2,
        aggression: 1.4,
        bluff: 0.32,
        callThreshold: 0.22,
      },
      aggressive: {
        looseness: 1.35,
        aggression: 1.7,
        bluff: 0.45,
        callThreshold: 0.18,
      },
      loose: {
        looseness: 1.5,
        aggression: 1.55,
        bluff: 0.5,
        callThreshold: 0.15,
      },
    }[this.style];
  }

  /**
   * 9=SF 8=Quads 7=FH 6=Flush 5=Straight 4=Trips 3=TwoPair 2=Pair 1=High
   */
  private normalizeStrength(score: number, street: string): number {
    const category = Math.floor(score / 1_000_000);

    let base: number;
    switch (category) {
      case 9:
        base = 1.0;
        break;
      case 8:
        base = 0.95;
        break;
      case 7:
        base = 0.88;
        break;
      case 6:
        base = 0.8;
        break;
      case 5:
        base = 0.72;
        break;
      case 4:
        base = 0.62;
        break;
      case 3:
        base = 0.52;
        break;
      case 2:
        base = 0.42;
        break;
      case 1:
        base = 0.28; // High card دیگه خیلی ضعیف حساب نشه
        break;
      default:
        base = 0.2;
    }

    // preflop: تقریباً همه دست‌ها قابل‌بازی‌تر
    if (street === "preflop") {
      if (category >= 2) return Math.min(1, base + 0.2); // جفت+
      return Math.min(0.55, base + 0.22); // high card preflop ~0.5
    }
    if (street === "flop") return Math.min(1, base * 1.1);
    if (street === "turn") return Math.min(1, base * 1.04);
    return base;
  }

  private calcPotOdds(callCost: number, pot: number): number {
    if (callCost <= 0) return 0;
    return callCost / (pot + callCost);
  }

  private calcSPR(chips: number, pot: number): number {
    return pot > 0 ? chips / pot : 99;
  }

  private sizeRaise(
    engine: PokerEngine,
    pot: number,
    highestBet: number,
    blind: number,
    chips: number,
    isValue: boolean,
    isBluff: boolean,
  ): number {
    const config = this.getStyleConfig();
    const minRaise = Math.max(highestBet + blind, blind * 2);
    let target: number;

    if (isValue) {
      const street = this.getStreet(engine);
      const potFactor =
        street === "river"
          ? 0.75 + Math.random() * 0.45
          : street === "turn"
            ? 0.55 + Math.random() * 0.35
            : 0.45 + Math.random() * 0.3;
      target = Math.floor(pot * potFactor * config.aggression);
    } else if (isBluff) {
      target = Math.floor(pot * (0.4 + Math.random() * 0.4));
    } else {
      target = Math.floor(
        pot * (0.5 + Math.random() * 0.35) * config.aggression,
      );
    }

    return Math.min(chips, Math.max(minRaise, target));
  }

  async think(engine: PokerEngine): Promise<BotDecision> {
    const strength = this.getStrength(engine);
    const callAmount = this.getCallAmount(engine);
    const highestBet = this.getHighestBet(engine);
    const opponentAllIn = this.isOpponentAllIn(engine);
    const pot = Math.max(0, Number(engine.room.pot) || 0);
    const chips = this.chips;
    const blind = Math.max(1, engine.room.bigBlindAmount || 1);
    const street = this.getStreet(engine);
    const config = this.getStyleConfig();
    const callCost = Math.min(callAmount, chips);
    const potOdds = this.calcPotOdds(callCost, pot);
    const spr = this.calcSPR(chips, pot);
    const normalized = this.normalizeStrength(strength, street);
    const opponents = this.getActiveOpponents(engine).length;

    if (chips <= 0) {
      return { action: PlayerAction.FOLD, amount: 0 };
    }

    // ═══════════════════════════════════════
    // 1) حریف All-In → خیلی راحت‌تر کال
    // ═══════════════════════════════════════
    if (opponentAllIn) {
      const willCall =
        normalized >= 0.28 ||
        normalized >= config.callThreshold ||
        potOdds <= 0.35 * config.looseness ||
        (normalized >= 0.35 && potOdds < 0.45);

      if (willCall) {
        return callCost >= chips
          ? { action: PlayerAction.ALL_IN, amount: chips }
          : { action: PlayerAction.CALL, amount: callCost };
      }

      return {
        action: callAmount > 0 ? PlayerAction.FOLD : PlayerAction.CHECK,
        amount: 0,
      };
    }

    // ═══════════════════════════════════════
    // 2) دست خیلی قوی (≥ 0.72)
    // ═══════════════════════════════════════
    if (normalized >= 0.72) {
      if (
        chips <= blind * 15 ||
        spr < 5 ||
        chips <= pot * 1.4 ||
        Math.random() < 0.5 * config.aggression
      ) {
        return { action: PlayerAction.ALL_IN, amount: chips };
      }

      if (Math.random() < 0.9 * config.aggression) {
        return {
          action: PlayerAction.RAISE,
          amount: this.sizeRaise(
            engine,
            pot,
            highestBet,
            blind,
            chips,
            true,
            false,
          ),
        };
      }

      return callAmount > 0
        ? { action: PlayerAction.CALL, amount: callCost }
        : { action: PlayerAction.CHECK, amount: 0 };
    }

    // ═══════════════════════════════════════
    // 3) دست خوب (≥ 0.48) — pair+ / trips-
    // ═══════════════════════════════════════
    if (normalized >= 0.48) {
      if (
        (spr < 4 || chips <= blind * 18) &&
        Math.random() < 0.5 * config.aggression
      ) {
        return { action: PlayerAction.ALL_IN, amount: chips };
      }

      if (
        Math.random() < 0.7 * config.aggression &&
        chips > callCost + blind * 2
      ) {
        return {
          action: PlayerAction.RAISE,
          amount: this.sizeRaise(
            engine,
            pot,
            highestBet,
            blind,
            chips,
            true,
            false,
          ),
        };
      }

      // تقریباً همیشه کال/چک
      if (
        callAmount === 0 ||
        potOdds <= 0.4 * config.looseness ||
        normalized >= 0.5
      ) {
        return callAmount > 0
          ? { action: PlayerAction.CALL, amount: callCost }
          : { action: PlayerAction.CHECK, amount: 0 };
      }

      // فقط بت خیلی سنگین روی river فولد
      if (street === "river" && potOdds > 0.5) {
        return { action: PlayerAction.FOLD, amount: 0 };
      }

      return callAmount > 0
        ? { action: PlayerAction.CALL, amount: callCost }
        : { action: PlayerAction.CHECK, amount: 0 };
    }

    // ═══════════════════════════════════════
    // 4) دست متوسط (≥ 0.30)
    // ═══════════════════════════════════════
    if (normalized >= 0.3) {
      // بدون بت → بلوف / فشار زیاد
      if (callAmount === 0) {
        const pressureChance =
          (this.style === "aggressive" ? 0.5 : 0.35) * config.aggression;

        if (Math.random() < pressureChance && chips > blind * 2) {
          if (spr < 3 && Math.random() < 0.45) {
            return { action: PlayerAction.ALL_IN, amount: chips };
          }
          return {
            action: PlayerAction.RAISE,
            amount: this.sizeRaise(
              engine,
              pot,
              highestBet,
              blind,
              chips,
              false,
              true,
            ),
          };
        }
        return { action: PlayerAction.CHECK, amount: 0 };
      }

      // کال خیلی آسان‌تر
      if (
        potOdds <= 0.35 * config.looseness ||
        callAmount <= blind * 3 ||
        (street === "preflop" && potOdds <= 0.4)
      ) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      if (Math.random() < 0.4 * config.looseness) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      return { action: PlayerAction.FOLD, amount: 0 };
    }

    // ═══════════════════════════════════════
    // 5) دست ضعیف → بلوف سنگین
    // ═══════════════════════════════════════
    if (callAmount === 0 && chips > blind * 2) {
      const bluffChance =
        config.bluff *
        (street === "river" ? 1.5 : street === "turn" ? 1.25 : 1.1) *
        (opponents === 1 ? 1.35 : 0.9);

      if (Math.random() < bluffChance) {
        // بلوف All-In بیشتر
        if (
          (spr < 3.5 || opponents === 1 || street === "river") &&
          Math.random() < 0.4 * config.aggression
        ) {
          return { action: PlayerAction.ALL_IN, amount: chips };
        }

        return {
          action: PlayerAction.RAISE,
          amount: this.sizeRaise(
            engine,
            pot,
            highestBet,
            blind,
            chips,
            false,
            true,
          ),
        };
      }

      return { action: PlayerAction.CHECK, amount: 0 };
    }

    // Facing bet با دست ضعیف
    if (callAmount > 0) {
      // بت کوچک / preflop → کال
      if (
        callAmount <= blind * 2.5 ||
        potOdds <= 0.22 * config.looseness ||
        (street === "preflop" && potOdds <= 0.3)
      ) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      // گاهی کال سبک (بلوف‌کچر)
      if (Math.random() < 0.25 * config.looseness) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      return { action: PlayerAction.FOLD, amount: 0 };
    }

    return { action: PlayerAction.CHECK, amount: 0 };
  }
}
