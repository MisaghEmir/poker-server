import Player from "./Player";
import { PlayerAction } from "./PlayerAction";
import PokerEngine from "./PokerEngine";
import HandEvaluator from "./HandEvaluator";

export default class BotPlayer extends Player {
  isBot = true;

  constructor(id: string, username: string) {
    super(id, username, 10000);
  }

  async play(engine: PokerEngine) {
    const delay = Math.floor(Math.random() * 2000) + 1000;

    await new Promise((resolve) => setTimeout(resolve, delay));

    const result = HandEvaluator.evaluate(
      this.hand,
      engine.room.communityCards,
    );

    const strength = result.score;

    const highestBet = Math.max(
      ...engine.room.players.map((p) => p.currentBet),
    );

    const callAmount = highestBet - this.currentBet;

    // شرط خیلی زیاد است و دست ضعیف
    if (callAmount > this.chips * 0.4 && strength < 100) {
      return {
        action: PlayerAction.FOLD,
        amount: 0,
      };
    }

    // دست ضعیف
    if (strength < 100) {
      return callAmount === 0
        ? { action: PlayerAction.CHECK, amount: 0 }
        : { action: PlayerAction.FOLD, amount: 0 };
    }

    // یک جفت
    if (strength < 200) {
      return callAmount === 0
        ? { action: PlayerAction.CHECK, amount: 0 }
        : { action: PlayerAction.CALL, amount: 0 };
    }

    // دو جفت یا بهتر
    if (strength < 600) {
      return {
        action: PlayerAction.RAISE,
        amount: Math.min(20, this.chips),
      };
    }

    // فول هاوس یا بهتر
    return {
      action: PlayerAction.ALL_IN,
      amount: 0,
    };

  
  }
}
