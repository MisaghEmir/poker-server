import Player from "./Player";
import HandEvaluator from "./HandEvaluator";
import PokerEngine from "./PokerEngine";
import { PlayerAction } from "./PlayerAction";

export type BotStyle = "tight" | "aggressive" | "balanced" | "loose";

type BotDecision = {
  action: PlayerAction;
  amount: number;
};

type StyleConfig = {
  looseness: number;
  aggression: number;
  bluff: number;
  valueThreshold: number;
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
      (player) =>
        player.id !== this.id &&
        !player.folded &&
        player.allIn,
    );
  }

  getActiveOpponents(engine: PokerEngine) {
    return engine.room.players.filter(
      (p) => p.id !== this.id && !p.folded,
    );
  }

  getHighestBet(engine: PokerEngine): number {
    const active = this.getActiveOpponents(engine);
    if (active.length === 0) return 0;
    return Math.max(...active.map((p) => Number(p.currentBet) || 0));
  }

  getCallAmount(engine: PokerEngine): number {
    return Math.max(0, this.getHighestBet(engine) - this.currentBet);
  }

  private getStreet(engine: PokerEngine): "preflop" | "flop" | "turn" | "river" {
    const n = engine.room.communityCards?.length ?? 0;
    if (n === 0) return "preflop";
    if (n === 3) return "flop";
    if (n === 4) return "turn";
    return "river";
  }

  private getStyleConfig(): StyleConfig {
    const configs: Record<BotStyle, StyleConfig> = {
      tight: {
        looseness: 0.78,
        aggression: 0.9,
        bluff: 0.04,
        valueThreshold: 0.72,
        callThreshold: 0.55,
      },
      balanced: {
        looseness: 0.95,
        aggression: 1.05,
        bluff: 0.09,
        valueThreshold: 0.65,
        callThreshold: 0.48,
      },
      aggressive: {
        looseness: 1.08,
        aggression: 1.35,
        bluff: 0.16,
        valueThreshold: 0.58,
        callThreshold: 0.42,
      },
      loose: {
        looseness: 1.25,
        aggression: 1.15,
        bluff: 0.2,
        valueThreshold: 0.52,
        callThreshold: 0.38,
      },
    };
    return configs[this.style];
  }

  private normalizeStrength(score: number, street: string): number {
    // Slightly more granular mapping; river hands are more polarized
    let base: number;
    if (score >= 900) base = 1.0;
    else if (score >= 850) base = 0.97;
    else if (score >= 800) base = 0.93;
    else if (score >= 750) base = 0.89;
    else if (score >= 700) base = 0.84;
    else if (score >= 650) base = 0.78;
    else if (score >= 600) base = 0.72;
    else if (score >= 550) base = 0.66;
    else if (score >= 500) base = 0.6;
    else if (score >= 450) base = 0.54;
    else if (score >= 400) base = 0.48;
    else if (score >= 350) base = 0.42;
    else if (score >= 300) base = 0.36;
    else if (score >= 250) base = 0.3;
    else if (score >= 200) base = 0.24;
    else if (score >= 150) base = 0.18;
    else if (score >= 100) base = 0.12;
    else base = 0.08;

    // On earlier streets raw score under-represents potential
    if (street === "preflop") return Math.min(1, base * 1.15 + 0.05);
    if (street === "flop") return Math.min(1, base * 1.08);
    if (street === "turn") return Math.min(1, base * 1.03);
    return base; // river = pure showdown value
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
    const minRaise = highestBet + blind;
    let target: number;

    if (isValue) {
      // Value: larger on river, moderate earlier
      const street = this.getStreet(engine);
      const potFactor =
        street === "river" ? 0.75 + Math.random() * 0.35 :
        street === "turn" ? 0.55 + Math.random() * 0.3 :
        0.45 + Math.random() * 0.25;
      target = Math.floor(pot * potFactor * config.aggression);
    } else if (isBluff) {
      // Smaller, more frequent pressure
      target = Math.floor(pot * (0.35 + Math.random() * 0.25));
    } else {
      // Standard pressure / semi-bluff
      target = Math.floor(pot * (0.5 + Math.random() * 0.3) * config.aggression);
    }

    const amount = Math.max(minRaise, target);
    return Math.min(chips, amount);
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

    // Safety
    if (chips <= 0) {
      return { action: PlayerAction.FOLD, amount: 0 };
    }

    // ──────────────────────────────────────────────
    // 1. Facing all-in
    // ──────────────────────────────────────────────
    if (opponentAllIn) {
      // Require higher equity the bigger the ask relative to pot
      const required =
        Math.min(0.92, potOdds + 0.08 + (street === "river" ? 0.05 : 0));

      // Style adjustment
      const styleAdj = config.callThreshold * 0.85;
      const willCall =
        normalized >= Math.max(required, styleAdj) ||
        (normalized >= 0.62 && potOdds < 0.28 * config.looseness);

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

    // ──────────────────────────────────────────────
    // 2. Monster hands (≥ 0.88)
    // ──────────────────────────────────────────────
    if (normalized >= 0.88) {
      // Short stack or high commitment → jam
      if (chips <= blind * 8 || spr < 2.5 || chips <= pot * 0.9) {
        return { action: PlayerAction.ALL_IN, amount: chips };
      }

      // Prefer raising for value most of the time
      if (
        this.style === "aggressive" ||
        Math.random() < 0.72 * config.aggression
      ) {
        const raiseAmt = this.sizeRaise(
          engine, pot, highestBet, blind, chips, true, false,
        );
        return { action: PlayerAction.RAISE, amount: raiseAmt };
      }

      // Occasionally slow-play (especially multiway or deep)
      return callAmount > 0
        ? { action: PlayerAction.CALL, amount: callCost }
        : { action: PlayerAction.CHECK, amount: 0 };
    }

    // ──────────────────────────────────────────────
    // 3. Strong hands (0.70 – 0.88)
    // ──────────────────────────────────────────────
    if (normalized >= 0.7) {
      const shouldRaise =
        (this.style === "aggressive" || Math.random() < 0.48 * config.aggression) &&
        chips > callCost + blind * 2;

      if (shouldRaise) {
        const raiseAmt = this.sizeRaise(
          engine, pot, highestBet, blind, chips, true, false,
        );
        return { action: PlayerAction.RAISE, amount: raiseAmt };
      }

      // Call if pot odds are reasonable or free
      if (
        callAmount === 0 ||
        potOdds <= normalized * config.looseness * 0.95
      ) {
        return callAmount > 0
          ? { action: PlayerAction.CALL, amount: callCost }
          : { action: PlayerAction.CHECK, amount: 0 };
      }

      // Still fold the bottom of this range vs big bets on river
      if (street === "river" && potOdds > 0.38) {
        return { action: PlayerAction.FOLD, amount: 0 };
      }

      return callAmount > 0
        ? { action: PlayerAction.CALL, amount: callCost }
        : { action: PlayerAction.CHECK, amount: 0 };
    }

    // ──────────────────────────────────────────────
    // 4. Medium hands (0.42 – 0.70)
    // ──────────────────────────────────────────────
    if (normalized >= 0.42) {
      // Free check / cheap call
      if (callAmount === 0) {
        // Occasional aggression (especially aggressive style)
        if (
          Math.random() < (this.style === "aggressive" ? 0.28 : 0.12) * config.aggression &&
          chips > blind * 4
        ) {
          const raiseAmt = this.sizeRaise(
            engine, pot, highestBet, blind, chips, false, false,
          );
          return { action: PlayerAction.RAISE, amount: raiseAmt };
        }
        return { action: PlayerAction.CHECK, amount: 0 };
      }

      // Good pot odds → call
      if (potOdds <= 0.18 * config.looseness) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      // Loose / aggressive styles call a bit lighter
      if (
        (this.style === "loose" || this.style === "aggressive") &&
        potOdds <= 0.26 &&
        Math.random() < 0.35
      ) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      // Otherwise fold
      return { action: PlayerAction.FOLD, amount: 0 };
    }

    // ──────────────────────────────────────────────
    // 5. Weak hands – bluff / fold logic
    // ──────────────────────────────────────────────
    // Bluff only when checked to us (or very small bet)
    if (callAmount === 0 && chips > blind * 3) {
      const bluffChance =
        config.bluff *
        (street === "river" ? 1.25 : street === "turn" ? 1.1 : 0.9) *
        (opponents === 1 ? 1.15 : 0.75); // prefer heads-up bluffs

      if (Math.random() < bluffChance) {
        const raiseAmt = this.sizeRaise(
          engine, pot, highestBet, blind, chips, false, true,
        );
        return { action: PlayerAction.RAISE, amount: raiseAmt };
      }

      return { action: PlayerAction.CHECK, amount: 0 };
    }

    // Facing a bet with a weak hand
    if (callAmount > 0) {
      // Extremely good price (tiny bet)
      if (callAmount <= blind && potOdds <= 0.12) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      // Loose style can make some light calls on earlier streets
      if (
        this.style === "loose" &&
        street !== "river" &&
        potOdds <= 0.18 &&
        Math.random() < 0.22
      ) {
        return { action: PlayerAction.CALL, amount: callCost };
      }

      return { action: PlayerAction.FOLD, amount: 0 };
    }

    return { action: PlayerAction.CHECK, amount: 0 };
  }
}