import Player from "../Player";
import PokerEngine from "../PokerEngine";
import { PlayerAction } from "../PlayerAction";
import HandEvaluator from "./HandEvaluator";

export type BotStyle = "tight" | "aggressive" | "balanced" | "loose";

export default class PokerBot extends Player {
  style: string;
  isBot = true;

  constructor(id: string, username: string, style: string) {
    super(id, username, Math.floor(Math.random() * 1000));

    this.style = style;
  }

  getStrength(engine: any) {
    return HandEvaluator.evaluate(this.hand, engine.room.communityCards);
  }

  async think(engine: any) {
    const strength = this.getStrength(engine);

    const bet = Math.max(...engine.room.players.map((p: any) => p.currentBet));

    const call = bet - this.currentBet;

    // دست ضعیف
    if (strength < 200 && call > this.chips * 0.1) {
      return {
        action: PlayerAction.FOLD,
        amount: 0,
      };
    }

    // دست متوسط
    if (strength < 500) {
      return {
        action: PlayerAction.CALL,
        amount: 0,
      };
    }

    // دست قوی
    if (strength >= 500) {
      return {
        action: PlayerAction.RAISE,
        amount: Math.min(this.chips, bet * 2),
      };
    }

    return {
      action: PlayerAction.CHECK,
      amount: 0,
    };
  }
}
